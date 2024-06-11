import EventEmitter from "eventemitter3";
import { WS, WsEvent } from "./ws";
import { Msg, MsgType } from "@/type/msg";
import { AsyncQueue } from "@/tools/async-queue";
import { Scope, setProp, watch, watchable } from "watchable-proxy";
import { v4 } from "uuid";
import { debounce, get, toUpper } from "lodash";
import { CSSProperties } from "react";
export enum DecoratorType {
  RTC,
  PeerConn,
}
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

export type IPlayProps = {
  dom?: HTMLElement;
  video: boolean;
  audio: boolean;
  objectFit?: CSSProperties['objectFit'];
};
export type IPlayFn = (props: IPlayProps) => void;
export type IStopFn = (dom?: HTMLElement) => void;

export type ExtendStream = MediaStream & {
  uid: string;
  local: boolean;
  info: any;
  volume: number;
  audioMuted: boolean;
  videoMuted: boolean;
  play: IPlayFn;
  stop: IStopFn;
} & Record<any, any>;

const DEFAULT_RTC_PROPS = {
  /** 默认采用 */
  mode: RTCMode.InviteMode,
};

export const RTCSignalingState = {
  Closed: "closed",
  HaveLocalOffer: "have-local-offer",
  HaveLocalPranswer: "have-local-pranswer",
  HaveRemoteOffer: "have-remote-offer",
  HaveRemotePranswer: "have-remote-pranswer",
  Stable: "stable",
};

export type RTCProps = {
  uid: string;
  url: string;
} & Partial<typeof DEFAULT_RTC_PROPS>;

@RTCDecorator()
export class RTC extends EventEmitter {
  ws = new WS();
  streams = watchable({ value: [] as ExtendStream[] });
  outScope = new Scope();
  scope = new Scope();
  watchStream = (set: (v: ExtendStream[]) => any) => {
    set([...this.streams.value]);
    // 深度监听
    this.outScope.watch(this.streams, ({ path }) => () => {
      if(path === 'value.0.videoMuted') {
        console.log('监听到 videoMuted 并执行了 setter');
      }
      set([...this.streams.value]);
    });
  };
  get localStreams() {
    return this.streams.value.filter((it) => it.local);
  }
  connectionMap = new Map<string, PeerConn>();
  streamPromise: Promise<MediaStream>;
  rtcRoomId: number;
  rtcInvitedRoomId: number;
  isChatting = false;
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
  constructor(public props: RTCProps) {
    super();
  }

  static create = (props: RTCProps) => {
    props = { ...DEFAULT_RTC_PROPS, ...props };
    const ins = new RTC(props);
    // 考虑这个是否要等待 stream 获取成功
    ins.init();
    return ins;
  };

  async init() {
    let promises: Promise<any>[] = [];
    window.addEventListener('beforeunload', this.onPageUnload.bind(this))
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
  }

  async initWs() {
    this.ws.connect(this.props.url, { debug: true });
    this.ws.onMsg(MsgType.rtc_remote_invite, this.onRemoteInvite.bind(this));
    this.ws.onMsg(MsgType.rtc_remote_join, this.onRemoteJoin.bind(this));
    this.ws.onMsg(MsgType.rtc_connect, this.onStartConnect.bind(this));
    this.ws.onMsg(MsgType.rtc_stream_info, this.onRemoteStreamInfo.bind(this));
    this.ws.onMsg(
      MsgType.rtc_update_stream_info,
      this.onUpdateStreamInfo.bind(this)
    );
    this.ws.onMsg(MsgType.rtc_remote_leave, this.onRemoteLeave.bind(this));
    this.ws.onMsg(MsgType.rtc_offer, this.onRemoteOffer.bind(this));
    this.ws.onMsg(MsgType.rtc_answer, this.onRemoteAnswer.bind(this));
    this.ws.onMsg(
      MsgType.rtc_answer_ensure,
      this.onRemoteAnswerEnsure.bind(this)
    );
    this.ws.onMsg(MsgType.rtc_candidate, this.onRemoteCandidate.bind(this));
    await this.ws.init({ uid: this.props.uid });
  }
  /** 创建房间时被要求的用户会收到 rtc_remote_invite */
  onRemoteInvite(msg: Msg) {
    this.rtcInvitedRoomId = msg.rtcRoomId;
    this.emit(RTCLifecycle.RemoteInvite, msg);
  }
  /** 加入房间时在房间内的用户会收到 rtc_remote_join */
  async onRemoteJoin(msg: Msg) {
    const remoteUid = msg.uid;
    if (remoteUid == null) return;
    // 先 peer 的 impolite
    this.initConn(remoteUid, false);
    console.log("远端加入成功执行发布");
    this.sendRTC({
      type: MsgType.rtc_connect,
      from: this.props.uid,
      to: remoteUid,
    });
  }

