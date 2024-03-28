import { RoomStore } from "./room";
import { UserStore } from "./user";
import { WsStore } from "./ws";

export class RootStore {
  roomStore: RoomStore
  wsStore: WsStore
  userStore: UserStore;
}

export const store = new RootStore()
store.roomStore = new RoomStore(store)
store.wsStore = new WsStore(store)
store.userStore = new UserStore(store)