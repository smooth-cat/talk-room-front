import EventEmitter from "eventemitter3";
import { WS, WsEvent } from "./ws";
import { Msg, MsgType } from "@/type/msg";

export enum MediaType {
  Video = "Video",
  Audio = "Audio",
  Screen = "Screen",
}

export type IJoinInfo = {
  inviteUids?: string[];
  extraInfo?: any;
  rtcRoomId?: number;
};

export enum RTCMode {
  InviteMode = "InviteMode",
  NormalMode = "NormalMode",
}

export enum RTCLifecycle {
  RemoteInvite = "RemoteInvite",
  RemoteStreamAdded = "RemoteStreamAdded",
  LocalStreamAdded = "LocalStreamAdded",
  StreamAdded = "StreamAdded",
  RemoteLeave = "RemoteLeave",
}

export type ExtendStream = MediaStream & {
  uid: string;
  local: boolean;
};

const DEFAULT_RTC_PROPS = {
  /** 默认采用 */
  mode: RTCMode.InviteMode,
};

export const RTCSignalingState = {
  Closed:"closed" ,
  HaveLocalOffer:"have-local-offer" ,
  HaveLocalPranswer:"have-local-pranswer" ,
  HaveRemoteOffer:"have-remote-offer" ,
  HaveRemotePranswer:"have-remote-pranswer" ,
  Stable:"stable" ,
} 

