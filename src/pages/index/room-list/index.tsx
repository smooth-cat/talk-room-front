import Taro, { FC } from "@tarojs/taro";
import { Button, Input, View } from "@tarojs/components";
import "./index.scss";
import { useAsync, useCounter } from "react-use";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { store } from "@/store/root";
import { WsEvent, WsStatus } from "@/store/ws";
import { Msg, MsgType } from "@/type/msg";
import { observer } from "mobx-react";
import qs from "query-string";
export type IRoomListProps = {
  /** 设置后进入 */
  setRoomQuery: (query: any) => void;
};

const RoomList: FC<IRoomListProps> = observer(({}) => {
  const { wsStore, userStore } = store;

  const {
    user: { uid, uname },
    setUser,
  } = userStore;
  const [refreshFLag, { inc }] = useCounter(1);

  const { value: list = [] } = useAsync(async () => {
    const res = await axios({
      method: "get",
      url: "/api/roomList",
    });
    return res.data as any[];
  }, [refreshFLag]);

  const createRoom = async () => {
    const res = await axios({
      method: "post",
      url: "/api/roomCreate",
      data: {
        roomName: `${uname}的房间`,
      },
    });
    const { roomId } = res.data;
    join(roomId);
  };

  const join = (roomId: string) => {
    Taro.navigateTo({
      url: `/pages/room/index?${qs.stringify({ uid, uname, roomId })}`,
    });
    // try {
    //   userStore.setUser({ uname: latestName.current });

    //   const joinData = {
    //     uname: latestName.current,
    //     uid,
    //     roomId,
    //     type: MsgType.Join,
    //     content: `${latestName.current}进入房间`
    //   };

    //   console.log({ joinData });
    //   // 向其他用户广播进入房间通知
    //   wsStore.send(joinData);

    //   function onJoinSuccess(msg: Msg) {
    //     const { type, uid: joinedUid, roomId } = msg || {};
    //     // 确认加入成功后进入房间
    //     if(type === MsgType.Join && joinedUid === uid) {
    //       wsStore.off(WsEvent.Onmessage, onJoinSuccess)
    //       setRoomQuery({
    //         roomId,
    //         uid,
    //         uname: latestName.current,
    //       })
    //     }
    //   }
    //   wsStore.on(WsEvent.Onmessage, onJoinSuccess)
    // } catch (error) {
    //   console.log(error);
    // }
  };

  // 实时更新房间信息
  useEffect(() => {
    function refreshRoomList(msg) {
      const type = msg?.type;
      // 触发获取房间列表接口
      if (type === MsgType.refresh_room_list) {
        inc();
      }
    }

    wsStore.on(WsEvent.Onmessage, refreshRoomList);
    return () => {
      wsStore.off(WsEvent.Onmessage, refreshRoomList);
    };
  }, []);

  const latestName = useRef("");

  return (
    <View className="room-list-page">
      <View>
        <Input
          placeholder="请输入用户名"
          value={uname}
          onInput={(e) => {
            setUser({ uname: e.detail.value });
            latestName.current = e.detail.value;
          }}
        />
      </View>
      <Button onClick={createRoom}>创建房间</Button>
      {list?.length ? (
        <View className="room-list">
          {list.filter(it => it).map((it) => (
            <View
              key={it.roomId}
              className="room-item"
              onClick={() => join(it.roomId)}
            >
              <View>{it.roomName}</View>
              <View className="member-count">{it.userList.length}人</View>
            </View>
          ))}
        </View>
      ) : (
        <View className="empty-text">还没有房间快来创建吧</View>
      )}
    </View>
  );
});

export default RoomList;
