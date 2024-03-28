import Taro, { FC } from "@tarojs/taro";
import { View, ViewProps } from "@tarojs/components";
import "./index.scss";
import { ReactNode } from "react";
import Icon from "../icon";

export type IDrawerProps = {
  visible: boolean;
  title: ReactNode;
  onClose?: () => void;
};

const Drawer: FC<IDrawerProps> = ({ children, visible, onClose, title }) => {
  const modalVisiblePos = {
    left: 0,
    top: 0,
  };
  const modalUnVisiblePos = {
    left: '99999px',
    top: '99999px',
  };

  const mainVisibleTrans = "translateX(0%)";
  const mainUnVisibleTrans = "translateX(100%)";

  const handleModelClick: ViewProps["onClick"] = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    <View
      onClick={handleModelClick}
      className="drawer-modal"
      style={visible ? {...modalVisiblePos} : {...modalUnVisiblePos}}
    >
      <View
        className="drawer-main"
        style={{ transform: visible ? mainVisibleTrans : mainUnVisibleTrans }}
      >
        <View className="drawer-title">
          <Icon className="icon-close"  onClick={() => onClose?.()} size={46} color="#505050" />
          {title}
        </View>
        <View className="drawer-body">{children}</View>
      </View>
    </View>
  );
};

export default Drawer;
