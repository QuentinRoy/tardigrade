import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
	buildTestTemplate,
	dropTestTemplate,
	TEST_TEMPLATE_DB_NAME_ENV_VAR,
	testMigrationsPath,
} from "./dbIntegration.ts";

const POSTGRES_IMAGE = "postgres:17-alpine";

// Provisions a single Postgres container for the whole integration run via
// Testcontainers, the same way locally and in CI. The migrated template is
// then built once (see dbIntegration.ts); each test clones that template into
// its own database, so one shared container is enough and migrations run only
// once.
export default async function integrationGlobalSetup(): Promise<
	() => Promise<void>
> {
	const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
	process.env["TEST_DATABASE_URL"] = container.getConnectionUri();

	let templateDbName: string;
	try {
		templateDbName = await buildTestTemplate(testMigrationsPath);
	} catch (error) {
		await container.stop();
		throw error;
	}

	process.env[TEST_TEMPLATE_DB_NAME_ENV_VAR] = templateDbName;

	return async () => {
		await dropTestTemplate(templateDbName);
		await container.stop();
	};
}
