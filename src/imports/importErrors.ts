// A recognized domain error for an import that cannot proceed because the
// prepared plan has blocking diagnostics (unknown columns, unmatched
// grade targets, criterion type changes, ...). Distinguishing this type from an
// unexpected/infra error lets `toImportErrorState` keep its actionable
// message instead of logging it and replacing it with a generic one.
export class ImportBlockedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImportBlockedError";
	}
}
