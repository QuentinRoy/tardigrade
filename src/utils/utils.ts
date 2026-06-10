export function assertNever(x: never): never {
	throw new Error(`Unexpected value: ${x}`);
}

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

export type DistributedOmit<T, K extends keyof T> = T extends unknown
	? Omit<T, K>
	: never;

export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Groups duplicate values and reports the indexes where each duplicate appears.
 *
 * By default, primitive values are compared by value, and objects are compared
 * by reference. Provide `getKey` to normalize values, compare objects by a
 * derived key, or ignore entries by returning `undefined`.
 *
 * Groups are returned in first-key-seen order. Indexes inside each group are
 * returned in ascending encounter order.
 *
 * @example
 * findDuplicateGroups(["a", "b", "b", "a"]);
 * // [
 * //   { key: "a", indexes: [0, 3] },
 * //   { key: "b", indexes: [1, 2] },
 * // ]
 *
 * @example
 * findDuplicateGroups([" A ", "", "a"], (value) => {
 *   const key = value.trim().toLowerCase();
 *   return key.length === 0 ? undefined : key;
 * });
 * // [{ key: "a", indexes: [0, 2] }]
 */
export function findDuplicateGroups<Value>(
	values: Iterable<Value>,
): DuplicateGroup<Value>[];
export function findDuplicateGroups<Value, Key>(
	values: Iterable<Value>,
	getKey: (value: Value, index: number) => Key | undefined,
): DuplicateGroup<Key>[];
export function findDuplicateGroups<Value, Key>(
	values: Iterable<Value>,
	getKey?: (value: Value, index: number) => Key | undefined,
): Array<DuplicateGroup<Value | Key>> {
	const indexesByKey = new Map<Value | Key, number[]>();

	let index = 0;
	for (const value of values) {
		const key = getKey == null ? value : getKey(value, index);

		if (key !== undefined) {
			const indexes = indexesByKey.get(key) ?? [];
			indexes.push(index);
			indexesByKey.set(key, indexes);
		}

		index += 1;
	}

	const duplicateGroups: Array<DuplicateGroup<Value | Key>> = [];

	for (const [key, indexes] of indexesByKey) {
		if (indexes.length > 1) {
			duplicateGroups.push({ key, indexes });
		}
	}

	return duplicateGroups;
}

export type DuplicateGroup<Key> = { key: Key; indexes: number[] };

export function nonNull<T>(value: T): NonNullable<T> {
	if (value == null) {
		throw new Error("Expected non-null value");
	}
	return value;
}
