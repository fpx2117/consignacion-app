import { Client } from "pg";

const LOCK_NAME = "t12-route-integration-test";

export async function acquireT12IntegrationLease(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = url.pathname.slice(1);
  const local = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (
    !local ||
    !/(?:^|[_-])test$/.test(database) ||
    process.env.T12_CONFIRM_DATABASE !== database
  ) {
    throw new Error("T12 integration requires an exactly confirmed local test database");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_NAME]);
  } catch (error) {
    await client.end();
    throw error;
  }

  return async () => {
    const failures: unknown[] = [];
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_NAME]);
    } catch (error) {
      failures.push(error);
    }
    try {
      await client.end();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) {
      throw new AggregateError(failures, "T12 integration lease release failed");
    }
  };
}
