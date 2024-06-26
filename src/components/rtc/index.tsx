import Taro, { FC, useDidHide } from "@tarojs/taro";
import { View } from "@tarojs/components";
import "./index.scss";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  ExtendStream,
  MediaType,
  RTC,
  RTCLifecycle,
} from "@/store/rtc-perfect";
import { store } from "@/store/root";
import Drawer from "../drawer";
import { useAsync } from "react-use";
import { Msg } from "@/type/msg";
import { RatioBox, ResizeMode } from "../ag-ratio-box";
import Icon from "../icon";
import classNames from "classnames";
import { toast } from "@/tools/alert";
import Popup from "../popup";
import SoundSlider from "./sound-slider";

export type IRTCRoomProps = {
  uids: string[];
  startVideoChat: MutableRefObject<() => any>;
};

export const RTCRoom: FC<IRTCRoomProps> = ({ startVideoChat, uids }) => {
  const { userStore } = store;
  const [visible, setVisible] = useState(false);
  const [streams, setStreams] = useState<ExtendStream[]>([]);
  console.log("渲染的streams", streams);
  const rtcRef = useRef<RTC>();

  /** 透传给父组件的启动视频通话函数 */
  startVideoChat.current = () => {
    rtcRef.current!.join({
      inviteUids: uids.filter((id) => id !== userStore.user.uid),
    });
    rtcRef.current!.publish(MediaType.Video, {
      uname: userStore.user.uname,
    });
    setVisible(true);
  };

  useEffect(() => {
    console.log("effect 触发");
    const rtc = RTC.create({
      uid: userStore.user.uid,
      url: `wss://${process.env.WsIp}:7777`,
    });
    // 同步 streams 到 state
    rtc.watchStream(setStreams);

    // 被邀请时加入房间
    rtc.on(RTCLifecycle.RemoteInvite, (msg: Msg) => {
      rtc.join({
        rtcRoomId: msg.rtcRoomId,
      });
      rtc.publish(MediaType.Video, {
        uname: userStore.user.uname,
      });
      setVisible(true);
    });

    rtcRef.current = rtc;
    return () => {
      console.log("触发销毁");
      rtc.destroy();
    };
  }, []);

  const handleClose = () => {
    rtcRef.current!.leave();
    // rtcRef.current!.destroy();
    setVisible(false);
  };

  const toggleMedia = (stream: ExtendStream, type: "video" | "audio") => {
    if (
      !stream.local &&
      stream.info[type === "video" ? "remoteVideoMuted" : "remoteAudioMuted"]
    ) {
      toast(`对方关闭了${type === "video" ? "摄像头" : "麦克风"}！`);
      return;
    }
    const key = `${type}Muted`;
    stream[key] = !stream[key];
  };

  return (
    <Drawer title="视频通话" visible={visible} onClose={handleClose}>
      {streams.map((stream) => {
        const isLocal = stream.local;
        const isMuted = stream.volume === 0;
        return (
          <View className="video-item" key={stream.info.streamId}>
            <RatioBox
              pos={["center", "center"]}
              mode={ResizeMode.FillWrapper}
              ratio={4 / 3}
              width={Taro.pxTransform(750)}
            >
              <div
                className="video-container"
                ref={(dom) =>
                  dom && stream.play({ dom, video: true, audio: !isLocal })
                }
              />
            </RatioBox>
            <View className="controls">
              <View className="uid">
                {isLocal ? "我" : stream.info?.uname || stream.uid}
              </View>
              <Icon
                onClick={() => toggleMedia(stream, "video")}
                size={40}
                className={classNames({
                  "icon-shexiangtou_guanbi":
                    stream.videoMuted || stream.info.remoteVideoMuted,
                  "icon-shexiangtou":
                    !stream.videoMuted && !stream.info.remoteVideoMuted,
                  // 远程屏蔽按钮呈灰色
                  "disable-icon-style":
                    !isLocal && stream.info.remoteVideoMuted,
                })}
              ></Icon>
              <Popup
                offset={{ y: -8 }}
                popContent={
                  <SoundSlider
                    trackHeight={130}
                    volume={stream.volume}
                    setVolume={(v) => (stream.volume = v)}
                    muted={stream.audioMuted}
                  />
                }
              >
                {(visible) => (
                  <div className={classNames('btn',{
                    'btn-active': visible
                  })}>
                    <Icon
                      // onClick={() => toggleMedia(stream, "audio")}
                      size={40}
                      className={classNames(
                        stream.audioMuted || stream.info.remoteAudioMuted
                          ? "icon-shengyinjingyin"
                          : stream.volume === 0
                          ? "icon-shengyinwu"
                          : "icon-shengyinkai",
                        {
                          // 远程屏蔽按钮呈灰色
                          "disable-icon-style":
                            !isLocal && stream.info.remoteAudioMuted,
                        }
                      )}
                    ></Icon>
                  </div>
                )}
              </Popup>
            </View>
          </View>
        );
      })}
    </Drawer>
  );
};
