// Runner de migrações via terminal (substitui aplicar SQL clicando no painel).
// Uso: node scripts/migrate.mjs supabase/migrations/0006_agencies.sql
//
// A connection string vem de:
//   1) variável de ambiente DATABASE_URL, ou
//   2) arquivo web/.db-url (uma linha, não versionado)
//
// Nunca comite a connection string — o .db-url está no .gitignore.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  try {
    return readFileSync(resolve(webRoot, ".db-url"), "utf8").trim();
  } catch {
    console.error(
      "Sem connection string. Defina DATABASE_URL ou crie web/.db-url com a string do Supabase.",
    );
    process.exit(1);
  }
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Uso: node scripts/migrate.mjs <caminho-do-.sql>");
  process.exit(1);
}

const sql = readFileSync(resolve(webRoot, sqlFile), "utf8");
const client = new pg.Client({
  connectionString: getConnectionString(),
  // Supabase exige TLS; não validamos a cadeia (conexão administrativa local)
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`✓ Migração aplicada: ${sqlFile}`);
} catch (err) {
  try {
    await client.query("rollback");
  } catch {}
  console.error(`✗ Falhou (rollback aplicado): ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
