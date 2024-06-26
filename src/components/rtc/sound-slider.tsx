import Taro, { FC } from "@tarojs/taro";
import { ITouchEvent, View } from "@tarojs/components";
import "./sound-slider.scss";
import { ReactNode, useEffect, useRef, useState } from "react";
import { limitRange } from "@/tools";

export type ISoundSliderProps = {
  trackHeight: number;
  volume: number;
  muted: boolean;
  zeroIcon?: ReactNode;
  soundIcon?: ReactNode;
  mutedIcon?: ReactNode;
  setVolume?: (volume: number) => void;
  setMuted?: (muted: boolean) => void;
};

const SoundSlider: FC<ISoundSliderProps> = ({
  trackHeight,
  volume,
  muted,
  zeroIcon,
  soundIcon,
  mutedIcon,
  setVolume,
  setMuted,
}) => {
  const blockHeight = 32;
  const validBottom = trackHeight - blockHeight;
  const isZero = volume === 0;

  
  const [bottom, setBottom] = useState(() => (validBottom != null && volume != null) ? validBottom * volume : 0);
  
  
  const initRef = useRef(false);

  // 初始化 bottom
  useEffect(() => {
    if(validBottom != null && volume != null && !initRef.current) {
      setBottom(validBottom * volume);
      initRef.current = true;
    }
  }, [volume, validBottom]);
  
  const solidColor = 'black';
  const dashColor = 'rgb(154 154 154)'
  const trackColor = `linear-gradient(to top, ${solidColor} 0%, ${solidColor} ${volume * 100}%, ${dashColor} ${volume * 100}%, ${dashColor} 100%)`

  const { clickTrack,...props} = useBlockTouch(validBottom, bottom, setBottom, setVolume!);

  return (
    <View className="sound-slider-wrapper">
      <div className="sound-slider-area" >
        <div className="sound-slider-track" onClick={clickTrack} style={{ height: Taro.pxTransform(trackHeight), background: trackColor }}></div>
        <View
          className="sound-slider-block"
          style={{ bottom: Taro.pxTransform(bottom), transform: "translateX(-50%)" }}
          {...props}
        ></View>
      </div>
      {/* <View className="sound-slider-icon">
        {muted ? mutedIcon : isZero ? zeroIcon : soundIcon}
      </View> */}
    </View>
  );
};

const useBlockTouch = (validBottom: number, bottom: number, setBottom: (v: number) => void , setPercent: (v: number) => void ) => {

  const yRef = useRef<number|null>(null);
  /** 滑块ref */
  const blockRef: any = useRef();
  
  const clickTrack = (e) => {
    console.log('点击事件', e, blockRef.current);
    // 不能直接用 bottom 是因为 bottom 是换算 rem 前的单位，应该以实际显示单位进行移动判断
    const { top, height } = blockRef.current.getBoundingClientRect();
    const prevY = top + height/2;
    const clickY = e.clientY;
    onYUpdate(prevY, clickY);
  }

  const onTouchStart = (event: ITouchEvent) => {
    event.stopPropagation();
    yRef.current = event.touches?.[0].clientY;
    console.log('onTouchStart', event);
  }
  const onYUpdate = (prevY: number, y: number) => {
    
    const win = window.document.documentElement.getBoundingClientRect().width;

    // 设计稿是真实宽度的 rate 倍
    const rate = 750 / win;

    // 向下移动 -> 正数
    const delta = rate * (y - prevY);

    // 向下移动 percent 应该减少
    const newBottom = limitRange(bottom - delta, 0, validBottom) ;
    const newPercent = newBottom / validBottom;
    setBottom(newBottom);
    setPercent(newPercent);
  }

  const onTouchMove = (event: ITouchEvent) => {
    event.stopPropagation();
    const currentY = event.touches?.[0].clientY
    onYUpdate(yRef.current!, currentY);
    yRef.current = currentY;
  }
  const onTouchEnd = (event: ITouchEvent) => {
    event.stopPropagation();
    console.log('onTouchEnd', event);
    yRef.current = null
  }
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    clickTrack,
    ref: blockRef,
  }
}

export default SoundSlider;
