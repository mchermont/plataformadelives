// Apaga as contas de teste criadas por loadtest-seed-users.mjs.
//
// O reset automático do evento demo (pg_cron) já limpa
// cadastros/posts/respostas via cascade — mas não apaga os usuários de
// auth.users, que ficam órfãos se não rodar esse cleanup.
//
// Uso: node scripts/loadtest-cleanup.mjs [quantidade]
// (mesma quantidade usada no seed; default 100)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadtestEmail } from "./loadtest-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

function readEnvLocal() {
  const raw = readFileSync(resolve(webRoot, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  return readFileSync(resolve(webRoot, ".db-url"), "utf8").trim();
}

const env = readEnvLocal();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em web/.env.local");
  process.exit(1);
}

const count = Number(process.argv[2] || process.env.LOADTEST_COUNT || 100);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// listUsers() não filtra por e-mail — pra resolver o id de cada conta de
// teste, mais direto ir no Postgres, mesmo padrão de conexão do
// seed-demo-users.mjs.
const pgClient = new pg.Client({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
});

let deleted = 0;
let missing = 0;
let failed = 0;

try {
  await pgClient.connect();

  for (let i = 0; i < count; i++) {
    const email = loadtestEmail(i);
    const { rows } = await pgClient.query("select id from auth.users where email = $1", [email]);
    const userId = rows[0]?.id;
    if (!userId) {
      missing++;
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      failed++;
      console.error(`✗ ${email}: ${error.message}`);
    } else {
      deleted++;
    }
    if ((i + 1) % 20 === 0) console.log(`... ${i + 1}/${count}`);
  }

  console.log(`\nPronto: ${deleted} apagadas, ${missing} não existiam, ${failed} falharam.`);
} finally {
  await pgClient.end();
}
