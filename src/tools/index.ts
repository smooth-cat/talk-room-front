  /** 约等于 */
  export const apEq = (v1: number, v2: number, epsilon = 0.001) => Math.abs(v1 - v2) < epsilon;