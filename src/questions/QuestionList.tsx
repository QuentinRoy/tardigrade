"use client";

import { List, ListItemButton, ListItemText } from "@mui/material";
import Link from "next/link";

type QuestionListItem = { id: string; label: string; href: string };

export default function QuestionList({
	questions,
}: {
	questions: QuestionListItem[];
}) {
	return (
		<List component="nav" aria-label="Question list">
			{questions.map((question) => (
				<ListItemButton key={question.id} component={Link} href={question.href}>
					<ListItemText primary={question.label} />
				</ListItemButton>
			))}
		</List>
	);
}
