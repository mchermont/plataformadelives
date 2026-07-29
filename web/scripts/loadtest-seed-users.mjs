// Cria as contas de teste do ensaio de carga (público simulado) — sem
// depender do SMTP real (limite de 150 e-mails/hora do Hostinger):
// `email_confirm: true` direto na Admin API, login sempre por senha.
//
// Uso: node scripts/loadtest-seed-users.mjs [quantidade]
// (default: 100, ou LOADTEST_COUNT no ambiente)
//
// Mesmo padrão do scripts/seed-demo-users.mjs. Rodar uma vez antes do
// ensaio; scripts/loadtest-cleanup.mjs apaga essas contas depois.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { LOADTEST_PASSWORD, loadtestEmail } from "./loadtest-shared.mjs";

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

let created = 0;
let existed = 0;
let failed = 0;

for (let i = 0; i < count; i++) {
  const email = loadtestEmail(i);
  const { error } = await admin.auth.admin.createUser({
    email,
    password: LOADTEST_PASSWORD,
    email_confirm: true,
  });
  if (!error) {
    created++;
  } else if (error.message?.toLowerCase().includes("already been registered") || error.status === 422) {
    existed++;
  } else {
    failed++;
    console.error(`✗ ${email}: ${error.message}`);
  }
  if ((i + 1) % 20 === 0) console.log(`... ${i + 1}/${count}`);
}

console.log(`\nPronto: ${created} criadas, ${existed} já existiam, ${failed} falharam.`);
console.log(`Agora rode: node scripts/loadtest-audience.mjs`);