  onStartConnect(msg: Msg) {
    const remoteUid = msg.uid;
    if (remoteUid == null) return;
    // 后 peer 的 polite
    this.initConn(remoteUid, true);
  }

  onRemoteStreamInfo(msg: Msg) {
    const remoteUid = msg.from;
    if (!remoteUid) return;
    const conn = this.connectionMap.get(remoteUid);
    if (!conn) return;
    if (msg.http === "req") {
      conn.setStashStream({ msg });
    }
  }

  onUpdateStreamInfo(msg: Msg) {
    const remoteUid = msg.from;
    const streamId = msg.streamId;
    const info = msg.info;
    const http = msg.http;
    // 不处理响应级别消息
    if (http === "res") return;

    // 发送响应消息
    const response = { ...msg };
    response.from = response.to;
    response.to = remoteUid;
    response.http = "res";
    this.ws.send(response);

    if (!remoteUid || !streamId || !info) {
      return;
    }

    // 修改 stream 信息
    const targetStream = this.streams.value.find(
      (it) => it.info.streamId === streamId
    );
    if (!targetStream) return;
    console.log('接到远端info变化', {targetStream,msg});
    
    for (const key in info) {
      targetStream.info[key] = info[key];
    }
  }

  /** 远端加入，收到offer 创建 RTCPeerConnection */
  initConn(remoteUid: string, polite = true) {
    // 生成双向连接
    const conn = new PeerConn({
      ...RTC.CONF,
      uid: remoteUid,
      // onConnected: this.onConnected,
      // onStashFinished: this.onStashFinished,
      polite: polite,
      rtc: this,
    });
    // 加入 map
    this.connectionMap.set(remoteUid, conn);
    return conn;
  }

  stopStream(stream: MediaStream) {
    stream.getTracks().forEach((it) => it.stop());
  }

  /** 远端离开时用户会收到 rtc_remote_leave  */
  onRemoteLeave(msg: Msg) {
    const { uid } = msg;
    if (!uid) return;
    const conn = this.connectionMap.get(uid);
    if (!conn) return;
    conn.destroy();
    this.connectionMap.delete(uid);
    this.streams.value.filterSelf?.((stream) => {
      const matched = stream.uid === uid;
      if (matched) {
        this.stopStream(stream);
      }
      return !matched;
    });
    this.emit(RTCLifecycle.RemoteLeave, msg);
  }
  /** 远端接收到 offer */
  async onRemoteOffer(msg: Msg) {
    const { from: remoteUid, offer } = msg;
    if (remoteUid == null || offer == null) return;
    const conn = this.connectionMap.get(remoteUid);
    if (!conn) return;
    // 正在创建 offer 或者 已经开始走 offer 流程了
    const offerCollision = conn.makingOffer || conn.signalingState !== "stable";
    const polite = conn.props.polite;
    // impolite 在发生 offer 冲突时忽略 polite 方的 offer
    if (!polite && offerCollision) {
      return;
    }

    // polite 方正在创建 offer 的话也别再进行后续的发送了
    if (polite && conn.makingOffer) {
      // 设置 false 后等到 offer 创建完成时发现状态位变成 false 就不再向远端发送 offer 消息了
      conn.makingOffer = false;
    }

    // 其余情况则继续进行协商
    try {
      // polite 方在 !stable 状态可以通过 setRemoteDescription 重置 signalState 到 have_remote_offer
      await conn.setRemoteDescription(offer);
      // 创建 answer
      await conn.setLocalDescription();
      this.sendAnswer(conn.localDescription, remoteUid);
    } catch (error) {
      this.sendAnswer(null, remoteUid, error);
    }
  }
  /** 收到远端 answer 后 */
  async onRemoteAnswer(msg: Msg) {
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
  }
  /** 收到远端 answer 后 */
  async onRemoteAnswerEnsure(msg: Msg) {
    const { from: remoteUid, answerError } = msg;
    const conn = this.connectionMap.get(remoteUid);
    if (remoteUid == null || !conn) return;
    if (!answerError) {
      conn.state = { sdpOk: true };
      return;
    }
    // TODO: 提示 sdp 失败
  }
  onRemoteCandidate(msg: Msg) {
    const { from: remoteUid, candidate } = msg;
    if (remoteUid == null || candidate == null) return;
    const conn = this.connectionMap.get(remoteUid);
    if (!conn) return;
    // fixed: 在设置 RemoteDescription 之前先设置了 ice 会报错
    conn.addIceCandidateDelay(candidate);
  }
  /** 用户关闭标签页 */
  onPageUnload() {
    this.leave();
  }

