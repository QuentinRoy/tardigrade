export type ActionState = {
	status: "idle" | "success" | "error";
	message?: string;
	errors?: string[];
};

export const initialActionState: ActionState = { status: "idle" };
