import Taro, { FC } from '@tarojs/taro';
import { View } from '@tarojs/components';
import UserSay from '../user-say';
import { Msg } from '@/type/msg';
import './index.scss';
export type ITextProps = {
} & Msg;

const Text: FC<ITextProps> = (props) => {

  return (
    <UserSay {...props}>
      <View className='msg-text'>
        {props.content}
      </View>
    </UserSay>
  );
};

export default Text;