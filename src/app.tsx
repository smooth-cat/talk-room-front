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
    store.wsStore.connect("ws://192.168.0.104:8080");
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
