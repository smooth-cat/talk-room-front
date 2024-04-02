import { msg2Text, text2Msg } from "@/tools/msg-parse";
import { RootStore } from "./root";
import { Msg, MsgType } from "@/type/msg";
import Eventemitter from "eventemitter3";
import { action, observable } from "mobx";
import { pick } from "lodash";
import { DateString } from "@/tools/date";
import { v4 } from "uuid";
export enum CloseCode {
  /** 心跳丢失 */
  HeartbeatLost = 4998,
  /** 正常手动关闭 参考 https://developer.mozilla.org/zh-CN/docs/Web/API/CloseEvent */
  Normal = 1000,
}

export type PromiseTrigger = {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
};

export enum WsEvent {
  Onopen = "onopen",
  Onmessage = "onmessage",
  Onerror = "onerror",
  Onclose = "onclose",
  OnReconnected = "onReconnected",
}

export enum WsStatus {
  Connecting = "connecting",
  Opened = "opened",
  Errored = "errored",
  Closed = "closed",
  HeartbeatLost = "heartbeatLost",
}

/** 判断是否是来哦缇娜消息 */
export const isChatMsg = (msg: Msg) => {
  return msg.type[0] === msg.type[0].toUpperCase();
};

export type WebSocketEvents = Partial<
  Pick<WebSocket, "onopen" | "onclose" | "onerror">
> & {
  onmessage?: (msg: Msg) => void;
  onLoginSuccess?: (msg: Msg) => void;
};

const DefaultOpt = {
  /** 心跳达到该次数则确认连接中断，关闭 websocket */
  maxHeartbeatLoseCount: 3,
  /** 限制在心跳发送后多少秒内 服务端必须返回确认，否则算心跳过期 */
  singleHeartbeatTimeout: 5000,
  /** 心跳检测间隔时间 */
  heartbeatInterval: 5000,
  /** 重连时间间隔 */
  reconnectInterval: 5000,
  /** 是否自动连接 */
  autoReconnect: true,
};
export type ConnectOpt = typeof DefaultOpt;

export type Heartbeat = {
  id: number;
  timer: NodeJS.Timeout;
};

export class WsStore extends Eventemitter {
  constructor(private root: RootStore) {
    super();
  }

  @observable wsStatus: WsStatus = WsStatus.Closed;
  @action setWsStatus = (wsStatus: WsStatus) => {
    this.wsStatus = wsStatus;
  };

  socket: WebSocket;
  /** 通过控制器来取消断连 socket 的事件监听 */
  abortController: AbortController;
  opt: ConnectOpt = DefaultOpt;

  url = "";
  /**
   * @param url 连接地址
   * @param opt 可选参数
   */
  connect = (url: string, opt: Partial<ConnectOpt> = {}) => {
    this.setWsStatus(WsStatus.Connecting);
    // TODO: 是否需要延迟检测
    this.opt = { ...DefaultOpt, ...opt };
    this.url = url;
    this.socket = new WebSocket(url);
    this.abortController = new AbortController();

    // socket.onmessage = this.onmessage;
    // socket.onopen = this.onopen;
    // socket.onerror = this.onerror;
    // socket.onclose = this.onclose;
    ["message", "open", "error", "close"].forEach((event) => {
      this.socket.addEventListener(event, this[`on${event}`], {
        signal: this.abortController.signal,
      });
    });
  };

  /**
   * @param code 关闭code，CloseCode 枚举
   * @param reason 关闭原因
   */
  close = (
    code: number = CloseCode.Normal,
    reason = "用户手动关闭了 websocket"
  ) => {
    if (
      [this.socket.CLOSED, this.socket.CLOSING].includes(
        this.socket.readyState as any
      )
    ) {
      return;
    }
    this.socket.close(code, reason);
  };

  reconnectCount = 0;
  failedWebsocket: WebSocket;
  /*----------------- 重连WS -----------------*/
  reconnect = (e: any) => {
    // 对同一个 websocket 对象 在重连了就不要再触发一次了
    if (e.target === this.failedWebsocket) {
      return;
    }
    // 记录当前失败的 websocket
    this.failedWebsocket = e.target;
    // 快照
    const logMsg = pick(this, ["wsStatus", "reconnectCount"]);
    this.resetStore();
    // 断网第一次则立刻进行重连
    if (this.reconnectCount === 0) {
      console.warn("重连", logMsg);
      this.connect(this.url, this.opt);
    } else {
      setTimeout(() => {
        console.warn("重连", logMsg);
        this.connect(this.url, this.opt);
      }, this.opt.reconnectInterval);
    }
    this.reconnectCount++;
  };

  /** 重连成功处理 */
  onReconnectSuccess = (e: any) => {
    console.log("ws重连触发", e);
    e.reconnectCount = this.reconnectCount;
    this.emit(WsEvent.OnReconnected, e);
    this.reconnectCount = 0;
  };

  resetStore = () => {
    this.abortController.abort();
    // this.removeAllListeners();
    this.clearHeartbeatCheck();
  };

