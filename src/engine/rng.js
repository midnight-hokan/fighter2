// 可复现的随机数（mulberry32）。sim 里所有随机必须走这里，禁止使用 Math 自带的随机函数。
export function createRng(seed = 1) {
  let s = seed >>> 0;
  const rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(rng.next() * n); },
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
  return rng;
}