export type RTCProps = {
  uid: string;
  url: string;
} & Partial<typeof DEFAULT_RTC_PROPS>;
export class RTC extends EventEmitter {
  ws = new WS();
  streams = new BehaviorObj<ExtendStream[]>([]);
  get localStreams() {
    return this.streams.value.filter((it) => it.local);
  }
  connectionMap = new Map<string, PeerConn>();
  streamPromise: Promise<MediaStream>;
  rtcRoomId: number;
  rtcInvitedRoomId: number;
  static CONF: RTCConfiguration = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  };

  /** @deprecated */
  constructor(private props: RTCProps) {
    super();
  }

  static create = (props: RTCProps) => {
    props = { ...DEFAULT_RTC_PROPS, ...props };
    const ins = new RTC(props);
    // 考虑这个是否要等待 stream 获取成功
    ins.init();
    return ins;
  };

  init = async () => {
    this.streams.on((v) => {
      console.log('新的流列表', v);
    })
    let promises: Promise<any>[] = [];
    switch (this.props.mode) {
      // 邀请模式需要在建立 rtc 通话前提供 ws 以便接受邀请加入房间的信息
      case RTCMode.InviteMode:
        promises = [this.initWs()];
        break;
      //  普通模式要用户通过自己的 ws 系统实现邀请信息，房间信息的传达
      case RTCMode.NormalMode:
        promises = [];
        break;
      default:
        break;
    }
    return Promise.all(promises);
  };

  initWs = async () => {
    this.ws.connect(this.props.url);
    this.ws.onMsg(MsgType.rtc_remote_invite, this.onRemoteInvite);
    this.ws.onMsg(MsgType.rtc_remote_join, this.onRemoteJoin);
    this.ws.onMsg(MsgType.rtc_remote_leave, this.onRemoteLeave);
    this.ws.onMsg(MsgType.rtc_offer, this.onRemoteOffer);
    this.ws.onMsg(MsgType.rtc_answer, this.onRemoteAnswer);
    this.ws.onMsg(MsgType.rtc_answer_ensure, this.onRemoteAnswerEnsure);
    this.ws.onMsg(MsgType.rtc_candidate, this.onRemoteCandidate);
    await this.ws.init({ uid: this.props.uid });
  };
  /** 创建房间时被要求的用户会收到 rtc_remote_invite */
  onRemoteInvite = (msg: Msg) => {
    this.rtcInvitedRoomId = msg.rtcRoomId;
    this.emit(RTCLifecycle.RemoteInvite, msg);
  };
  /** 加入房间时在房间内的用户会收到 rtc_remote_join */
  onRemoteJoin = async (msg: Msg) => {
    const remoteUid = msg.uid;
    if (remoteUid == null) return;
    const conn = this.initConn(remoteUid, true);
    console.log('远端加入成功执行发布');
    
    await conn.callerPub(this.localStreams, this.sendOffer);
    // this.connectionMap.set(remoteUid, conn);
    // // 创建 offer
    // const offer = await conn.createOffer({
    //   offerToReceiveAudio: true,
    //   offerToReceiveVideo: true,
    // });
    // // 等本地 sdp 设置完毕后再发送给远端
    // await conn.setLocalDescription(offer);
    // // 向远端发送 offer
    // this.sendOffer(offer, remoteUid);
  };

  /** 远端加入，收到offer 创建 RTCPeerConnection */
  initConn = (remoteUid: string, isCaller = true) => {
    // 生成双向连接
    const conn = new PeerConn({
      ...RTC.CONF,
      uid: remoteUid,
      onConnected: this.onConnected,
      isCaller,
    });
    // 加入 map
    this.connectionMap.set(remoteUid, conn);
    // 添加 stun 响应网络协商
    conn.addEvent("icecandidate", this.onicecandidate);
    conn.addEvent("icecandidateerror", (err) => {
      console.log("icecandidateerror", err);
    });
    // 添加轨道/流对象加入信息
    conn.addEvent("track", this.ontrack);

    return conn;
  };

  /** sdp，网络协商 都成功时触发, 纠正，sdp 应该在 addTrack 之后进行，所以这里的 addTrack要提前到 onRemoteJoin 、 onRemoteOffer 、 用户调用 autoPub */
  onConnected = (conn: PeerConn) => {
    // // 将本地流加到 peerConnection TODO: 音视频分轨问题
    // this.streamPromise.then((stream) => {
    //   stream.getTracks().forEach((track) => conn.addTrack(track, stream));
    // });
    // 将本地已经成功申请的流推给 完成连接的 conn
    // this.localStreams.forEach((localStream) => {
    //   conn.publishStream(localStream);
    // });
  };

  stopStream = (stream: MediaStream) => {
    stream.getTracks().forEach(it => it.stop());
  }

  /** 远端离开时用户会收到 rtc_remote_leave  */
  onRemoteLeave = (msg: Msg) => {
    const { uid } = msg;
    if (!uid) return;
    const conn = this.connectionMap.get(uid);
    if (!conn) return;
    conn.destroy();
    this.connectionMap.delete(uid);
    this.streams.value = this.streams.value.filter((stream) => {
      const matched = stream.uid === uid
      if(matched) {
        this.stopStream(stream);
      }
      return !matched;
    });
    this.emit(RTCLifecycle.RemoteLeave, msg);
  };
  /** 远端接收到 offer */
  onRemoteOffer = async (msg: Msg) => {
    const { from: remoteUid, offer } = msg;
    if (remoteUid == null || offer == null) return;
    // 已经通过 offer 创建过的同一用户的 answer peerConn 不再重新创建
    const conn =
      this.connectionMap.get(remoteUid) || this.initConn(remoteUid, false);
    try {
      await conn.setRemoteDescription(offer);
      await conn.calleePub(this.localStreams, this.sendAnswer);
      // this.connectionMap.set(remoteUid, conn);
    } catch (error) {
      this.sendAnswer(null, remoteUid, error);
    }
    // try {
    //   // 把收到的 offer 保存
    //   await conn.setRemoteDescription(offer);
    //   // 创建 answer
    //   const answer = await conn.createAnswer();
    //   // 等本地 sdp 设置完毕后再发送给远端
    //   await conn.setLocalDescription(answer);
    //   // 向远端发送 offer
    //   this.sendAnswer(answer, remoteUid);
    // } catch (error) {
    //   this.sendAnswer(null, remoteUid, error);
    // }
  };
  /** 收到远端 answer 后 */
  onRemoteAnswer = async (msg: Msg) => {
    const { from: remoteUid, answer } = msg;
    if (remoteUid == null || answer == null) return;
    const conn = this.connectionMap.get(remoteUid);
    if (!conn) return;
    try {
      await conn.setRemoteDescription(answer);
      conn.state = { sdpOk: true };
      this.sendAnswerEnsure(remoteUid);
    } catch (error) {
      this.sendAnswerEnsure(remoteUid, error);
    }
  };
  /** 收到远端 answer 后 */
  onRemoteAnswerEnsure = async (msg: Msg) => {
    const { from: remoteUid, answerError } = msg;
    const conn = this.connectionMap.get(remoteUid);
    if (remoteUid == null || !conn) return;
    if (!answerError) {
      conn.state = { sdpOk: true };
      return;
    }
    // TODO: 提示 sdp 失败
  };
  onRemoteCandidate = (msg: Msg) => {
    const { from: remoteUid, candidate } = msg;
    if (remoteUid == null || candidate == null) return;
    const conn = this.connectionMap.get(remoteUid);
    if (!conn) return;
    conn.addIceCandidate(candidate);
  };
  /** 增加自动发布的本地流，流会在每个 peerConnection 建立成功时自动发布 */
  autoPub = async (mediaType: MediaType) => {
    let streamPromise: Promise<MediaStream>;
    switch (mediaType) {
      case MediaType.Video:
        streamPromise = window.navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        break;
      case MediaType.Audio:
        streamPromise = window.navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        break;
      case MediaType.Screen:
        streamPromise = window.navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        break;
      default:
        break;
    }
    return streamPromise!.then((stream) => {
      // 添加到可观察对象中
      const uid = this.props.uid;
      const streams = this.streams.value;
      stream["uid"] = uid;
      stream["local"] = true;
      this.streams.value = [...streams, stream as ExtendStream];
      // 对每个已经 connected 的 conn 进行推流, 对于后续连接成功的 conn 由 this.onConnected 事件处理
      this.connectionMap.forEach((conn) => {
        conn.pub([stream], this.sendOffer, this.sendAnswer);
      });
      this.emit(RTCLifecycle.LocalStreamAdded, stream);
      this.emit(RTCLifecycle.StreamAdded, stream);
    });
  };

  sendRTC = (msg: Omit<Msg, "content">) => {
    const { uid } = this.props;
    return this.ws.promiseSend({
      ...(msg as any),
      content: "",
      rtcRoomId: msg.rtcRoomId ?? this.rtcRoomId,
      uid,
    });
  };

  /** c<->s ，获取当前房间内所有用户 */
  join = async (joinInfo: IJoinInfo = {}) => {
    // 如果使用普通模式则 join 时再启动 ws
    if (this.props.mode === RTCMode.NormalMode) {
      await this.initWs();
    }
    const msg = await this.sendRTC({
      type: MsgType.rtc_join,
      ...joinInfo,
    });
    if (!msg) return null;
    // 加入时同步 rtcRoomId
    this.rtcRoomId = msg.rtcRoomId;
    return msg;
  };

  /**  c<->s ，用户离开 */
  leave = async () => {
    // 关闭每个连接, 但 rtc、ws、streams 的监听不关闭，因为用户可以继续使用 rtc.join
    this.connectionMap.forEach((conn) => conn.destroy());
    this.streams.value.forEach((stream) => {
      this.stopStream(stream)
    });
    await this.sendRTC({
      type: MsgType.rtc_leave,
    });
    // 如果使用普通模式则 leave 后关闭 ws (手动 close 会去除 ws 所有的时间监听)
    if (this.props.mode === RTCMode.NormalMode) {
      this.ws.close();
    }
    this.resetStore();
  };

  /** 数据重置 */
  resetStore = () => {
    this.streams.value = [];
    this.connectionMap.clear();
    this.connectionMap = new Map<string, PeerConn>();
    this.streamPromise = undefined as any;
    this.rtcRoomId = undefined as any;
    this.rtcInvitedRoomId = undefined as any;
  };

  destroy() {
    this.removeAllListeners();
    this.streams.removeAllListener();
    this.ws.close();
    // 关闭每个连接
    this.connectionMap.forEach((conn) => conn.destroy());
    this.streams.value.forEach((stream) => {
      this.stopStream(stream)
    });
    this.resetStore();
  }

  /** c->s->c ，一对一发送媒体协商 请求*/
  sendOffer = (offer: any, to: string) => {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_offer,
      from: uid,
      to,
      offer,
    });
  };
  /** c->s->c ，一对一发送媒体协商 响应 */
  sendAnswer = (answer: any, to: string, offerError?: any) => {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_answer,
      from: uid,
      to,
      answer,
      offerError: offerError?.toString(),
    });
  };
  /** c->s->c ，一对一发送媒体协商 响应 */
  sendAnswerEnsure = (to: string, answerError?: any) => {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_answer_ensure,
      from: uid,
      to,
      answerError: answerError?.toString(),
    });
  };
  /**  c<->s<->c ，一对一互发网络协商 */
  sendCandidate = (candidate: any, to: string) => {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_candidate,
      from: uid,
      to,
      candidate,
    });
  };

  /** stun 服务器返回的candidate 信息 */
  onicecandidate = (e: RTCPeerConnectionIceEvent, conn: PeerConn) => {
    console.log("收到 stun服务器返回的 candidate", e);
    if (!e.candidate) return;
    this.sendCandidate(e.candidate, conn.props.uid);
  };
  /** turn 服务器或 p2p 返回的 track/stream */
  ontrack = (e: RTCTrackEvent, conn: PeerConn) => {
    const stream = e?.streams?.[0];
    conn.addStream(stream);
    // 添加到可观察对象中
    const uid = conn.props.uid;
    const streams = this.streams.value;
    const existStream = streams.find(it => it.uid === uid);
    // 存在 uid 相同的 stream 说明属性同一 conn 则进行合并
    if(existStream) {
      existStream.addTrack(e.track);
      this.streams.value = [...streams];
    } else {
      stream["uid"] = uid;
      stream["local"] = false;
      this.streams.value = [...streams, stream as ExtendStream];
    }
    // 让用户知道哪个人的流加入了
    this.emit(RTCLifecycle.RemoteStreamAdded, stream, conn);
    this.emit(RTCLifecycle.StreamAdded, stream, conn);
  };
}

