import Taro, { FC } from "@tarojs/taro";
import { View } from "@tarojs/components";
import "./index.scss";
import Popup from "@/components/popup";
import Icon from "@/components/icon";
import Drawer from "@/components/drawer";
import { useState } from "react";

export type IUserListProps = {
  li: any[];
};

const UserList: FC<IUserListProps> = ({ li = [] }) => {
  const list = li.slice(0, 3);

  const totalLen = li.length;
  const len = list.length;

  const [visible, setVisible] = useState(false);

  return (
    <View className="user-list">
      {/* <Popup popContent="123">
        <View className="user-list-child">
          <View className="user-list-list">
            {list.map((it, i) => {
              const avatar = it.uname.slice(0, 1);
              return (
                <View className="avatar" style={{ zIndex: len - i, backgroundColor: it.color }}>
                  {avatar}
                </View>
              );
            })}
          </View>
          {totalLen > 3 && <Icon color="#3d3d3d" className="icon-more" size={50} />}
        </View>
      </Popup> */}
      <View className="user-list-child" onClick={() => setVisible(true)}>
        <View className="user-list-list">
          {list.map((it, i) => {
            const avatar = it.uname.slice(0, 1);
            return (
              <View
                className="avatar"
                style={{ zIndex: len - i, backgroundColor: it.color }}
              >
                {avatar}
              </View>
            );
          })}
        </View>
        {totalLen > 3 && (
          <Icon color="#3d3d3d" className="icon-more" size={50} />
        )}
      </View>
      <Drawer
        title="房间成员"
        visible={visible}
        onClose={() => setVisible(false)}
      >
        <View className="detail-list">
          {list.map((it, i) => {
            const avatar = it.uname.slice(0, 1);
            return (
              <View className="detail-item">
                <View
                  className="avatar"
                  style={{ zIndex: len - i, backgroundColor: it.color }}
                >
                  {avatar}
                </View>
                <View className="u-info" style={{ color: it.color }}>
                  <div className="label"><span>昵</span><span>称</span></div>
                  {/* </div> */}
                  <View >:</View>
                  <View className="uname">{it.uname}</View>
                  <div className="label"><span>U</span><span>I</span><span>D</span></div>
                  <View >:</View>
                  <View className="uid">{it.uid}</View>
                </View>
              </View>
            );
          })}
        </View>
      </Drawer>
    </View>
  );
};

export default UserList;