  /** 增加自动发布的本地流，流会在每个 peerConnection 建立成功时自动发布 */
  async publish(mediaType: MediaType, info: any = {}) {
    let streamPromise: Promise<MediaStream>;
    let needTrackCount = 0;
    switch (mediaType) {
      case MediaType.Video:
        streamPromise = window.navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        needTrackCount = 2;
        break;
      case MediaType.Audio:
        streamPromise = window.navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        needTrackCount = 1;
        break;
      case MediaType.Screen:
        streamPromise = window.navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        needTrackCount = 2;
        break;
      default:
        break;
    }
    // 自动给流 info 添加 needTrackCount
    info = { ...info, needTrackCount };
    return streamPromise!.then((stream) => {
      // 添加到可观察对象中
      const uid = this.props.uid;
      const extStream = createExtendStream(
        stream,
        {
          uid,
          local: true,
          info,
        },
        this
      );
      this.streams.value.push(extStream);
      // 对每个已经 connected 的 conn 进行推流, 对于后续连接成功的 通过 onRemoteJoin 推流
      this.connectionMap.forEach((conn) => {
        conn.pubStream(extStream);
      });
      this.emit(RTCLifecycle.LocalStreamAdded, stream);
      this.emit(RTCLifecycle.StreamAdded, stream);
    });
  }

  sendRTC(msg: Omit<Msg, "content">) {
    console.log("msg.rtcRoomId", msg.rtcRoomId);
    console.log("this.rtcRoomId", this.rtcRoomId);

    const { uid } = this.props;
    return this.ws.promiseSend({
      ...(msg as any),
      content: "",
      rtcRoomId: msg.rtcRoomId ?? this.rtcRoomId,
      uid,
    });
  }

  /** c<->s ，获取当前房间内所有用户 */
  async join(joinInfo: IJoinInfo = {}) {
    // 第二次加入房间时，前一次 stream 监听会被禁用，这里要重新开启
    this.scope.disabled = false;
    // 如果使用普通模式则 join 时再启动 ws
    if (this.props.mode === RTCMode.NormalMode) {
      await this.initWs();
    }
    const msg = await this.sendRTC({
      type: MsgType.rtc_join,
      ...joinInfo,
    });
    console.log("获取服务端响应msg", msg);
    if (!msg) return null;
    // 加入时同步 rtcRoomId
    this.rtcRoomId = msg.rtcRoomId;
    this.isChatting = true;
    return msg;
  }

  /**  c<->s ，用户离开 */
  async leave() {
    // fixed: 点击x按钮离开， 关闭标签页 重复触发 leave 信息
    if(!this.isChatting) return;
    this.isChatting = false;
    // 关闭每个连接, 但 rtc、ws、streams 的监听不关闭，因为用户可以继续使用 rtc.join
    this.connectionMap.forEach((conn) => conn.destroy());
    // 调用 stop 避免离开后任然能听到流的声音
    this.streams.value.forEach((stream) => {
      this.stopStream(stream);
    });
    // 内部对流的监听在客户端离开时可以全部取消了
    this.scope.dispose();
    this.scope.disabled = true;
    const leavePromise = this.sendRTC({
      type: MsgType.rtc_leave,
    });
    // 离开后就需要立即同步清空，否则如果立刻开启第二次通话会受到影响
    this.resetStore();
    // await leavePromise;
    // 如果使用普通模式则 leave 后关闭 ws (手动 close 会去除 ws 所有的事件监听)
    if (this.props.mode === RTCMode.NormalMode) {
      this.ws.close();
    }
  }

  /** 数据重置 */
  resetStore() {
    this.streams.value = [];
    this.connectionMap.clear();
    this.connectionMap = new Map<string, PeerConn>();
    this.streamPromise = undefined as any;
    this.rtcRoomId = undefined as any;
    this.rtcInvitedRoomId = undefined as any;
    this.isChatting = false;
  }

