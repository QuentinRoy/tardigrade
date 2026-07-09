"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

export type SaveError = {
	id: string;
	projectId: string;
	projectSlug: string;
	rubricId: string;
	submissionId: string;
	rubricLabel?: string | undefined;
	submissionLabel?: string | undefined;
	message: string;
};

type SaveErrorsContextValue = {
	errors: SaveError[];
	addError: (error: Omit<SaveError, "id">) => void;
	dismissError: (id: string) => void;
};

const SaveErrorsContext = createContext<SaveErrorsContextValue | null>(null);

export function SaveErrorsProvider({ children }: { children: ReactNode }) {
	const [errors, setErrors] = useState<SaveError[]>([]);

	const addError = useCallback((error: Omit<SaveError, "id">) => {
		const id = crypto.randomUUID();
		setErrors((prev) => [...prev, { ...error, id }]);
	}, []);

	const dismissError = useCallback((id: string) => {
		setErrors((prev) => prev.filter((e) => e.id !== id));
	}, []);

	return (
		<SaveErrorsContext value={{ errors, addError, dismissError }}>
			{children}
		</SaveErrorsContext>
	);
}

export function useSaveErrors(): SaveErrorsContextValue {
	const ctx = useContext(SaveErrorsContext);
	if (ctx == null) {
		throw new Error("useSaveErrors must be used within SaveErrorsProvider");
	}
	return ctx;
}
