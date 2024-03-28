import { Msg } from "@/type/msg"

export const msg2Text = (msg: Msg) => {
  return JSON.stringify(msg);
}
export const text2Msg = (text: string) => {
  return JSON.parse(text) as Msg;
}