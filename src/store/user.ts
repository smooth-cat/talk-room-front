import { action, observable } from "mobx";
import { RootStore } from "./root";
import { User } from "@/type/user";
import { v4 } from "uuid";
import { getUuid } from "@/tools/uuid";

export class UserStore {
  constructor(private root:RootStore) {
    // 初始化 uid
    let uid = sessionStorage.getItem('__uid') || getUuid(16);
    sessionStorage.setItem('__uid', uid);
    this.setUser({ uid, uname: '' });
  }


  
  @observable user: User = {
    uname: '',
    uid: '',
  };
  
  @action setUser = (user: Partial<User>) => {
    this.user = {...this.user,...user};
  }
}