  /*----------------- 原生 WebSocket 事件处理 -----------------*/
  onopen = (e) => {
    this.setWsStatus(WsStatus.Opened);
    console.log("ws连接成功", e.target);
    //  连接成功时，重连次数不是0，则说明这次连接是重连
    if (this.reconnectCount !== 0) {
      this.onReconnectSuccess(e);
    }
    this.startHeartbeat();
    this.emit(WsEvent.Onopen, e);
  };
  onmessage: WebSocket["onmessage"] = (e) => {
    const msg = text2Msg(e.data);
    if (msg.requestId) {
      this.promiseList.get(msg.requestId)?.resolve(msg);
      this.promiseList.delete(msg.requestId);
    }
    if (msg.type === MsgType.heartbeat) {
      this.onHeartbeat(msg.content);
      return;
    }
    console.log({ onmessage: msg });
    this.emit(WsEvent.Onmessage, msg);
  };
  onMsg = (types: (MsgType[]|MsgType), callback: (msg: Msg, matchIndex: number) => any) => {
    types = typeof types === 'string' ? [types] : types;
    function handleMsg(msg: Msg) {
      const type = msg.type;
      const matchIndex = types.indexOf(type);
      if(matchIndex !== -1) {
        callback(msg, matchIndex);
      }
    }
    this.on(WsEvent.Onmessage,handleMsg);
    return () => {
      this.off(WsEvent.Onmessage,handleMsg);
    }
  }
  onerror: WebSocket["onerror"] = (e) => {
    this.setWsStatus(WsStatus.Errored);
    console.log("ws连接出错", e);
    this.opt.autoReconnect && this.reconnect(e);
    this.emit(WsEvent.Onerror, e);
  };
  onclose = (e) => {
    this.setWsStatus(WsStatus.Closed);
    console.log("ws关闭成功", e);
    // TODO: 判断是否手动关闭
    this.emit(WsEvent.Onclose, e);
    if (e.code !== CloseCode.Normal) {
      this.opt.autoReconnect && this.reconnect(e);
    }
  };

  send = (msg: Msg) => {
    const dataString = msg2Text({
      ...msg,
      timestamp: DateString("YYYY/MM/DD HH:mm:ss"),
      requestId: msg.requestId || v4(),
    });
    switch (this.wsStatus) {
      // 正在连接则等待连接时再
      case WsStatus.Connecting:
        // TODO: 一直连不上可能需要取消
        this.once(WsEvent.Onopen, () => this.socket.send(dataString));
        return true;
      // 如果处于连接状态就发送
      case WsStatus.Opened:
        this.socket.send(dataString);
        return true;
      // 关闭状态则直接返回 false
      case WsStatus.Closed:
      case WsStatus.Errored:
      case WsStatus.HeartbeatLost:
        return false;
    }
  };

  promiseList = new Map<string, PromiseTrigger>();
  promiseSend = (msg: Msg) => {
    const requestId = v4();
    return new Promise<Msg>((resolve, reject) => {
      this.promiseList.set(requestId, { resolve, reject });
      this.send({ ...msg, requestId });
      // 15秒未收到则视为请求过期
      setTimeout(() => {
        reject();
      }, 15 * 1000);
    });
  };

  heartbeatList: Heartbeat[] = [];
  heartbeatId = 0;
  heartbeatInterval: NodeJS.Timeout;
  /*----------------- 心跳检测机制 -----------------*/
  startHeartbeat = () => {
    const fn = () => {
      this.sendHeartbeat();
    };
    fn();
    this.heartbeatInterval = setInterval(fn, this.opt.heartbeatInterval);
  };

  /** 发送心跳+超时检测 */
  sendHeartbeat = () => {
    const msg: Msg = {
      type: MsgType.heartbeat,
      content: this.heartbeatId,
    };
    this.send(msg);

    const timer = setTimeout(() => {
      // 如果当前已经超过了心跳上限则触发失去心跳
      if (this.heartbeatList.length >= this.opt.maxHeartbeatLoseCount) {
        this.onHeartbeatLost();
      }
    }, this.opt.singleHeartbeatTimeout);

    this.heartbeatList.push({
      id: this.heartbeatId,
      timer,
    });

    this.heartbeatId++;
  };

  /** 清除所有心跳检测定时 */
  clearHeartbeatCheck = () => {
    clearInterval(this.heartbeatInterval);
    // 避免失去心跳重复触发
    this.heartbeatList.forEach((it) => {
      clearTimeout(it.timer);
    });
    this.heartbeatList = [];
    this.heartbeatId = 0;
  };

  /** 失去心跳后直接关闭 websocket */
  onHeartbeatLost = () => {
    // 最终状态还是会变成 WsStatus.Closed
    this.setWsStatus(WsStatus.HeartbeatLost);
    this.clearHeartbeatCheck();
    // 关闭 websocket
    this.close(CloseCode.HeartbeatLost);
  };

  /** 收到服务端心跳 pong */
  onHeartbeat = (heartbeatId: number) => {
    // 当一个新的心跳检测通过时，之前的心跳则可以清除
    this.heartbeatList.filter((it) => {
      const isOkHeartbeat = it.id <= heartbeatId;
      // 清除之前未完成的心跳检测
      if (isOkHeartbeat) {
        clearTimeout(it.timer);
      }
      return !isOkHeartbeat;
    });
  };
}