  destroy() {
    this.removeAllListeners();
    // 外部对流的监听直到用户执行 destroy 才关闭，否则可一直开放
    this.outScope.destroy();
    this.ws.close();
    // 关闭每个连接
    this.connectionMap.forEach((conn) => conn.destroy());
    this.streams.value.forEach((stream) => {
      this.stopStream(stream);
    });
    this.resetStore();
  }

  /** c->s->c ，一对一发送媒体协商 请求*/
  sendOffer(offer: any, to: string) {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_offer,
      from: uid,
      to,
      offer,
    });
  }
  /** c->s->c ，一对一发送媒体协商 响应 */
  sendAnswer(answer: any, to: string, offerError?: any) {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_answer,
      from: uid,
      to,
      answer,
      offerError: offerError?.toString(),
    });
  }
  /** c->s->c ，一对一发送媒体协商 响应 */
  sendAnswerEnsure(to: string, answerError?: any) {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_answer_ensure,
      from: uid,
      to,
      answerError: answerError?.toString(),
    });
  }
  /**  c<->s<->c ，一对一互发网络协商 */
  sendCandidate(candidate: any, to: string) {
    const { uid } = this.props;
    this.sendRTC({
      type: MsgType.rtc_candidate,
      from: uid,
      to,
      candidate,
    });
  }
}

type ExtendConnProps = {
  uid: string;
  onConnected?: (conn: PeerConn) => void;
  polite: boolean;
  onStashFinished?: (info: any) => void;
  rtc: RTC;
} & RTCConfiguration;

export type PeerState = {
  sdpOk: boolean;
  iceOk: boolean;
};
@RTCDecorator(DecoratorType.PeerConn)
class PeerConn extends RTCPeerConnection {
  constructor(public props: ExtendConnProps) {
    super(props);
    this.init();
  }
  get rtc() {
    return this.props.rtc;
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
  init() {
    /*----------------- 初始时暂停 addIceCandidate 直到获取到远程sdp描述再进行 -----------------*/
    this.iceAsyncQ.pause();

    /*----------------- 事件监听 -----------------*/
    this.addEvent("negotiationneeded", this.onNegotiationneeded.bind(this));
    this.addEvent(
      "signalingstatechange",
      this.onSignalingstatechange.bind(this)
    );
    this.addEvent("icecandidate", this.onIcecandidate.bind(this));
    this.addEvent(
      "icegatheringstatechange",
      this.onIcegatheringstatechange.bind(this)
    );
    this.addEvent("track", this.onTrack.bind(this));
    /*----------------- 连接成功后把成功获取的本地流推一下 -----------------*/
    const localStreams = this.props.rtc.localStreams;
    localStreams.forEach((stream) => {
      this.pubStream(stream);
    });

  }

  // 需要协商钩子，通常在 peerConn 第一次调用 addTrack 触发，后续就不触发了
  async onNegotiationneeded() {
    try {
      this.makingOffer = true;
      await this.setLocalDescription();
      // 如果外部想取消后续的发送，则可以设置 makingOffer = false，这里获取到 false 就不继续 sendOffer 了（减少一次 ws 消息发送）
      if (this.makingOffer) {
        this.rtc.sendOffer(this.localDescription, this.props.uid);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.makingOffer = false;
    }
  }

  // sdp 状态变化
  onSignalingstatechange(e) {
    const signalingState = this.signalingState;
    if (
      ["have-remote-offer", "have-remote-pranswer"].includes(signalingState)
    ) {
      this.onHaveRemoteDescription();
    }
  };

  // 有了 'have-remote-offer' | 'have-remote-pranswer' 时 再开始将远端获取的候选者设入，否则会报错
  onHaveRemoteDescription() {
    // 这里将堆积的 ice 候选者全部添加
    this.iceAsyncQ.continue();
  }

  iceAsyncQ = AsyncQueue.instance;
  addIceCandidateDelay = this.iceAsyncQ.delayCall(
    this._addIceCandidateDelay.bind(this)
  );
  _addIceCandidateDelay(candidate?: RTCIceCandidateInit | undefined) {
    this.addIceCandidate(candidate);
  }

  // ice 候选者 发送给远端
  async onIcecandidate(e) {
    // 当 candidate 为 null 时代表没有新的候选者了
    if (!e.candidate) return;
    this.rtc.sendCandidate(e.candidate, this.props.uid);
  }

  // ice 协商完成
  onIcegatheringstatechange(e) {
    const iceState = e?.target?.["iceGatheringState"];
    if (iceState === "complete") {
      this.state = { iceOk: true };
    }
  }

  // 轨道事件交给 setter 处理
  async onTrack(e) {
    this.setStashStream({ track: e.track });
  }

  candidates: any[] = [];
  stashRemoteCandidate(candidate: any) {
    this.candidates.push(candidate);
  }

  makingOffer = false;

  get state() {
    return this._state;
  }

  pubStreamQ = AsyncQueue.instance;

  /** 按顺序一个个建立 stream 连接 */
  pubStream = this.pubStreamQ.delayCall(this._pubStream.bind(this));
  async _pubStream(stream: ExtendStream) {
    const info = stream["info"];
    console.log({ info });
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      this.addTrack(track);
    });
    await this.rtc.sendRTC({
      type: MsgType.rtc_stream_info,
      from: this.rtc.props.uid,
      to: this.props.uid,
      info,
      http: "req",
    });
  }

