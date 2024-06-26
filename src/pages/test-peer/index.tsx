import Taro, { FC } from "@tarojs/taro";
import { Button, View } from "@tarojs/components";
import { useEffect, useRef, useState } from "react";
import SoundSlider from "@/components/rtc/sound-slider";
import Popup from "@/components/popup";

export type ITestPeerProps = {};

const TestPeer: FC<ITestPeerProps> = ({}) => {
  // useEffect(() => {
  //   const pc = new RTCPeerConnection({
  //     iceServers: [
  //       {
  //         urls: [
  //           "stun:stun.l.google.com:19302",
  //           "stun:stun.l.google.com:19302",
  //           "stun:stun1.l.google.com:19302",
  //           "stun:stun2.l.google.com:19302",
  //           "stun:stun3.l.google.com:19302",
  //           "stun:stun4.l.google.com:19302",
  //         ],
  //       },
  //     ],
  //   });

  //   pc.onnegotiationneeded = () => {
  //     console.log("触发需要协商");
  //   };
  //   pcRef.current = pc;
  //   Promise.all(
  //     [
  //       navigator.mediaDevices
  //       .getUserMedia({
  //         video: true,
  //         audio: true,
  //       }),
  //       navigator.mediaDevices.getDisplayMedia({
  //         video: true,
  //         audio: true,
  //       })
  //     ]
  //   ).then((streams) => {
  //       setDisabled(false);
  //       streamRef.current = streams;
  //     });
  // }, []);
  const [disabled, setDisabled] = useState(true);

  const streamRef = useRef<MediaStream[]>();
  const pcRef = useRef<RTCPeerConnection>();
const countRef = useRef(0);
  const [volume, setVolume] = useState(0.5);
  
  

  return (
    <View>
      <View></View>
      <Button
        disabled={disabled}
        onClick={() => {
          const i = countRef.current;
          const tracks = streamRef.current?.reduce((acc, item) => {
            return [...acc, ...item.getTracks()]
          }, []) || [];
          const track = tracks[i]
          if(!track) return;
          console.log('获取的track', track);
          pcRef.current?.addTrack(track);
          countRef.current++;
        }}
      >
        触发协商
      </Button>
      <Popup direction="bottom" popContent={<SoundSlider trackHeight={150} volume={volume} setVolume={setVolume} muted={false} />} >
        <div style={{ width: '100px', background: 'gray',  display: 'inline-block' }} >哈哈</div>
      </Popup>
    </View>
  );
};

export default TestPeer;
