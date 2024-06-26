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
  const [realPosition, setRealPosition] =
    useSetState<CSSProperties>(DEFAULT_STYLE);

  const popRef = useRef<HTMLDivElement>(null);

  const btnRef = useRef<HTMLDivElement>(null);

  const moveToPos = (direction: PopDirection) => {
    // debugger
    if(!btnRef.current! || !popRef.current) return;
    const res = boxMountDetect(btnRef.current, popRef.current);
    if(res === false) return;
    const { mountPos, existPoint } = res;
    const point = mountPos[direction] || existPoint;
    if(point) {
      setRealPosition({ ...point });
    }
  };

  const hide = () => {
    setRealPosition(DEFAULT_STYLE);
  };

  return {
    realPosition: {
      ...realPosition,
      userSelect: (visible ? "auto" : "none") as any,
    },
    popRef,
    btnRef,
    moveToPos,
    hide,
  };
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

export type PopDirection =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "leftTop"
  | "leftBottom"
  | "rightTop"
  | "rightBottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

const boxMountDetect = (
  box: HTMLElement,
  popDom: HTMLElement,
) => {
  // 获取 8 个点位
  const { top, left, height, width } = box.getBoundingClientRect();

  if(left == null || top == null || height == null || width == null) {
    return false;
  }

  const pos: Record<string, [number, number]> = {
    "leftTop": [left, top],
    "top": [left+width/2, top],
    "rightTop": [left+width, top],
    "right": [left+width, top+height/2],
    "rightBottom": [left+width, top+height],
    "bottom": [left+width/2, top+height],
    "leftBottom": [left, top+height],
    "left": [left, top+height/2],
}

  // 获取 弹出 dom 的宽高
  const { width: pWidth, height: pHeight } = popDom.getBoundingClientRect();
  // 如果宽高不存在
  if (
    [width, height].some((it) => !it) 
  ) {
    return false;
  }

  const mountPos = {
    "left": dotMountDetect(...pos.left, pWidth, pHeight, 'left'),
    "right": dotMountDetect(...pos.right, pWidth, pHeight, 'right'),
    "top": dotMountDetect(...pos.top, pWidth, pHeight, 'top'),
    "bottom": dotMountDetect(...pos.bottom, pWidth, pHeight, 'bottom'),
    // 左侧上方 -> 挂载在点的左下方
    "leftTop": dotMountDetect(...pos.leftTop, pWidth, pHeight, 'leftBottom'),
    // 左侧下方 -> 挂载在点的左上方
    "leftBottom": dotMountDetect(...pos.leftBottom, pWidth, pHeight, 'leftTop'),
    // 右侧上方 -> 挂载在点的右下方
    "rightTop": dotMountDetect(...pos.rightTop, pWidth, pHeight, 'rightBottom'),
    // 右侧下方 -> 挂载在点的右上方
    "rightBottom": dotMountDetect(...pos.rightBottom, pWidth, pHeight, 'rightTop'),
    // 上侧左边 -> 挂载在点的右上方
    "topLeft": dotMountDetect(...pos.leftTop, pWidth, pHeight, 'rightTop'),
    // 上侧右边 -> 挂载在点的左上方
    "topRight": dotMountDetect(...pos.rightTop, pWidth, pHeight, 'leftTop'),
    // 下侧左边 -> 挂载在点的右下方
    "bottomLeft": dotMountDetect(...pos.leftBottom, pWidth, pHeight, 'rightBottom'),
    // 下侧右边 -> 挂载在点的左下方
    "bottomRight": dotMountDetect(...pos.rightBottom, pWidth, pHeight, 'leftBottom'),
  };
  let existPoint: IPos | undefined= undefined;
  for (const key in mountPos) {
    if(mountPos[key]) {
      existPoint = mountPos[key];
      break;
    }
  }

  return {
    mountPos,
    existPoint,
  }
}

/** 边界检测，右下、左下、右上、左上*/
const dotMountDetect = (
  left: number,
  top: number,
  width: number,
  height: number,
  type: PopDirection
) => {
  const wW = window.innerWidth;
  const wH = window.innerHeight;

  const leftAble = left - width >= 0;
  const rightAble = left + width <= wW;
  const topAble = top - height >= 0;
  const bottomAble = top + height <= wH;

  const halfLeftAble = left - width / 2 >= 0;
  const halfRightAble = left + width / 2 <= wW;
  const halfTopAble = top - height / 2 >= 0;
  const halfBottomAble = top + height / 2 <= wH;

  switch (type) {
    case "left":
      if (leftAble && halfTopAble && halfBottomAble)
        return { left: left - width, top: top - height / 2 };
      break;
    case "right":
      if (rightAble && halfTopAble && halfBottomAble)
        return { left: left, top: top - height / 2 };
      break;
    case "top":
      if (topAble && halfLeftAble && halfRightAble)
        return { left: left - width / 2, top: top - height };
      break;
    case "bottom":
      if (bottomAble && halfLeftAble && halfRightAble)
        return { left: left - width / 2, top: top };
      break;
    case "leftTop":
      if (leftAble && topAble) return { left: left - width, top: top - height };
      break;
    case "leftBottom":
      if (leftAble && bottomAble) return { left: left - width, top };
      break;
    case "rightTop":
      if (rightAble && topAble) return { left, top: top - height };
      break;
    case "rightBottom":
      if (rightAble && bottomAble) return { left, top };
      break;
  }
};
