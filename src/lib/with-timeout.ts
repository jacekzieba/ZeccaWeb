export function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 20_000) {
  let timer: number | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error(`${label} przekroczyło limit ${timeoutMs / 1000}s.`));
      }, timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timer));
}
