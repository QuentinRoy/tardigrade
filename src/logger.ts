import "server-only";

import pino from "pino";

// Scope and rules for what/when to log: docs/adr/0009-server-side-logging-with-pino.md
export const logger = pino();
