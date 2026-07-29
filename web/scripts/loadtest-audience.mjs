// Ensaio de carga: simula ~100 participantes concorrentes entrando,
// cadastrando, assistindo (heartbeat de presença), respondendo
// atividades ao vivo, mandando chat e perguntas de Q&A — contra o
// evento demo real (Supabase/Realtime/RLS de verdade), sem browser.
//
// Uso:
//   node scripts/loadtest-seed-users.mjs        (uma vez, antes)
//   node scripts/loadtest-audience.mjs
//
// Variáveis de ambiente (todas opcionais):
//   LOADTEST_COUNT           quantidade de participantes (default 100)
//   LOADTEST_EVENT_ID        default: evento "ao vivo" do /demo
//   LOADTEST_DURATION_MIN    duração do ensaio em minutos (default 20 —
//                            pode ser 120 pra ensaiar as 2h reais junto
//                            com um dry-run de verdade da Sala de Produção)
//   LOADTEST_ARRIVAL_MIN     janela de chegada escalonada (default 2)
//
// Importante: desligar o reset automático do evento demo antes de rodar
// (senão o pg_cron pode apagar tudo no meio do teste):
//   select cron.unschedule('reset-demo-event');
// e religar depois:
//   select cron.schedule('reset-demo-event', '0 */4 * * *', $$select reset_demo_event()$$);

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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY em web/.env.local");
  process.exit(1);
}

const COUNT = Number(process.env.LOADTEST_COUNT || 100);
const EVENT_ID = process.env.LOADTEST_EVENT_ID || "727046b8-fe59-4690-a035-30e8d863aff7";
const DURATION_MS = Number(process.env.LOADTEST_DURATION_MIN || 20) * 60 * 1000;
const ARRIVAL_MS = Number(process.env.LOADTEST_ARRIVAL_MIN || 2) * 60 * 1000;

