// Kanel configuration for generating Kysely types from the live database.
//
// Run via `pnpm run db:types:generate`, which injects DATABASE_URL through
// dotenvx.
//
// Kanel generates one file per table, enum, and identifier type under
// `src/db/generated/public`, plus the `Database` map in
// `src/db/generated/database.ts`.
//
// The entire output folder is generated-only. `preDeleteOutputFolder` removes
// it before each generation run.

import type {
	GenerateIdentifierType,
	PostRenderHook,
	PreRenderHook,
	TsDeclaration,
	TypescriptConfig,
} from "kanel";
import { makePgTsGenerator, markAsGenerated, resolveType } from "kanel";
import {
	kyselyCamelCaseHook,
	kyselyTypeFilter,
	makeKyselyHook,
} from "kanel-kysely";

/**
 * Emit plain identifier types (`type ProjectRowId = number`) instead of the
 * branded types (`number & { __brand: ... }`) Kanel generates by default; this
 * codebase uses plain numeric ids.
 *
 * Kanel's own `generateIdentifierType: false` switch would do this, but it is
 * broken in v4 (https://github.com/kristiandupont/kanel/issues/765), so this
 * callback returning a plain alias stands in.
 */
const plainIdentifierType: GenerateIdentifierType = (
	column,
	details,
	builtinType,
) => {
	const innerType = resolveType(column, details, true);
	const plainType = typeof innerType === "string" ? innerType : innerType.name;

	return { ...builtinType, typeDefinition: [plainType] };
};

/**
 * Return whether a generated type alias is one of the Kysely convenience row
 * aliases emitted by kanel-kysely:
 *
 *   type Criterion = Selectable<CriterionTable>;
 *   type NewCriterion = Insertable<CriterionTable>;
 *   type CriterionUpdate = Updateable<CriterionTable>;
 *
 * These aliases are removed because their unsuffixed names collide with the
 * application's domain types. Code that needs a database row type can use:
 *
 *   Selectable<CriterionTable>
 *   Insertable<CriterionTable>
 *   Updateable<CriterionTable>
 */
const isRowAlias = (definition: string | undefined) =>
	/^(Selectable|Insertable|Updateable)</.test(definition ?? "");

/**
 * Convert all type imports attached to a generated declaration or property
 * from default imports to named imports.
 *
 * Kanel normally generates imports such as:
 *
 *   import CriterionKind from "./CriterionKind.ts";
 *
 * Since this configuration converts every generated declaration to a named
 * export, references between generated files must instead use:
 *
 *   import type { CriterionKind } from "./CriterionKind.ts";
 */
const toNamedTypeImports = <T extends { isDefault?: boolean }>(
	typeImports: T[] | undefined,
): T[] =>
	(typeImports ?? []).map((typeImport) => ({
		...typeImport,
		isDefault: false,
	}));

/**
 * Normalize Kanel's generated TypeScript API.
 *
 * This hook applies two repository conventions:
 *
 * 1. Remove the generated Selectable/Insertable/Updateable row aliases because
 *    their names collide with domain types.
 *
 * 2. Use named exports and imports everywhere. This avoids default type
 *    exports, which are incompatible with `verbatimModuleSyntax`, and provides
 *    one consistent module convention for tables, enums, identifiers, and the
 *    Database map.
 */
const adaptGeneratedTypes: PreRenderHook = (originalOutput) => {
	const output = { ...originalOutput };
	for (const [fileName, originalFile] of Object.entries(output)) {
		// Other generators may place non-TypeScript artifacts in the output.
		if (originalFile.fileType !== "typescript") continue;
		output[fileName] = {
			...originalFile,
			declarations: originalFile.declarations
				// Remove kanel-kysely's convenience row aliases.
				.filter(
					(declaration) =>
						declaration.declarationType !== "typeDeclaration" ||
						!isRowAlias(declaration.typeDefinition[0]),
				)
				.map((declarationParam): TsDeclaration => {
					const declaration = { ...declarationParam };
					if ("exportAs" in declaration) {
						// Switch all declarations to named exports.
						declaration.exportAs = "named";
					}
					// Update all imports to named imports since we export
					// everything as named exports now.
					if ("typeImports" in declaration) {
						declaration.typeImports = toNamedTypeImports(
							declaration.typeImports,
						);
					}
					if ("properties" in declaration) {
						declaration.properties = declaration.properties.map((property) => ({
							...property,
							typeImports: toNamedTypeImports(property.typeImports),
						}));
					}
					return declaration;
				}),
		};
	}

	return output;
};

/** Remove Kanel's blank separator lines between interface members. */
const compactInterfaceMembers: PostRenderHook = (_path, lines) => {
	let isInsideInterface = false;

	return lines.filter((line) => {
		if (line.startsWith("export interface ")) isInsideInterface = true;
		if (line === "}") isInsideInterface = false;
		return line !== "" || !isInsideInterface;
	});
};

if (process.env["DATABASE_URL"] == null) {
	throw new Error(
		"DATABASE_URL environment variable is required to generate Kysely types",
	);
}

export const connection = process.env["DATABASE_URL"];

export const outputPath = "src/db/generated";

export const preDeleteOutputFolder = true;

/**
 * Exclude:
 *
 * - Kysely's migration bookkeeping tables, through `kyselyTypeFilter`;
 * - PostgreSQL functions, including trigger functions.
 */
export const filter = (pgType: Parameters<typeof kyselyTypeFilter>[0]) =>
	kyselyTypeFilter(pgType) && pgType.kind !== "function";

export const typescriptConfig: TypescriptConfig = {
	// Generate string-literal unions rather than TypeScript enums:
	//
	//   export type CriterionKind = "boolean" | "numeric";
	enumStyle: "literal-union",

	// The repository uses explicit `.ts` extensions in imports through
	// `allowImportingTsExtensions`. No `tsModuleFormat` setting generates those
	// extensions, so configure them directly.
	importsExtension: ".ts",
};

export const generators = [
	makePgTsGenerator({
		// The database client parses PostgreSQL numeric values as JavaScript
		// numbers through `pgTypes.setTypeParser` in `kysely.ts`.
		customTypeMap: { "pg_catalog.numeric": "number" },

		// Plain, unbranded identifier types (see `plainIdentifierType`).
		generateIdentifierType: plainIdentifierType,

		preRenderHooks: [
			makeKyselyHook({
				// Generate the root Kysely Database map in:
				//
				//   src/db/generated/database.ts
				databaseFilename: "database",

				// Use table names such as `criterion`, not
				// `public.criterion`, as keys in the Database map.
				includeSchemaNameInTableName: false,
			}),

			// Convert PostgreSQL snake_case table and column names to the
			// camelCase names expected by Kysely's CamelCasePlugin.
			kyselyCamelCaseHook,
		],
	}),
];

/**
 * Run after the generator-specific hooks so that it can normalize everything
 * emitted by both Kanel and kanel-kysely.
 */
export const preRenderHooks = [adaptGeneratedTypes];

/**
 * Compact interface members, then mark every generated file clearly as
 * generated-only.
 */
export const postRenderHooks = [compactInterfaceMembers, markAsGenerated];
