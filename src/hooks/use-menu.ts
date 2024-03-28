import { CSSProperties, useRef } from "react";
import { useSetState } from "react-use";

export type IPos = {
  left: number;
  top: number;
};

export type IValidPos = {
  leftTop: IPos | null;
  rightTop: IPos | null;
  rightBottom: IPos | null;
  leftBottom: IPos | null;
};

export type IShowCallback = (validPosArr: IValidPos[]) => IPos;
const DEFAULT_STYLE: CSSProperties = {
  left: -9999,
  top: -9999,
  position: "fixed",
};
/** 用于计算弹出框真正位置 */
export const usePopPos = (visible: boolean) => {
  const [realPosition, setRealPosition] = useSetState<CSSProperties>(DEFAULT_STYLE);

  const domRef = useRef<HTMLDivElement>(null);

  const moveToPos = (detectPos: IPos[], cb: IShowCallback) => {
    const { width, height, left: currentLeft } = domRef.current?.getBoundingClientRect?.() || {};
    // 如果宽高不存在，或者已经完成位移就不要再做一遍了
    if ([width, height].some((it) => !it) || Math.abs(currentLeft||0 - Number(DEFAULT_STYLE.left)) < 10) {
      return;
    }
    const validPosArr = detectPos.map(({ left, top }) => {
      const detectRes = boundDetect(left, top, width!, height!);
      return detectRes;
    });

    const showPos = cb(validPosArr);
    setRealPosition({...showPos})
  };



  const hide = () => {
    setRealPosition(DEFAULT_STYLE);
  }

  return {
    realPosition: {...realPosition, userSelect: (visible ? 'auto' : 'none') as any},
    domRef,
    moveToPos,
    hide,
  }
};

/** 边界检测，右下、左下、右上、左上*/
const boundDetect = (
  left: number,
  top: number,
  width: number,
  height: number
) => {
  const wW = window.innerWidth;
  const wH = window.innerHeight;
  const leftAble = left - width >= 0;
  const rightAble = left + width <= wW;
  const topAble = top - height >= 0;
  const bottomAble = top + height <= wH;

  const validPos = {
    leftTop:
      leftAble && topAble ? { left: left - width, top: top - height } : null,
    rightTop: rightAble && topAble ? { left, top: top - height } : null,
    rightBottom: rightAble && bottomAble ? { left, top } : null,
    leftBottom: leftAble && bottomAble ? { left: left - width, top } : null,
  };

  return validPos;
};