const WORD_BANK = [
  "ótimo", "interessante", "dinâmico", "top", "excelente", "esclarecedor",
  "produtivo", "engajador", "inovador", "fantástico",
];
const CHAT_BANK = [
  "Muito bom o conteúdo!", "Alguém pode repetir esse ponto?", "Excelente explicação",
  "Adorei essa parte", "Isso ajuda muito no meu trabalho", "Consegue compartilhar o material depois?",
  "Ótima pergunta a anterior", "Estou gostando bastante do evento",
];
const QUESTION_BANK = [
  "Como isso se aplica na prática?", "Existe algum material de apoio?",
  "Isso vale pra qualquer contexto?", "Qual o próximo passo recomendado?",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(maxMs) {
  return Math.random() * maxMs;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const stats = { registered: 0, messages: 0, responses: 0, questions: 0, failures: 0 };

function buildPayload(activity) {
  const config = activity.config || {};
  switch (activity.type) {
    case "word_cloud":
      return { word: pick(WORD_BANK) };
    case "poll": {
      const n = config.options?.length || 2;
      return { option_index: Math.floor(Math.random() * n) };
    }
    case "open_text":
      return { text: pick(CHAT_BANK) };
    case "scale": {
      const n = config.statements?.length || 1;
      const max = config.scale_max || 5;
      return { ratings: Array.from({ length: n }, () => 1 + Math.floor(Math.random() * max)) };
    }
    case "ordering": {
      const n = config.options?.length || 2;
      return { order: Array.from({ length: n }, (_, idx) => idx).sort(() => Math.random() - 0.5) };
    }
    case "matrix": {
      const n = config.options?.length || 2;
      const max = config.scale_max || 5;
      return {
        xs: Array.from({ length: n }, () => 1 + Math.floor(Math.random() * max)),
        ys: Array.from({ length: n }, () => 1 + Math.floor(Math.random() * max)),
      };
    }
    default:
      return null;
  }
}

async function simulateParticipant(i) {
  await sleep(jitter(ARRIVAL_MS));

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: loadtestEmail(i),
    password: LOADTEST_PASSWORD,
  });
  if (loginError) {
    stats.failures++;
    console.error(`[${i}] login falhou: ${loginError.message}`);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: regError } = await supabase.rpc("register_for_event", {
    p_event_id: EVENT_ID,
    p_answers: {},
    p_consent: true,
  });
  if (regError) {
    stats.failures++;
    console.error(`[${i}] cadastro falhou: ${regError.message}`);
    return;
  }
  stats.registered++;

  const attendanceTimer = setInterval(() => {
    // .rpc() retorna um builder "thenable" (tem .then), não uma Promise de
    // verdade — .catch() direto nele quebra (TypeError). Promise.resolve()
    // converte pra uma Promise real antes de encadear.
    Promise.resolve(supabase.rpc("touch_attendance", { p_event_id: EVENT_ID, p_seconds: 15 })).catch(() => {});
  }, 15000);

  const answered = new Set();
  const channel = supabase
    .channel(`loadtest-${i}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities", filter: `event_id=eq.${EVENT_ID}` },
      async (payload) => {
        const activity = payload.new;
        if (!activity || activity.status !== "open" || answered.has(activity.id)) return;
        // nem todo mundo responde toda atividade — imita engajamento real
        if (Math.random() > 0.7) return;
        answered.add(activity.id);
        await sleep(jitter(8000));

        try {
          if (activity.type === "quiz" && activity.quiz_id) {
            const { data: qs } = await supabase
              .from("quiz_questions")
              .select("*")
              .eq("quiz_id", activity.quiz_id)
              .eq("status", "open");
            for (const q of qs ?? []) {
              const selected = Math.floor(Math.random() * (q.options?.length || 2));
              const { error } = await supabase.rpc("answer_question", {
                p_question_id: q.id,
                p_selected: selected,
              });
              if (!error) stats.responses++;
            }
            return;
          }
          const body = buildPayload(activity);
          if (!body) return;
          const { error } = await supabase.rpc("submit_activity_response", {
            p_activity_id: activity.id,
            p_payload: body,
          });
          if (!error) stats.responses++;
        } catch {
          // ignora — não é o foco do ensaio derrubar por um erro isolado
        }
      }
    )
    .subscribe();

  const chatCount = Math.floor(Math.random() * 4);
  for (let m = 0; m < chatCount; m++) {
    await sleep(jitter(DURATION_MS / (chatCount + 1)));
    const { error } = await supabase.from("posts").insert({
      event_id: EVENT_ID,
      author_id: user.id,
      content: pick(CHAT_BANK),
    });
    if (!error) stats.messages++;
  }

  if (Math.random() < 0.1) {
    await sleep(jitter(DURATION_MS));
    const { error } = await supabase.rpc("submit_question", {
      p_event_id: EVENT_ID,
      p_content: pick(QUESTION_BANK),
      p_anonymous: Math.random() < 0.3,
    });
    if (!error) stats.questions++;
  }

  await sleep(Math.max(0, DURATION_MS - ARRIVAL_MS));
  clearInterval(attendanceTimer);
  supabase.removeChannel(channel);
}

console.log(
  `Ensaio: ${COUNT} participantes · chegada em até ${ARRIVAL_MS / 60000}min · duração ${DURATION_MS / 60000}min\n`
);

const statsTimer = setInterval(() => {
  console.log(
    `[status] registrados=${stats.registered} mensagens=${stats.messages} respostas=${stats.responses} perguntas=${stats.questions} falhas=${stats.failures}`
  );
}, 60000);

await Promise.all(
  Array.from({ length: COUNT }, (_, i) =>
    simulateParticipant(i).catch((err) => {
      stats.failures++;
      console.error(`[${i}] erro inesperado: ${err.message}`);
    })
  )
);

clearInterval(statsTimer);
console.log("\nEnsaio concluído.");
console.log(stats);
// Timers internos dos clients Supabase (refresh de sessão, heartbeat do
// Realtime) ficam pendurados mesmo depois de tudo concluído — sem isso o
// processo demora bem mais que o esperado pra sair sozinho.
process.exit(stats.failures > 0 ? 1 : 0);
