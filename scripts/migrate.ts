import { closeDb } from "../lib/db";
import { migrate } from "../lib/migrations";

migrate()
  .catch((error: Error) => { console.error(error.message); process.exitCode = 1; })
  .finally(closeDb);