import { action, computed, observable } from "mobx";
import { RootStore } from "./root";
import { Msg, MsgType } from "@/type/msg";
import axios from "axios";
import { WsEvent, isChatMsg } from "./ws";
import { last, throttle } from "lodash";
import { pipe, sortBy, uniqBy } from "lodash/fp";
import Taro, { getCurrentInstance } from "@tarojs/taro";
import { toast } from "@/tools/alert";
import { apEq } from "@/tools";

export class RoomStore {
  constructor(private root: RootStore) {}

  /*----------------- 房间信息 -----------------*/
  @observable roomInfo: any = {};

  @action setRoomInfo = (roomInfo: any) => {
    this.roomInfo = { ...this.roomInfo, ...roomInfo };
  };

  /*----------------- 消息列表 -----------------*/
  @observable msgList: Msg[] = [];

  @action setMsgList = (list: Msg[]) => {
    const realList = this.sortList(list);
    this.msgList = realList;
    const id = last(realList)?.msgId;
    this.setLastMsgId("_" + id);
  };

  sortList = pipe<[Msg[]], Msg[], Msg[]>(
    uniqBy((it) => it.msgId),
    sortBy((it) => it.msgId)
  );

  @observable lastMsgId: string = "";

  @action setLastMsgId = (lastMsgId: string) => {
    this.lastMsgId = lastMsgId;
  };

  @action join = async () => {
    const { userStore, wsStore } = this.root;
    const params = getCurrentInstance().router?.params || {};
    const { uname, uid, roomId: _roomId } = params;
    const roomId = Number(_roomId);

    // 如果 用户信息不正确则跳转回房间列表
    if (!uname || !uid || roomId == null) {
      await toast("用户信息不正确！", 1000);
      Taro.navigateTo({ url: "/pages/index/index" });
      return;
    }

    try {
      // 可能是刷新页面
      userStore.setUser({ uname });

      const joinData = {
        uname,
        uid,
        roomId,
        type: MsgType.Join,
        content: `${params.uname}进入房间`,
      };

      console.log({ joinData });

      // 等到房间信息初始化完成后再关闭 loading
      Taro.showLoading();
      // 向其他用户广播进入房间通知
      const msg = await wsStore.promiseSend(joinData);

      const { roomError } = msg || {};

      // 确认加入成功后进入房间
      if (roomError) {
        await toast(roomError, 1000);
        Taro.navigateTo({ url: "/pages/index/index" });
        return;
      }
      this.initRoomInfo(roomId!);
    } catch (error) {
      console.log(error);
    }
  };

  @action initRoomInfo = async (roomId: number) => {
    this.startStacking();
    const res = await axios({
      method: "get",
      url: "/api/room",
      params: {
        roomId,
      },
    });
    const room = res.data;
    const { msgList, ...roomInfo } = room;
    this.releaseStackingMsg(msgList);
    this.setRoomInfo(roomInfo);
    Taro.hideLoading();
  };

  disposes: Function[] = [];
  /** 监听远端消息 */
  @action listen = () => {
    this.root.wsStore.on(WsEvent.Onmessage, this.onRemoteMsg);
    this.root.wsStore.on(WsEvent.OnReconnected, this.onReconnect);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.disposes.push(
      this.root.wsStore.onMsg(MsgType.refresh_room_user, this.onRefreshRoomUser)
    );
  };
  /** 取消监听远端消息 */
  @action removeListener = () => {
    this.root.wsStore.off(WsEvent.Onmessage, this.onRemoteMsg);
    this.root.wsStore.off(WsEvent.OnReconnected, this.onReconnect);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    this.disposes.forEach((fn) => fn());
  };

  stackingMsg: Msg[] = [];
  isStacking = false;
  startStacking = () => (this.isStacking = true);
  @action onReconnect = async () => {
    console.log("发送重连消息");
    this.startStacking();
    const { content: listToBePush } = await this.root.wsStore.promiseSend({
      type: MsgType.reconnect,
      content: {
        roomId: this.roomInfo.roomId,
        lastMsgId: last(this.msgList)?.msgId,
      },
    });
    this.releaseStackingMsg(listToBePush);
  };

  releaseStackingMsg = (fetchedList: Msg[] = []) => {
    // 把原列表，接口获取到的列表，ws堆积的消息列表 合并
    this.setMsgList([...this.msgList, ...fetchedList, ...this.stackingMsg]);
    this.delayGotoBottom();
    this.stackingMsg = [];
    this.isStacking = false;
  };

