import Taro, { FC, useDidHide } from "@tarojs/taro";
import { Button, Input, ScrollView, View } from "@tarojs/components";
import "./index.scss";
import { useEffect, useLayoutEffect, useRef } from "react";
import { store } from "@/store/root";
import { Msg, MsgType } from "@/type/msg";
import Text from "./message/text";
import Notice from "./message/notice";
import { observer } from "mobx-react";
import Icon from "@/components/icon";
import UserList from "./user-list";
import { useDynamicCssVar } from "@/hooks/use-dynamic-css-var";
import { multipleColor } from "@/tools/color";
import { RTCRoom } from "@/components/rtc";

export type IRoomProps = {
  uid: string;
  uname: string;
  roomId: number;
};

const Room: FC<IRoomProps> = observer(({  }) => {
  const {
    wsStore,
    roomStore: {
      msgList,
      listen,
      removeListener,
      roomInfo,
      join,
      input,
      setInput,
      sendMsg,
      onBeforeUnload,
      lastMsgId,
      leave,
      saveDom,
      btnVisible,
      onScroll,
      gotoBottom,
      onUserScroll,
      setRtcVisible,
      rtcVisible,
    },
    userStore : {
      user
    },
  } = store;

  useEffect(() => {
    join();
    listen();
    
    return () => {
      removeListener();
    };
  }, []);

  const renderMsgItem = (msg: Msg) => {
    const { type } = msg;
    let node;
    switch (type) {
      case MsgType.Join:
      case MsgType.Leave:
      case MsgType.Notice:
        node = <Notice {...msg} />;
        break;
      case MsgType.Text:
        node = <Text {...msg} />;
        break;
      default:
        break;
    }
    return node ? (<View key={msg.msgId} id={'_'+msg.msgId} className="msg-item">{node}</View>) : <View key={msg.msgId} />
  };

  const userColor = roomInfo?.userList?.find(it => it.uid === user.uid)?.color || '#000000';
  const userColorLight = multipleColor(userColor, 1.1);
  const userColorDark = multipleColor(userColor, 0.9);
  
  const roomPageClass = 'room-page'
  useDynamicCssVar(roomPageClass, {
    '--user-color': userColor,
    '--user-color-light': userColorLight,
    '--user-color-dark': userColorDark,
  })

  useDidHide(() => {
    console.log('触发didhide');
  })


  const startVideoChat = useRef<() => any>(() => {});
  return (
    <View className={roomPageClass}>
      <View className="room-title">
        <Icon
          color="#363636"
          className="icon-likai leave"
          size={60}
          onClick={() => leave(true)}
        />
        <View className="room-name">{roomInfo?.roomName || ""}</View>
        <UserList li={roomInfo.userList} />
      </View>
      <div className="msg-list-wrap">
        <div ref={saveDom} className="msg-list" onScroll={onScroll}>
          {msgList.map((it) => {
            return renderMsgItem(it);
          })}
        </div>
        {btnVisible && (
          <View className="goto-bottom-btn" onClick={gotoBottom}>
            有新消息 <Icon className="icon-xia" size={40} />
          </View>
        )}
      </div>
      <View className="send-util">
        <Icon
          color={userColor}
          className="icon-plus-border send-util-exit"
          size={60}
          onClick={() => startVideoChat.current()}
        />
        <RTCRoom startVideoChat={startVideoChat} uids={(roomInfo.userList || []).map(it => it.uid)}  />
        <input
          className="send-util-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyUp={(e) => {
            e.key === "Enter" && sendMsg();
          }}
          placeholder="请输入"
        />

        <Icon
          color={userColor}
          className="icon-a-17Afasong send-util-send"
          size={60}
          onClick={sendMsg}
        ></Icon>
      </View>
    </View>
  );
});

export default Room;
