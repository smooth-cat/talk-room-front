import { Component } from "react";
import { Provider } from "mobx-react";

import counterStore from "./store/counter";

import "./app.scss";
import "./icon/iconfont.css";
import { store } from "./store/root";
import Taro from "@tarojs/taro";

class App extends Component {
  async componentDidMount() {
    // 初始 websocket
    store.wsStore.connect(`wss://${process.env.WsIp}:8080`);
    // store.wsStore.connect(`wss://127.0.0.1:8080`);
  }

  componentDidShow() {}

  componentDidHide() {}

  componentDidCatchError() {}

  // this.props.children 就是要渲染的页面
  render() {
    return <Provider store={store}>{this.props.children}</Provider>;
  }
}

export default App;
