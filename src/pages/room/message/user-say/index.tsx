import Taro, { FC } from "@tarojs/taro";
import { View, Text } from "@tarojs/components";
import { observer } from "mobx-react";
import { store } from "@/store/root";
import { Msg } from "@/type/msg";
import "./index.scss";
import { ReactNode } from "react";

export type IUserSayProps = {
  children: ReactNode;
} & Msg;

const UserSay: FC<IUserSayProps> = observer(
  ({ uname, uid, timestamp, children, color='black' }) => {
    const { userStore, roomStore } = store;
    const selfUid = userStore.user?.uid;
    const isSelf = uid === selfUid;
    // const  userList: any[] = roomStore.roomInfo.userList || [];
    // const  userColor = userList.find((user) => user.uid === uid)?.color || 'black';

    const alignSelf = isSelf ? "flex-end" : "flex-start";
    const flexDirection = isSelf ? "row-reverse" : "row";
    const textAlign = isSelf ? 'right' : 'left';
    const avatar = uname?.slice(0,1);

    return (
      <View className="user-say-wrap">
        <View className="msg-user-say" style={{ alignSelf, flexDirection }}>
          <View className="avatar" style={{ backgroundColor: color }} >{avatar}</View>
          <View className="title-content">
            <View
              className="msg-user-say-title"
              style={{ alignSelf, flexDirection }}
            >
              <Text className="msg-user-say-name" style={{ color }} >{uname}</Text>
              <Text className="msg-user-say-time">{timestamp}</Text>
            </View>
            <View className="msg-user-say-content" style={{ textAlign }} >{children}</View>
          </View>
        </View>
      </View>
    );
  }
);

export default UserSay;
