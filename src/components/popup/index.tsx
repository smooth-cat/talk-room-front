import Taro, { FC } from "@tarojs/taro";
import { View } from "@tarojs/components";
import "./index.scss";
import { ReactNode, useRef, useState } from "react";
import { usePopPos } from "@/hooks/use-menu";

export type IPopupProps = {
  popContent: ReactNode;
};

const Popup: FC<IPopupProps> = ({ children, popContent }) => {
  const [visible, setVisible] = useState(false);
  const { realPosition, moveToPos, domRef } = usePopPos(visible);

  const btnRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    const { left, top, height, width } =
      btnRef.current?.getBoundingClientRect?.() || {};
    if (left == null || top == null || height == null || width == null) {
      return;
    }
    moveToPos([{ left: left + width, top: top + height }], ([pos]) => {
      return pos.leftBottom!;
    });
    setVisible((v) => !v);
  };

  return (
    <View className="popup">
      <div ref={btnRef} className="popup-child" onClick={handleToggle}>
        {children}
      </div>
      <div style={{...realPosition}}>
        <div className="pop-content" style={{ opacity: visible ? 1 : 0, height: visible ? domRef.current?.offsetHeight : 0 }}>
          <div ref={domRef}>
            {popContent}
          </div>
        </div>
      </div>
    </View>
  );
};

export default Popup;
