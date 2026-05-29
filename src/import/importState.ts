export type ImportState = {
	status: "idle" | "success" | "error";
	message?: string;
	errors?: string[];
};

export const initialImportState: ImportState = { status: "idle" };
