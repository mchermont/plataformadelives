// Cria (ou reaproveita, se já existirem) os dois usuários fixos do
// ambiente de teste compartilhado ("Teste agora" na landing).
//
// Uso: node scripts/seed-demo-users.mjs
//
// Não é uma migração numerada: mexe em auth.users via Admin API do
// Supabase (SUPABASE_SERVICE_ROLE_KEY), não é SQL de schema. Rodar ANTES
// da migração 0029_demo_trial.sql — ela referencia o perfil de
// demo@golive.net.br como created_by do evento modelo.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

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

const ACCOUNTS = [
  {
    email: "demo@golive.net.br",
    password: "golive",
    fullName: "Organizador Demo",
  },
  {
    email: "participante@golive.net.br",
    password: "golive",
    fullName: "Visitante Demo",
  },
];

const env = readEnvLocal();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em web/.env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pgClient = new pg.Client({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
});

try {
  await pgClient.connect();

  for (const account of ACCOUNTS) {
    const existing = await pgClient.query(
      "select id from auth.users where email = $1",
      [account.email],
    );

    let userId = existing.rows[0]?.id;

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });
      if (error) {
        throw new Error(`Falha ao criar ${account.email}: ${error.message}`);
      }
      userId = data.user.id;
      console.log(`✓ Criado ${account.email} (${userId})`);
    } else {
      console.log(`= Já existia ${account.email} (${userId})`);
    }

    await pgClient.query(
      "update profiles set full_name = $2 where id = $1",
      [userId, account.fullName],
    );
  }

  console.log("\nPronto. Agora rode a migração:");
  console.log("  node scripts/migrate.mjs supabase/migrations/0029_demo_trial.sql");
} catch (err) {
  console.error(`✗ Falhou: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pgClient.end();
}