  updateRemoteStreamInfo = debounce(
    this.pubStreamQ.delayCall(this._updateRemoteStreamInfo.bind(this)),
    1000
  );

  async _updateRemoteStreamInfo(streamId: number, info: any) {
    await this.rtc.sendRTC({
      type: MsgType.rtc_update_stream_info,
      from: this.rtc.props.uid,
      to: this.props.uid,
      info,
      streamId: streamId,
      http: "req",
    });
  }

  private _stashStream: ExtendStream | null;
  get stashStream() {
    return this._stashStream;
  }
  setStashStream({ msg, track }: any) {
    let currStream = this._stashStream || new MediaStream();
    // 自定义消息 rtc_stream_info
    if (msg?.info) {
      currStream["info"] = msg.info;
      currStream["msg"] = msg;
    }
    // ontrack 触发
    if (track) {
      currStream.addTrack(track);
    }

    this._stashStream = currStream as any;

    this.stashFinish();
    return;
  }

  stashFinish() {
    console.log("远端流信息更新", this._stashStream);

    if (this._stashStream && this._stashStream.info) {
      const needTrackCount = this._stashStream.info.needTrackCount;
      const currTrackCount = this._stashStream.getTracks().length;
      // 如果完成了这一次流信息初始化则触发回掉
      if (needTrackCount === currTrackCount) {
        this.onStashFinished();
      }
    }
  }

  /** 回复完成 stream 建立 */
  onStashFinished() {
    const fullStream = this._stashStream!;
    const msg = { ...fullStream["msg"] };
    // msg 仅用于合成 stream 过程中，后续删除，只保留 info
    fullStream["msg"] = undefined;
    const extStream = createExtendStream(
      fullStream,
      {
        uid: this.props.uid,
        local: false,
        info: msg["info"],
      },
      this.rtc
    );
    // 交换 from 和 to
    const temp = msg.from;
    msg.from = msg.to;
    msg.to = temp;
    // 避免被 onRemoteStreamInfo 捕获
    msg.http = "res";
    this.rtc.streams.value.push(extStream)
    this.rtc.ws.send(msg);
    this._stashStream = null;
  }

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

  // TODO: 关闭标签页时通知其他客户端断开连接
  destroy() {
    this.removeAllEvent();
    this.removeStream();
    this.close();
  }
}

