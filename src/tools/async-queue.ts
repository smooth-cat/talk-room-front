type IAsyncFn = (...args: any[]) => Promise<any>;

/** 多个同类型异步函数顺序执行 */
export class AsyncQueue {
  static get instance() {
    return new AsyncQueue();
  }
  executing = false;
  promiseQ: any[] = [];

  next = async () => {
    // 递归或者正常调用时发现被暂停了就结束
    if(this._pause) {
      this.executing = false;
      return;
    }
    this.executing = true;
    if (this.promiseQ.length > 0) {
      // 取出对应异步函数和参数执行，
      const { fn, args, resolve, reject } = this.promiseQ.shift();
      try {
        const result = await fn.call(...args);
        // 执行完成后触发包裹的 promise 的 resolve
        resolve(result);
      } catch (error) {
        reject(error);
      }
      this.next();
    }
    // 一直执行到数组最后一个才会变成 false
    this.executing = false;
  };

  private _pause = false;
  pause() {
    // 手动停止
    this._pause = true;
  }

  continue() {
    this._pause = false;
    // 当前正在执行 则通过递归继续进行
    if(!this.executing) {
      this.next();
    }
  }

  delayCall = <T extends IAsyncFn>(fn: T): T => {
    const that = this;
    return async function (this: any, ...args: any[]) {
      return new Promise((resolve, reject) => {
        // 收集函数、入参、包裹的 promise 的 resolve、reject
        that.promiseQ.push({ fn, args: [this, ...args], resolve, reject });
        // 启动
        if(!that.executing) {
          that.next();
        }
      });
    } as T;
  };
}
  
// /** 延时打印函数 */
// const timeoutLog = async(time: number, data: any) => {
//   await (new Promise(resolve => setTimeout(resolve, time)));
//   console.log(data);
// }

// // 生成一个包装实例
// const queue = AsyncQueue.instance;

// // 通过 delayCall 方法包装延时打印函数
// const queuedTime = queue.delayCall(timeoutLog);

// // 3 秒后打印
// queuedTime(3000, '3s 延迟函数触发')
// // 5 秒后打印
// queuedTime(2000, '2s 延迟函数触发')