type ExtendConnProps = {
  uid: string;
  onConnected?: (conn: PeerConn) => void;
  isCaller: boolean;
} & RTCConfiguration;

export type PeerState = {
  sdpOk: boolean;
  iceOk: boolean;
};
class PeerConn extends RTCPeerConnection {
  constructor(public props: ExtendConnProps) {
    super(props);
    this.addIceCompleteEvent();
  }

  private _state: PeerState = {
    sdpOk: false,
    iceOk: false,
  };

  get isConnected() {
    return this._state.iceOk && this._state.sdpOk;
  }

  set state(state: Partial<PeerState>) {
    this._state = { ...this._state, ...state };
    console.log("state变化", this._state);
    if (this._state.iceOk && this._state.sdpOk) {
      this.props.onConnected?.(this);
    }
  }
  /** 自动监听一下 ice 完成 并修改 state 状态 */
  addIceCompleteEvent = () => {
    this.addEvent("icegatheringstatechange", (e) => {
      const iceState = e?.target?.["iceGatheringState"];
      if (iceState === "complete") {
        this.state = { iceOk: true };
      }
    });
    this.addEvent("iceconnectionstatechange", () => {});
  };

  get state() {
    return this._state;
  }

  // publishStream = (stream: MediaStream) => {
  //   const tracks = stream.getTracks();
  //   tracks.forEach((track) => this.addTrack(track, stream));
  // };

