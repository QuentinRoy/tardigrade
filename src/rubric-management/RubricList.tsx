"use client";

import { NavLink } from "@mantine/core";
import Link from "next/link";

type RubricListItem = { id: string; label: string; href: string };

export default function RubricList({ rubrics }: { rubrics: RubricListItem[] }) {
	return (
		<nav aria-label="Rubric list">
			{rubrics.map((rubric) => (
				<NavLink
					key={rubric.id}
					component={Link}
					href={rubric.href}
					label={rubric.label}
				/>
			))}
		</nav>
	);
}
