import { es } from "zod/v4/locales";

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

export type DistributedOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export type NonEmptyArray<T> = [T, ...T[]];
