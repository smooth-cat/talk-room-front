import Taro from "@tarojs/taro";

export const toast = (title = "", duration=2000) => {
  return new Promise<string>((resolve) => {
    Taro.showToast({
      icon: "none",
      title,
      duration,
    });
    setTimeout(() => {
      resolve(title)
    }, duration);
  });
};
