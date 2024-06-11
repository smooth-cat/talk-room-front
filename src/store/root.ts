import { RoomStore } from "./room";
import { UserStore } from "./user";
import { WS } from "./ws";

export class RootStore {
  roomStore: RoomStore
  wsStore: WS
  userStore: UserStore;
}

export const store = new RootStore()
store.roomStore = new RoomStore(store)
store.wsStore = new WS()
store.userStore = new UserStore(store)