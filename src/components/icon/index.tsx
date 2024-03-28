import Taro, { FC } from '@tarojs/taro';
import { View, ViewProps } from '@tarojs/components';
import './index.scss';

export type IIconProps = {
  size: number;
  color?: string;
} & ViewProps;

const Icon: FC<IIconProps> = ({ className, size, color, ...props }) => {

  const styleObj = {
    width: Taro.pxTransform(size),
    height: Taro.pxTransform(size),
    fontSize: Taro.pxTransform(size),
    color,
  }
  

  return (<View {...props} className={`iconfont ${className}`} style={styleObj} >

  </View>);
};

export default Icon;