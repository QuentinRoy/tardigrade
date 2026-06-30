export function assertNever(x: never): never {
	throw new Error(`Unexpected value: ${x}`);
}

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

export type Writable<T> = { -readonly [P in keyof T]: T[P] };

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

/**
 * Asserts that a value is non-null and non-undefined. If the value is null or
 * undefined, it throws an error. Otherwise, it returns the value with a narrowed
 * type.
 *
 * @example
 * const value: string | null = getValue();
 * const nonNullValue: string = nonNull(value); // Throws if value is null
 *
 * @param value - The value to check for null or undefined.
 * @returns The value with a narrowed type, guaranteed to be non-null and non-undefined.
 * @throws {Error} If the value is null or undefined.
 */
export function nonNull<T>(value: T): NonNullable<T> {
	if (value == null) {
		throw new Error("Expected non-null value");
	}
	return value;
}

/**
 * Clamps a number to a range defined by `min` and `max`. If the number is less than
 * `min`, it returns `min`. If the number is greater than `max`, it returns `max`.
 * Otherwise, it returns the number itself.
 *
 * @param value - The number to clamp.
 * @param min - The minimum value of the range (inclusive).
 * @param max - The maximum value of the range (inclusive).
 * @returns The clamped number.
 */
export function clamped({
	value,
	min,
	max,
}: {
	value: number;
	min?: number | undefined;
	max?: number | undefined;
}): number {
	if (min !== undefined && max !== undefined && min > max) {
		throw new Error(`Invalid clamp range: min (${min}) > max (${max})`);
	}
	if (min !== undefined && value < min) {
		return min;
	}
	if (max !== undefined && value > max) {
		return max;
	}
	return value;
}
