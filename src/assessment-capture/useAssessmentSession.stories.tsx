import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import type { AssessedRubric } from "#rubrics/types.ts";
import type { Submission } from "#submissions/types.ts";
import type { SaveRubricResult } from "./useAssessmentSession.ts";
import { useAssessmentSession } from "./useAssessmentSession.ts";

// A deferred promise whose resolve the play function calls explicitly, so
// completion order and timing are under test control rather than fixed
// delays. See plan decision 5 (plans/active/2026-06-23-tier2-action-route-ux-hardening.md).
type Deferred<TValue> = ReturnType<typeof Promise.withResolvers<TValue>>;

const initialRubrics: AssessedRubric[] = [
	{
		id: "rubric-correctness",
		type: "boolean",
		label: "Correctness",
		marks: 1,
		falseMarks: 0,
		assessment: null,
	},
	{
		id: "rubric-style",
		type: "ordinal",
		label: "Style",
		marks: { poor: 0, fair: 1, good: 2 },
		assessment: null,
	},
	{
		id: "rubric-performance",
		type: "numerical",
		label: "Performance",
		minScore: 0,
		maxScore: 100,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
		assessment: null,
	},
];

const submissions: Submission[] = [
	{ id: "submission-1", type: "individual", studentName: "Ada Lovelace" },
];

// Calls to the saveRubric stub are recorded in order, so the play function
// can resolve a specific call by its index regardless of which rubric index
// it targeted.
function Harness({
	calls,
	onError,
}: {
	calls: Deferred<SaveRubricResult<string>>[];
	onError: (error: string) => void;
}) {
	const { savedRubrics, optimisticRubrics, pendingByIndex, assess } =
		useAssessmentSession<string>({
			initialRubrics,
			submissions,
			currentSubmissionId: "submission-1",
			saveRubric: async () => {
				const deferred = Promise.withResolvers<SaveRubricResult<string>>();
				calls.push(deferred);
				return deferred.promise;
			},
			onError,
		});

	return (
		<div>
			<button
				type="button"
				onClick={() =>
					assess(0, {
						rubricId: "rubric-correctness",
						type: "boolean",
						passed: true,
					})
				}
			>
				Assess correctness
			</button>
			<button
				type="button"
				onClick={() =>
					assess(1, {
						rubricId: "rubric-style",
						type: "ordinal",
						selectedLabel: "good",
					})
				}
			>
				Assess style
			</button>
			<ul>
				{optimisticRubrics.map((rubric, index) => (
					<li key={rubric.id} data-testid={`optimistic-${index}`}>
						{describeAssessment(rubric)}
					</li>
				))}
			</ul>
			<ul>
				{savedRubrics.map((rubric, index) => (
					<li key={rubric.id} data-testid={`saved-${index}`}>
						{describeAssessment(rubric)}
					</li>
				))}
			</ul>
			<ul>
				{initialRubrics.map((rubric, index) => (
					<li key={rubric.id} data-testid={`pending-${index}`}>
						{pendingByIndex[index] ?? 0}
					</li>
				))}
			</ul>
		</div>
	);
}

function describeAssessment(rubric: AssessedRubric): string {
	if (rubric.assessment == null) {
		return "unassessed";
	}
	switch (rubric.type) {
		case "boolean":
			return rubric.assessment.passed ? "passed" : "failed";
		case "ordinal":
			return rubric.assessment.selectedLabel;
		case "numerical":
			return String(rubric.assessment.score);
	}
}

const meta = {
	title: "Assessment/useAssessmentSession",
	component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SuccessCommitsSavedValue: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await expect(screen.getByTestId("pending-0")).toHaveTextContent("0");

		await userEvent.click(
			screen.getByRole("button", { name: "Assess correctness" }),
		);

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent("passed"),
		);
		expect(screen.getByTestId("pending-0")).toHaveTextContent("1");
		expect(screen.getByTestId("saved-0")).toHaveTextContent("unassessed");

		args.calls[0]?.resolve({ success: true });

		await waitFor(() =>
			expect(screen.getByTestId("saved-0")).toHaveTextContent("passed"),
		);
		expect(screen.getByTestId("pending-0")).toHaveTextContent("0");
		expect(screen.getByTestId("optimistic-0")).toHaveTextContent("passed");
		expect(args.onError).not.toHaveBeenCalled();
	},
};

export const FailureRollsBackOptimisticValue: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await userEvent.click(
			screen.getByRole("button", { name: "Assess correctness" }),
		);

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent("passed"),
		);

		args.calls[0]?.resolve({ success: false, error: "save failed" });

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent(
				"unassessed",
			),
		);
		expect(screen.getByTestId("saved-0")).toHaveTextContent("unassessed");
		expect(screen.getByTestId("pending-0")).toHaveTextContent("0");
		expect(args.onError).toHaveBeenCalledTimes(1);
		expect(args.onError).toHaveBeenCalledWith("save failed");
	},
};

export const OutOfOrderCompletionSettlesEachIndexCorrectly: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await userEvent.click(
			screen.getByRole("button", { name: "Assess correctness" }),
		);
		await waitFor(() => expect(args.calls).toHaveLength(1));

		await userEvent.click(screen.getByRole("button", { name: "Assess style" }));
		await waitFor(() => expect(args.calls).toHaveLength(2));

		expect(screen.getByTestId("pending-0")).toHaveTextContent("1");
		expect(screen.getByTestId("pending-1")).toHaveTextContent("1");

		// Resolve the second call (style, index 1) before the first (correctness, index 0).
		args.calls[1]?.resolve({ success: true });

		await waitFor(() =>
			expect(screen.getByTestId("saved-1")).toHaveTextContent("good"),
		);
		expect(screen.getByTestId("pending-1")).toHaveTextContent("0");
		// The still-pending call must not have been disturbed.
		expect(screen.getByTestId("pending-0")).toHaveTextContent("1");
		expect(screen.getByTestId("saved-0")).toHaveTextContent("unassessed");

		args.calls[0]?.resolve({ success: true });

		await waitFor(() =>
			expect(screen.getByTestId("saved-0")).toHaveTextContent("passed"),
		);
		expect(screen.getByTestId("pending-0")).toHaveTextContent("0");
		expect(screen.getByTestId("pending-1")).toHaveTextContent("0");
	},
};

export const SuccessAfterFailureKeepsPendingAccountingCorrect: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await userEvent.click(
			screen.getByRole("button", { name: "Assess correctness" }),
		);
		await waitFor(() => expect(args.calls).toHaveLength(1));

		args.calls[0]?.resolve({ success: false, error: "first attempt failed" });

		await waitFor(() =>
			expect(screen.getByTestId("pending-0")).toHaveTextContent("0"),
		);
		expect(screen.getByTestId("saved-0")).toHaveTextContent("unassessed");

		await userEvent.click(
			screen.getByRole("button", { name: "Assess correctness" }),
		);
		await waitFor(() => expect(args.calls).toHaveLength(2));
		expect(screen.getByTestId("pending-0")).toHaveTextContent("1");

		args.calls[1]?.resolve({ success: true });

		await waitFor(() =>
			expect(screen.getByTestId("saved-0")).toHaveTextContent("passed"),
		);
		expect(screen.getByTestId("pending-0")).toHaveTextContent("0");
		expect(args.onError).toHaveBeenCalledTimes(1);
		expect(args.onError).toHaveBeenCalledWith("first attempt failed");
	},
};
