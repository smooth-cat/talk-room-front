import Taro, { FC } from "@tarojs/taro";
import { View } from "@tarojs/components";
import "./index.scss";
import { ReactNode, useRef, useState } from "react";
import { PopDirection, usePopPos } from "@/hooks/use-menu";
import { useEvent } from "react-use";

export type IOffset = {
  x?: number;
  y?: number;
}

export type IPopupProps = {
  popContent: ReactNode;
  direction?: PopDirection;
  offset?: IOffset;
  children: ReactNode | ((visible: boolean) => ReactNode);
};


const Popup: FC<IPopupProps> = ({ children, popContent, direction = 'top', offset={} }) => {
  const [visible, setVisible] = useState(false);
  const { realPosition, moveToPos, popRef, btnRef } = usePopPos(visible);

  const handleToggle = (e?: any) => {
    e?.stopPropagation();
    moveToPos(direction);
    setVisible((v) => !v);
  };

  const offsetX = offset.x ? Taro.pxTransform(offset.x) : 0;
  const offsetY = offset.y ? Taro.pxTransform(offset.y) : 0;
  const transform = `translate(${offsetX},${offsetY})`

  useEvent('click', (e) => {
    const dom = e.target as HTMLElement;
    // 点击位置不在弹出框则关闭
    if(!popRef?.current?.contains(dom)) {
      setVisible(false);
    }
  }, document.body)

  return (
    <View className="popup">
      <div ref={btnRef} className="popup-child" onClick={handleToggle}>
        {typeof children === 'function' ? children(visible) : children}
      </div>
      <div style={{...realPosition, transform: transform}}>
        <div className="pop-content" style={{ opacity: visible ? 1 : 0 }}>
          <div ref={popRef}>
            {popContent}
          </div>
        </div>
      </div>
    </View>
  );
};

export default Popup;
