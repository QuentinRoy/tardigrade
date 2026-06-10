"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const LOCAL_STORAGE_CHANGE_EVENT = "local-storage-change";

type Updater<T> = T | ((current: T) => T);

type UseLocalStorageOptions<T> = {
	serialize?: (value: T) => string;
	deserialize?: (raw: string) => T;
};

function tryDeserialize<T>(
	raw: string | null,
	fallback: T,
	deserialize: (raw: string) => T,
): T {
	if (raw == null) {
		return fallback;
	}

	try {
		return deserialize(raw);
	} catch {
		return fallback;
	}
}

function defaultSerialize<T>(value: T): string {
	return JSON.stringify(value);
}

/**
 * Subscribe a React value to a localStorage key with cross-tab and same-tab reactivity.
 *
 * Important:
 * - Keep `key` stable for the lifetime of the hook.
 * - Keep `fallback` referentially stable (module constant or memoized value).
 * - Keep `options.serialize` and `options.deserialize` referentially stable.
 *
 * Why stability matters:
 * This hook uses `useSyncExternalStore` and memoized callbacks. Passing newly-created
 * serializer/deserializer functions on each render (for example inline lambdas in a
 * component) changes callback identities every render and can cause avoidable re-subscribe/
 * re-snapshot cycles. Define them at module scope, or memoize them, before passing in.
 */
export function useLocalStorage<T>(
	key: string,
	fallback: T,
	options: UseLocalStorageOptions<T> & { deserialize: (raw: string) => T },
): [T, (value: Updater<T>) => void];
export function useLocalStorage(
	key: string,
	fallback: unknown,
	options?: Omit<UseLocalStorageOptions<unknown>, "deserialize">,
): [unknown, (value: Updater<unknown>) => void];
export function useLocalStorage<T>(
	key: string,
	fallback: T,
	options?: UseLocalStorageOptions<T>,
): [T, (value: Updater<T>) => void] {
	const serialize = options?.serialize ?? defaultSerialize<T>;
	const deserialize: (raw: string) => T = options?.deserialize ?? JSON.parse;

	const snapshotCacheRef = useRef<{ raw: string | null; value: T } | null>(
		null,
	);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (typeof window === "undefined") {
				return () => {};
			}

			const onStorage = (event: StorageEvent) => {
				if (event.key == null || event.key === key) {
					onStoreChange();
				}
			};

			const onLocalStorageChange = (event: Event) => {
				if (
					event instanceof CustomEvent &&
					typeof event.detail?.key === "string" &&
					event.detail.key === key
				) {
					onStoreChange();
				}
			};

			window.addEventListener("storage", onStorage);
			window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, onLocalStorageChange);

			return () => {
				window.removeEventListener("storage", onStorage);
				window.removeEventListener(
					LOCAL_STORAGE_CHANGE_EVENT,
					onLocalStorageChange,
				);
			};
		},
		[key],
	);

	const getSnapshot = useCallback(() => {
		if (typeof window === "undefined") {
			return fallback;
		}

		const raw = window.localStorage.getItem(key);
		const cache = snapshotCacheRef.current;

		if (cache != null && cache.raw === raw) {
			return cache.value;
		}

		const value = tryDeserialize(raw, fallback, deserialize);

		snapshotCacheRef.current = { raw, value };

		return value;
	}, [key, fallback, deserialize]);

	const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

	const setValue = useCallback(
		(nextValue: Updater<T>) => {
			if (typeof window === "undefined") {
				return;
			}

			const previousRaw = window.localStorage.getItem(key);
			const current = tryDeserialize(previousRaw, fallback, deserialize);
			const resolved =
				typeof nextValue === "function"
					? (nextValue as (currentValue: T) => T)(current)
					: nextValue;

			const nextRaw = serialize(resolved);
			if (previousRaw === nextRaw) {
				return;
			}

			window.localStorage.setItem(key, nextRaw);
			window.dispatchEvent(
				new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, { detail: { key } }),
			);
		},
		[key, fallback, deserialize, serialize],
	);

	return [value, setValue];
}
