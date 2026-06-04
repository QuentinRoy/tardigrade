"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Rewrites the cosmetic slug segment of a pathname to match an authoritative
 * identity's current slug. The slug lives in the segment immediately after the
 * `id` segment, so a stale slug is patched in place without rebuilding the URL.
 *
 * Returns the corrected pathname, or `null` when it is already canonical (the
 * common case). Throws when `id` is absent or is the last segment: both are
 * structural misuse that cannot occur while mounted in a layout that owns the
 * `id`/`slug` segments.
 */
export function canonicalizeSlugSegment(
	pathname: string,
	id: string,
	slug: string,
): string | null {
	const segments = pathname.split("/");
	const idIndex = segments.indexOf(id);
	if (idIndex < 0) {
		throw new Error(
			`Cannot canonicalize slug: id "${id}" is absent from "${pathname}".`,
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

type CosmeticSlugReplacementProps = { id: string; slug: string };

/**
 * Corrects a stale cosmetic slug in the address bar in place. The `id` already
 * resolves the resource, so a slug mismatch is fixed with `history.replaceState`
 * (no navigation, no redirect round-trip). Renders nothing.
 */
export default function CosmeticSlugReplacement({
	id,
	slug,
}: CosmeticSlugReplacementProps) {
	const pathname = usePathname();

	useEffect(() => {
		const canonicalPathname = canonicalizeSlugSegment(pathname, id, slug);
		if (canonicalPathname == null) {
			return;
		}
		window.history.replaceState(
			window.history.state,
			"",
			canonicalPathname + window.location.search + window.location.hash,
		);
	}, [pathname, id, slug]);

	return null;
}
