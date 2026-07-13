import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import type { GradedCriterion } from "#criteria/types.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import type { SaveResult } from "./useGradingSession.ts";
import { useGradingSession } from "./useGradingSession.ts";

// A deferred promise whose resolve the play function calls explicitly, so
// completion order and timing are under test control rather than fixed
// delays. See plan decision 5 (plans/active/2026-06-23-tier2-action-route-ux-hardening.md).
type Deferred<TValue> = ReturnType<typeof Promise.withResolvers<TValue>>;

const initialCriteria: GradedCriterion[] = [
	{
		id: "criterion-correctness",
		kind: "check",
		label: "Correctness",
		marks: 1,
		falseMarks: 0,
		grade: null,
	},
	{
		id: "criterion-style",
		kind: "options",
		label: "Style",
		marks: { poor: 0, fair: 1, good: 2 },
		grade: null,
	},
	{
		id: "criterion-performance",
		kind: "number",
		label: "Performance",
		minScore: 0,
		maxScore: 100,
		minMarks: 0,
		maxMarks: 5,
		reversed: false,
		grade: null,
	},
];

const targets: GradeTarget[] = [
	{ id: "target-1", kind: "individual", studentName: "Ada Lovelace" },
];

// Calls to the saveCriterionGrade stub are recorded in order, so the play function
// can resolve a specific call by its index regardless of which criterion index
// it targeted.
function Harness({
	calls,
	onError,
}: {
	calls: Deferred<SaveResult<string>>[];
	onError: (error: string) => void;
}) {
	const { savedCriteria, optimisticCriteria, pendingByIndex, gradeCriterion } =
		useGradingSession<string>({
			initialCriteria,
			targets,
			currentTargetId: "target-1",
			saveCriterionGrade: async () => {
				const deferred = Promise.withResolvers<SaveResult<string>>();
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
					gradeCriterion(0, {
						criterionId: "criterion-correctness",
						kind: "check",
						passed: true,
					})
				}
			>
				Grade correctness
			</button>
			<button
				type="button"
				onClick={() =>
					gradeCriterion(1, {
						criterionId: "criterion-style",
						kind: "options",
						selectedLabel: "good",
					})
				}
			>
				Grade style
			</button>
			<ul>
				{optimisticCriteria.map((criterion, index) => (
					<li key={criterion.id} data-testid={`optimistic-${index}`}>
						{describeGrade(criterion)}
					</li>
				))}
			</ul>
			<ul>
				{savedCriteria.map((criterion, index) => (
					<li key={criterion.id} data-testid={`saved-${index}`}>
						{describeGrade(criterion)}
					</li>
				))}
			</ul>
			<ul>
				{initialCriteria.map((criterion, index) => (
					<li key={criterion.id} data-testid={`pending-${index}`}>
						{pendingByIndex[index] ?? 0}
					</li>
				))}
			</ul>
		</div>
	);
}

function describeGrade(criterion: GradedCriterion): string {
	if (criterion.grade == null) {
		return "ungraded";
	}
	switch (criterion.kind) {
		case "check":
			return criterion.grade.passed ? "passed" : "failed";
		case "options":
			return criterion.grade.selectedLabel;
		case "number":
			return String(criterion.grade.score);
	}
}

const meta = {
	title: "Grade/useGradingSession",
	component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SuccessCommitsSavedValue: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await expect(screen.getByTestId("pending-0")).toHaveTextContent("0");

		await userEvent.click(
			screen.getByRole("button", { name: "Grade correctness" }),
		);

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent("passed"),
		);
		expect(screen.getByTestId("pending-0")).toHaveTextContent("1");
		expect(screen.getByTestId("saved-0")).toHaveTextContent("ungraded");

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
			screen.getByRole("button", { name: "Grade correctness" }),
		);

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent("passed"),
		);

		args.calls[0]?.resolve({ success: false, error: "save failed" });

		await waitFor(() =>
			expect(screen.getByTestId("optimistic-0")).toHaveTextContent("ungraded"),
		);
		expect(screen.getByTestId("saved-0")).toHaveTextContent("ungraded");
		expect(screen.getByTestId("pending-0")).toHaveTextContent("0");
		expect(args.onError).toHaveBeenCalledTimes(1);
		expect(args.onError).toHaveBeenCalledWith("save failed");
	},
};

export const OutOfOrderCompletionSettlesEachIndexCorrectly: Story = {
	args: { calls: [], onError: fn() },
	play: async ({ args }) => {
		await userEvent.click(
			screen.getByRole("button", { name: "Grade correctness" }),
		);
		await waitFor(() => expect(args.calls).toHaveLength(1));

		await userEvent.click(screen.getByRole("button", { name: "Grade style" }));
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
		expect(screen.getByTestId("saved-0")).toHaveTextContent("ungraded");

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
			screen.getByRole("button", { name: "Grade correctness" }),
		);
		await waitFor(() => expect(args.calls).toHaveLength(1));

		args.calls[0]?.resolve({ success: false, error: "first attempt failed" });

		await waitFor(() =>
			expect(screen.getByTestId("pending-0")).toHaveTextContent("0"),
		);
		expect(screen.getByTestId("saved-0")).toHaveTextContent("ungraded");

		await userEvent.click(
			screen.getByRole("button", { name: "Grade correctness" }),
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