  pub = (
    streams: MediaStream[],
    sendOfferFn: (offer: RTCSessionDescriptionInit, uid: string) => any,
    sendAnswer: (
      answer: RTCSessionDescriptionInit | null,
      uid: string,
      offerError?: any
    ) => any
  ) => {
    if(this.props.isCaller) {
      console.log('本地流获取成功执行发布');
      
    }
    this.props.isCaller
      ? this.callerPub(streams, sendOfferFn)
      : this.calleePub(streams, sendAnswer);
  };

  pubStream = (streams: MediaStream[]) => {
    streams.forEach((stream) => {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        track['__id'] = 'hello';
        this.addTrack(track, stream)
      });
    });
  };
  callerPub = async (
    streams: MediaStream[],
    sendOfferFn: (offer: RTCSessionDescriptionInit, uid: string) => any
  ) => {
    // 本地没有流就不走
    if(!streams.length) return;
    this.pubStream(streams);
    const uid = this.props.uid;
    // 创建 offer
    const offer = await this.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    // 等本地 sdp 设置完毕后再发送给远端
    await this.setLocalDescription(offer);
    // 向远端发送 offer
    sendOfferFn(offer, uid);
  };

  calleePub = async (
    streams: MediaStream[],
    sendAnswer: (
      answer: RTCSessionDescriptionInit | null,
      uid: string,
      offerError?: any
    ) => any
  ) => {
    // 没有流时不添加
    if(!streams.length) return;
    const signalState =  this.signalingState;
    console.log({ signalState });
    // 没有 RemoteOffer 或者 prevAnswer 时本地不支持发布 callee 流并添加 answer
    if(![RTCSignalingState.HaveRemoteOffer, RTCSignalingState.HaveLocalPranswer].includes(this.signalingState)) {
      return;
    }
    const uid = this.props.uid;
    this.pubStream(streams);
    // 创建 answer
    const answer = await this.createAnswer();
    // 等本地 sdp 设置完毕后再发送给远端
    await this.setLocalDescription(answer);
    // 向远端发送 offer
    sendAnswer(answer, uid);
  };

  streams: MediaStream[] = [];
  addStream = (stream: MediaStream) => this.streams.push(stream);
  removeStream = (stream?: MediaStream) =>
    (this.streams = stream ? this.streams.filter((it) => it !== stream) : []);

  abortController = new AbortController();

  addEvent = <K extends keyof RTCPeerConnectionEventMap>(
    type: K,
    callback: (e: RTCPeerConnectionEventMap[K], conn: PeerConn) => void
  ) => {
    this.addEventListener(
      type,
      (e) => {
        console.warn(`peer-conn-event ${type}`, e);
        callback(e, this);
      },
      {
        signal: this.abortController.signal,
      }
    );
  };

  removeAllEvent = () => {
    this.abortController.abort();
  };

  destroy = () => {
    this.removeAllEvent();
    this.removeStream();
    this.close();
  };
}

class BehaviorObj<T> {
  constructor(private _value: T) {}
  get value() {
    return this._value;
  }
  set value(v: T) {
    this._value = v;
    this.fns.forEach((fn) => fn(v));
  }

  fns: ((v: T) => any)[] = [];
  on = (fn: (v: T) => any) => {
    fn(this._value);
    this.fns.push(fn);
    return () => {
      this.fns = this.fns.filter((it) => it !== fn);
    };
  };

  removeAllListener = () => {
    this.fns = [];
  };
}
