import { useCallback, useEffect, useRef } from 'react';

type IFuncLick = (...args: any[]) => any;

export const useDebounceFn = <F extends IFuncLick>(fn: F, delay: number, dep: any[] = []) => {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const fnRef = useRef<F>();
  const clearTimer = (timer?: ReturnType<typeof setTimeout>) => timer && clearTimeout(timer);

  // 每次渲染都把 最新闭包中 回调函数存一下
  fnRef.current = fn;
  useEffect(() => {
    return () => clearTimer(timer.current);
  }, []);

  return useCallback(function(this: any, ...args: Parameters<F>) {
    // 清除当前存在的定时器
    clearTimer(timer.current);

    // 取消事件合成
    args.forEach((arg) => {
      if (arg?.persist instanceof Function) arg.persist();
    });

    timer.current = setTimeout(() => {
      fnRef.current?.call(this, ...args);
    }, delay);
  }, dep);
};
