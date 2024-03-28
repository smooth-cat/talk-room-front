export type Msg = {
  uname?: string;
  uid?: string;
  type: MsgType;
  content: any;
  roomId?: number;
  loginStatus?: JoinStatus;
  msgId?: number;
  roomError?: RoomError;
  timestamp?: string;
  color?: string;
  requestId?: string;
} & Record<any, any>;

export enum JoinStatus {
  Pending = "Pending",
  Success = "Success",
  Fail = "Fail",
}

export enum MsgType {
  Text = "Text",
  Notice = "Notice",
  Join = "Join",
  Leave = "Leave",
  /** 小写下划线是操作 */
  refresh_room_list = "refresh_room_list",
  /** 更新房间用户列表 */
  refresh_room_user = "refresh_room_user",
  heartbeat = "heartbeat",
  reconnect = 'reconnect',
}

export enum RoomError  {
  NotFound= '房间不存在',
  Unknown= '未知错误'
}