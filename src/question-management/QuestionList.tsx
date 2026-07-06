"use client";

import { NavLink } from "@mantine/core";
import Link from "next/link";

type QuestionListItem = { id: string; label: string; href: string };

export default function QuestionList({
	questions,
}: {
	questions: QuestionListItem[];
}) {
	return (
		<nav aria-label="Question list">
			{questions.map((question) => (
				<NavLink
					key={question.id}
					component={Link}
					href={question.href}
					label={question.label}
				/>
			))}
		</nav>
	);
}
