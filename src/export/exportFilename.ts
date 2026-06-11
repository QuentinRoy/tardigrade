export function buildDatedFilename({
	baseName,
	extension,
}: {
	baseName: string;
	extension: string;
}): string {
	const date = new Date().toISOString().split("T")[0];
	return `${baseName}-${date}.${extension}`;
}
