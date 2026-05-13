export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;
