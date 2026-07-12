"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Rewrites the cosmetic slug segment of a pathname to match an authoritative
 * identity's current slug. The slug lives in the segment immediately after
 * the `id` segment, at the fixed position the caller's layout owns (not
 * discovered by searching the path for the id's value — a per-project text
 * id like a grade target's is not globally unique, so a value search could
 * match the wrong segment, e.g. a project slug that happens to equal the
 * target id). `idIndex` is a sanity check, not a lookup: it must equal
 * `id`, or the call is a structural misuse.
 *
 * Returns the corrected pathname, or `null` when it is already canonical (the
 * common case). Throws when the segment at `idIndex` isn't `id`, or has no
 * slug segment after it: both are structural misuse that cannot occur while
 * mounted in a layout that owns the `id`/`slug` segments at that position.
 */
export function canonicalizeSlugSegment(
	pathname: string,
	idIndex: number,
	id: string,
	slug: string,
): string | null {
	const segments = pathname.split("/");
	if (segments[idIndex] !== id) {
		throw new Error(
			`Cannot canonicalize slug: expected id "${id}" at segment ${idIndex} of "${pathname}".`,
		);
	}

	const slugIndex = idIndex + 1;
	if (slugIndex >= segments.length) {
		throw new Error(
			`Cannot canonicalize slug: id "${id}" has no slug segment after it in "${pathname}".`,
		);
	}

	if (segments[slugIndex] === slug) {
		return null;
	}
	segments[slugIndex] = slug;
	return segments.join("/");
}

type CosmeticSlugReplacementProps = {
	idIndex: number;
	id: string;
	slug: string;
};

/**
 * Corrects a stale cosmetic slug in the address bar in place. The `id` already
 * resolves the resource, so a slug mismatch is fixed with `history.replaceState`
 * (no navigation, no redirect round-trip). Renders nothing.
 */
export default function CosmeticSlugReplacement({
	idIndex,
	id,
	slug,
}: CosmeticSlugReplacementProps) {
	const pathname = usePathname();

	useEffect(() => {
		const canonicalPathname = canonicalizeSlugSegment(
			pathname,
			idIndex,
			id,
			slug,
		);
		if (canonicalPathname == null) {
			return;
		}
		window.history.replaceState(
			window.history.state,
			"",
			canonicalPathname + window.location.search + window.location.hash,
		);
	}, [pathname, idIndex, id, slug]);

	return null;
}
