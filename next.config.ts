import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Pin the workspace root to this config's directory. Git worktrees under
	// .claude/worktrees/ each carry their own pnpm-workspace.yaml, so otherwise
	// Turbopack detects multiple lockfiles and infers the outer repo as root.
	turbopack: { root: import.meta.dirname },
	cacheComponents: true,
	cacheLife: {
		// questions, rubrics — writes are the freshness mechanism
		definitions: { revalidate: 60 * 60 },
		// submissions, students — imports are the freshness mechanism
		roster: { revalidate: 60 * 60 },
		// individual assessment values — exact-tag invalidation is the freshness mechanism
		values: { revalidate: 5 * 60 },
		// completion, progress, dashboards — derived and user-visible during grading
		projection: { revalidate: 60 },
		// project list and lookup
		directory: { revalidate: 60 },
	},
};

export default nextConfig;
