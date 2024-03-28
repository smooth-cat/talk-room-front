import Taro, { FC } from '@tarojs/taro';
import { Button, View } from '@tarojs/components';
import './index.scss';
import { observer } from 'mobx-react';

import axios from 'axios';
import RoomList from './room-list';
import Room from '../room';
import { useSetState } from 'react-use';
export type IIndexProps = {};

const Index: FC<IIndexProps> = observer(({}) => {
  const [roomQuery, setRoomQuery] = useSetState<any>({});
  
  
  return (
    <View className='talk-room'>
      <RoomList setRoomQuery={setRoomQuery} />
    </View>
  );
});

export default Index;