const createExtendStream = (
  stream: MediaStream,
  props: Record<any, any>,
  rtc: RTC
): ExtendStream => {
  const passedStreamId = props.info?.streamId;

  // 本地创建 stream 时 info 是没有 streamId 的这时候会给 info 添加一个 streamId，但远端 stream 组装时就能拿到 streamId 就不会再创建
  if (!passedStreamId) {
    props.info.streamId = v4();
  }

  const DEF_STREAM_PROPS = {
    /** volume 始终指的是本地对音量大小的控制 */
    volume: 0.75,
    videoMuted: false,
    audioMuted: false,
  };

  props = { ...DEF_STREAM_PROPS, ...props };

  // 本地初始化时附带更新到远端
  if (props.local) {
    props.info.remoteVolume = props.volume;
    props.info.remoteVideoMuted = props.videoMuted;
    props.info.remoteAudioMuted = props.audioMuted;
  }

  const audioStream = new MediaStream();
  const videoStream = new MediaStream();
  stream.getTracks().forEach((it) => {
    it.kind === "video" ? videoStream.addTrack(it) : audioStream.addTrack(it);
  });

  props.elMap = new Map<HTMLElement, HTMLVideoElement | HTMLAudioElement>();

  props.play = function ({ dom, video, audio, objectFit='contain' }: IPlayProps) {

    const existEl: HTMLVideoElement | HTMLAudioElement =
      dom && this.elMap.get(dom);

    const el =
      existEl || (video ? document.createElement("video") : new Audio());

    if(video) {
      el.style.objectFit = objectFit
      el.style.width = '100%' 
      el.style.height = '100%'
    }

    if (dom) {
      if (!existEl) {
        dom.appendChild(el);
      }

      const srcObject =
        video && audio
          ? stream
          : video
          ? videoStream
          : audio
          ? audioStream
          : null;
      if (el.srcObject !== srcObject) {
        el.srcObject = srcObject;
      }
      el.volume = this.local
        ? this.volume
        : this.volume * this.info.remoteVolume;
      try {
        el.play();
      } catch (error) {}
      this.elMap.set(dom, el);
    }
  };

  props.stop = function (dom?: HTMLElement) {
    const doStop = (dom: HTMLElement, el) => {
      el.pause();
      el.srcObject = null;
      dom.contains(el) && dom.removeChild(el);
    };
    if (dom) {
      const el = this.elMap.get(dom);
      el && doStop(dom, el);
      this.elMap.delete(dom);
      return;
    }

    for (const [dom, value] of this.elMap) {
      doStop(dom, value);
    }
    this.elMap.clear();
  };

  const extStream = watchable(stream as ExtendStream);
  // 补充参数
  for (const key in props) {
    const value = props[key];
    if (typeof value === "function") {
      value.bind(extStream);
    }
    extStream[key] = value;
  }

  // 更新 dom 的声音大小
  rtc.scope.watch(extStream, ["volume", "info.remoteVolume"], () => {
    return () => {
      const newVolume = extStream.local
        ? extStream.volume
        : extStream.volume * extStream.info.remoteVolume;
      for (const [_, el] of extStream["elMap"]) {
        el.volume = newVolume;
      }
    };
  });

  // 更新 track 开关状态
  const handleMute = (
    getTrackFnName: "getAudioTracks" | "getVideoTracks",
    muted: boolean
  ) => {
    const tracks = extStream[getTrackFnName]();
    tracks.forEach((track) => (track.enabled = !muted));
  };
  // 初始化 track 状态
  handleMute("getVideoTracks", extStream.videoMuted);
  handleMute("getAudioTracks", extStream.audioMuted);
  // 监听 state 变化改变 track 状态
  rtc.scope.watch(extStream, ["videoMuted", "audioMuted"], ({ newVal, matchedIndex }) => {
    return () => {
      handleMute(matchedIndex ? "getAudioTracks" : "getVideoTracks", newVal);
    };
  });

  // 本地流状态变化，同步到远端
  if(extStream.local) {
    rtc.scope.watch(extStream, ["volume", "videoMuted", "audioMuted"], ({ newVal, matchedRule }) => {
      return () => {
        // 1. 及时更新到 info ，保证 pubStream 时，状态正确
        const info = extStream.info;
        const key = matchedRule as string;
        const remoteKey =
          "remote" + key.slice(0, 1).toUpperCase() + key.slice(1);
        setProp(info, remoteKey, newVal, { noTriggerWatcher: true });
        // 2. 通知已连接的 peer 更新流 info
        rtc.connectionMap.forEach((conn) => {
          conn.updateRemoteStreamInfo(extStream.info.streamId, {[remoteKey]: newVal});
        })
      };
    });
  }

  return extStream as any;
};

export function RTCDecorator(type = DecoratorType.RTC) {
  return function (target: new (props: any) => RTC | PeerConn) {
    const name = target.name;

    // 使用 for in 无法获取的，使用这个方法获取的成员方法必须是非箭头函数的方法
    const ownKeys = Object.getOwnPropertyNames(target.prototype).filter(
      (it) => it !== "constructor"
    );

    ownKeys.forEach((key) => {
      // 由于 getter 或 setter 会导致获取出错，这里用 try 包裹
      let value: any;
      try {
        value = get(target, ["prototype", key]);
      } catch (error) {}

      if (typeof value === "function") {
        // console.log('重写', key);

        target.prototype[key] = function (...args: any[]) {
          const uid =
            type === DecoratorType.PeerConn
              ? `-${this.props.uid.slice(0, 8)}`
              : "";
          console.log(`\n${name}${uid}.${key}被执行`, ...args, "\n");
          // @ts-ignore
          return value.call(this, ...args);
        };
      }
    });
  };
}
