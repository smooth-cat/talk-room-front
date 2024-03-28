export type IRgb = {
  r: number;
  g: number;
  b: number;
};

/** 等分字符串 */
export const chunk = (str: string, size: number) => {
  return str.match(new RegExp('.{1,' + size + '}', 'g'));
};

/** rgba 转 rgb 对象 */
export const rgbaToRgb = (rgbaColor: string, bgColor = 'rgb(255,255,255)'): IRgb => {
  //注：rgba_color的格式为rgba(0,0,0,0.1), background_color的格式为rgb(0,0,0)
  const bgArray = bgColor.match(/rgb\((.+),(.+),(.+)\)/);
  const rgbaArr = rgbaColor.match(/rgba\((.+),(.+),(.+),(.+)\)/);

  if (!bgArray?.length || !rgbaArr?.length) return { r: 0, g: 0, b: 0 };

  const a = Number(rgbaArr[4]);
  const r = Number(bgArray[1]) * (1 - a) + Number(rgbaArr[1]) * a;
  const g = Number(bgArray[2]) * (1 - a) + Number(rgbaArr[2]) * a;
  const b = Number(bgArray[3]) * (1 - a) + Number(rgbaArr[3]) * a;

  return { r, g, b };
};

/** rgb 转 rgb 对象 */
export const rgbStrToRgb = (str: string) => {
  const rgb = str.match(/rgb\((.+),(.+),(.+)\)/);
  if (!rgb?.length) return { r: 0, g: 0, b: 0 };
  return {
    r: +rgb[1],
    g: +rgb[2],
    b: +rgb[3],
  };
};

/** 16 进制转 rgb 对象 */
export const hexToRgb = (hex: string, bgColor = 'rgb(255,255,255)'): IRgb => {
  const rgbHex = hex.match(/#(\w{3}$)|(\w{6}$)|(\w{8}$)/);
  /** 3 位数 16进制 rgb */
  const hex3 = rgbHex?.[1];
  /** 6 位数 16进制 rgb */
  const hex6 = rgbHex?.[2];
  /** 8 位数 16进制 rgb */
  const hex8 = rgbHex?.[3];

  if (hex8) {
    const rgba = chunk(hex8, 2)?.map((it) => parseInt(it, 16));
    rgba![3] = rgba![3] / 255;
    const rgbaStr = `rgba(${rgba?.join(',')})`;
    return rgbaToRgb(rgbaStr, bgColor);
  }

  if (hex6) {
    const rgb = chunk(hex6, 2)?.map((it) => parseInt(it, 16));
    if (rgb?.length === 3) {
      return { r: rgb[0], g: rgb[1], b: rgb[2] };
    }
  }

  if (hex3) {
    // 3 位表示的是 16进制第二位 + 第一位 15
    const rgb = chunk(hex3, 1)?.map((it) => parseInt(it, 16) * 16 + 15);
    if (rgb?.length === 3) {
      return { r: rgb[0], g: rgb[1], b: rgb[2] };
    }
  }
  // 如果没匹配到就失败了返回黑色
  return { r: 0, g: 0, b: 0 };
};

/** 任意颜色字符串转 rgb 对象 */
export const colorToRgb = (color: string, bgColor = 'rgb(255,255,255)') =>
  color.match(/rgba/)
    ? rgbaToRgb(color, bgColor)
    : color.match(/rgb/)
    ? rgbStrToRgb(color)
    : hexToRgb(color, bgColor);

/** 任意颜色转 rgb 数组 [r,g,b] */
export const colorToRgbArr = (color: string, bgColor = 'rgb(255,255,255)') =>
  Object.values(colorToRgb(color, bgColor));

/** 任意颜色转 rgb(x,x,x) 字符串 */
export const colorToRgbStr = (color: string, bgColor = 'rgb(255,255,255)') => {
  return rgbToRgbStr(colorToRgb(color, bgColor));
};

export const rgbToRgbStr = (rgb: IRgb) => {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
};

/** 判断颜色是否为浅色
 * 计算灰度值值越小越深
 */
export const isColorLight = (color: string, judge = 128, bgColor = 'rgb(255,255,255)') => {
  const { r, g, b } = colorToRgb(color, bgColor);
  const grayscaleValue = r * 0.299 + g * 0.587 + b * 0.114;
  return grayscaleValue >= judge;
};

/**
 *
 * @param colorStr 原颜色
 * @param times 需要rgb改变的倍率
 */
export const multipleColor = (colorStr: string, times: number) => {
  const rgbObj = colorToRgb(colorStr);
  
  for (const key in rgbObj) {
    rgbObj[key] = Math.round((rgbObj[key] * times) % 256);
  }
  return rgbToRgbStr(rgbObj);
};
