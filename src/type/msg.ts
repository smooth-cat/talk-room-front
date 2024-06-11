export type Msg = {
  uname?: string;
  uid?: string;
  type: MsgType|string;
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
  init = 'init',
  reconnect = 'reconnect',

  rtc_join='rtc_join',
  rtc_remote_invite='rtc_remote_invite',
  rtc_remote_join='rtc_remote_join',
  rtc_connect='rtc_connect',
  rtc_stream_info='rtc_stream_info',
  rtc_update_stream_info='rtc_update_stream_info',
  rtc_leave='rtc_leave',
  rtc_remote_leave='rtc_remote_leave',
  rtc_offer='rtc_offer',
  rtc_answer='rtc_answer',
  rtc_answer_ensure='rtc_answer_ensure',
  rtc_candidate='rtc_candidate',
}

export enum RTCType {
  rtc_join,
  rtc_remote_join,
  rtc_leave,
  rtc_remote_leave,
  rtc_offer,
  rtc_answer,
  rtc_candidate,
}

export enum RoomError  {
  NotFound= '房间不存在',
  Unknown= '未知错误'
}