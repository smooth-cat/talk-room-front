import React, { CSSProperties, FC, ReactElement } from "react";
import { View } from "@tarojs/components";
import "./ag-ratio-box.scss";

export enum ResizeMode {
  FillWrapper,
  WidthFix,
}

export type IAgRatioBoxProps = {
  /** 宽 注意如果是相对单位请用 rpx */
  width: string;
  /** 宽 / 高 */
  ratio: number;
  /** className名 */
  className?: string;
  /** 样式 */
  style?: CSSProperties;
  mode?: ResizeMode;
  pos?: [string, string];
  children: ReactElement;
};

export const RatioBox: FC<IAgRatioBoxProps> = ({
  width,
  ratio,
  children,
  style,
  className = "",
  mode = ResizeMode.FillWrapper,
  pos = ["left", "top"],
}) => {
  const horizontalPos =
    pos[0] === "left"
      ? { left: 0 }
      : pos[0] === "right"
      ? { right: 0 }
      : pos[0] === "center"
      ? {
          left: "50%",
        }
      : {};
  const verticalPos =
    pos[1] === "top"
      ? { top: 0 }
      : pos[1] === "bottom"
      ? { bottom: 0 }
      : pos[1] === "center"
      ? {
          top: "50%",
        }
      : {};

  const transformValue =  (pos[0] === 'center' ? 'translateX(-50%)' : '') + ' '+ (pos[1] === 'center' ? 'translateY(-50%)' : '');

  const modeStyleMap = {
    [ResizeMode.FillWrapper]: {
      width: "100%",
      height: "100%",
    },
    [ResizeMode.WidthFix]: {
      width: "100%",
    },
  };

  const childSize = modeStyleMap[mode];

  const childStyle = {
    position: "absolute",
    ...horizontalPos,
    ...verticalPos,
    ...childSize,
    transform: transformValue,
    overflow: 'hidden',
  };

  const sourceStyle = children?.props?.style || {};

  return (
    <View
      className={`ag-ratio-box-wrapper ${className}`}
      style={{ ...style, width }}
    >
      <View
        className="ag-ratio-box-placeholder"
        style={{ paddingTop: `calc(100% / ${ratio})` }}
      />
      <View className="ag-ratio-box-content">
        {React.cloneElement(children, {
          ...children.props,
          style: { ...childStyle, ...sourceStyle },
        })}
      </View>
    </View>
  );
};