  @action onRemoteMsg = (msg: Msg) => {
    if (isChatMsg(msg)) {
      // 避免请求获取的消息列表 和 ws 来的消息 出现顺序颠倒瞬间
      if (this.isStacking) {
        this.stackingMsg.push(msg);
      } else {
        this.setMsgList([...this.msgList, msg]);
        this.showNewMsgBtn();
      }
    }
  };

  // 把新的 userList 获取到
  @action onRefreshRoomUser = (msg: Msg) => {
    const userList = msg.content;
    this.setRoomInfo({ userList });
  };

  /*----------------- 输入框 -----------------*/
  @observable input: string = "";

  @action setInput = (input: string) => {
    this.input = input;
  };

  @action sendMsg = () => {
    const { uname, uid } = this.root.userStore.user;
    this.root.wsStore.send({
      uname,
      uid,
      type: MsgType.Text,
      content: this.input,
      roomId: this.roomInfo.roomId,
    });
    this.setInput("");
  };

  @action onBeforeUnload = () => {
    this.leave(false);
  };

  @action leave = (isBtnClose: boolean) => {
    const { uname, uid } = this.root.userStore.user;
    this.root.wsStore.send({
      uname,
      uid,
      type: MsgType.Leave,
      content: `${uname}离开房间`,
      roomId: this.roomInfo.roomId,
    });
    if (isBtnClose) {
      Taro.navigateTo({ url: "/pages/index/index" });
    }
  };

  @observable btnVisible = false;

  @action setBtnVisible = (btnVisible: boolean) => {
    this.btnVisible = btnVisible;
  };

  dom: HTMLDivElement | null;
  saveDom = (r: HTMLDivElement | null) => {
    if (r !== this.dom) {
      // 不相等则前一个 dom 的事件应该被移除
      this.dom?.removeEventListener("wheel", this.onUserScroll);
      this.dom?.removeEventListener("touchmove", this.onUserScroll);

      // 新的dom添加事件（组件销毁时， ref=null），则这个时候前一个dom的时间监听已被取消
      r?.addEventListener("wheel", this.onUserScroll);
      r?.addEventListener("touchmove", this.onUserScroll);
      this.dom = r;
    }
  };
  /** 滚动触底取消按钮显示 */
  @action onScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    e.persist();
    const dom: HTMLDivElement = e.target as any;
    this.throttledScroll(dom);
  };

  @action throttledScroll = throttle((dom: HTMLDivElement) => {
    const { scrollTop, clientHeight, scrollHeight } = dom;

    const needHide = apEq(scrollTop + clientHeight!, scrollHeight!, 60);
    if (needHide) {
      this.setBtnVisible(false);
    }
  }, 300);
  autoScroll = true;
  autoScrollTimer: NodeJS.Timeout;
  onUserScroll = throttle(() => {
    // 滚动时重置非自动滚动状态，1秒后恢复
    this.autoScroll = false;
    clearTimeout(this.autoScrollTimer);
    this.autoScrollTimer = setTimeout(() => {
      this.autoScroll = true;
    }, 1000);
  }, 300);

  /** 接到消息时显示滚动触底按钮 */
  @action showNewMsgBtn = () => {
    console.log("接到消息", this.dom);
    if (!this.dom) {
      return;
    }
    const { scrollTop, clientHeight, scrollHeight } = this.dom || {};

    // 可视区最底部内容，距离底部内容剩半屏幕，则提示有新消息，否则自动滚动到底部
    const needShow = scrollHeight! - scrollTop > clientHeight! * 2;
    // 超出可视区，或处于非自动滚动状态，则提示有新消息
    if (needShow || !this.autoScroll) {
      this.setBtnVisible(true);
    } else {
      this.delayGotoBottom();
    }
  };

  scrollIntoView = (el: HTMLDivElement, block: ScrollLogicalPosition) => {
    console.log({ block });

    if (el) {
      const top = block === "end" ? el.scrollHeight - el.clientHeight : 0;

      el.scrollTo({
        top,
        behavior: "smooth",
      });
    }
  };
  @action delayGotoBottom = (time = 100) => {
    setTimeout(() => {
      this.gotoBottom();
    }, time);
  };

  @action gotoBottom = () => {
    if (!this.dom) {
      return;
    }
    this.scrollIntoView(this.dom, "end");
    this.setBtnVisible(false);
  };
}
