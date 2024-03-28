import { useEffect, useLayoutEffect, useMemo } from 'react';
import { v4 } from 'uuid';

export type ICssVar = Record<string, number | string>;
/**
 * 动态插入 style 实现和 styled-component 类似的动态样式
 * @param className 变量作用于哪个类名下
 * @param cssVar 类似于 {'--a': 10px} 属性名和 cssModule 中使用的变量名要一致
 */
export const useDynamicCssVar = (className: string, cssVar: ICssVar) => {
  const style = useMemo(() => document.createElement('style'), []);

  const cssVarKeys = useMemo(() => Object.keys(cssVar), [cssVar]);
  const cssVarValues = useMemo(() => Object.values(cssVar), [cssVar]);

  const id = useMemo(() => v4(), []);

  // 副作用触发，但视图还未渲染时将 css 变量插入到全局
  useLayoutEffect(() => {
    const cssStr = cssVarKeys.reduce<string>((aac, key, i) => {
      const value = typeof cssVarValues[i] === 'number' ? `${cssVarValues[i]}px` : cssVarValues[i];
      aac += `${key}:${value};`;
      return aac;
    }, '');

    style.id = id;
    style.innerHTML = `.${className}{${cssStr}}`;

    // 还没插入到 document.head 中
    if (!style.parentNode) {
      document.head.appendChild(style);
    }
  }, [cssVarKeys.length, ...cssVarValues]);

  useEffect(() => {
    return () => {
      document.head.removeChild(style);
    };
  }, []);
};
