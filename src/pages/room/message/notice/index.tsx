import Taro, { FC } from '@tarojs/taro';
import { View } from '@tarojs/components';
import { Msg } from '@/type/msg';
import './index.scss';

export type INoticeProps = {
  
} & Msg;

const Notice: FC<INoticeProps> = (msg) => {

  

  return (<View className='msg-notice'>
    <View className='msg-notice-line' ></View>
    <View className='msg-notice-info' >{msg.content}</View>
    <View className='msg-notice-line' ></View>
  </View>);
};

export default Notice;