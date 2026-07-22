import { Gauge, MonitorPlay, ShieldAlert, Zap } from "lucide-react";
import Reveal from "./Reveal";

const ACTIONS = [
  { label: "Abrir quiz — Rodada 3", tone: "var(--gl-quiz)" },
  { label: "3 perguntas aguardando aprovação", tone: "var(--gl-chat)" },
  { label: "Rodar sorteio: Kit de boas-vindas", tone: "var(--gl-raffle)" },
];

export default function DirectorPanel() {
  return (
    <section className="border-y border-black/10 bg-[oklch(0.07_0_0)] py-28 text-[oklch(0.96_0_0)] sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[oklch(0.96_0_0)]">
              <Gauge className="h-3.5 w-3.5" aria-hidden />
              Painel Diretor
            </span>
            <h2
              className="mt-4 text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em]"
              style={{ textWrap: "balance" }}
            >
              Pra quem opera ao vivo, sob pressão de verdade
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[oklch(0.68_0_0)]">
              Essa é a cara real do painel que sua equipe usa durante a
              transmissão — não uma versão simplificada pra demo. Escuro e
              direto ao ponto, desenhado pra nunca competir mais de quatro
              decisões na tela ao mesmo tempo.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[oklch(0.96_0_0)]">
              <li className="flex gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.68_0_0)]" />
                Uma atividade ativa por vez — abre, fecha, exibe, limpa
              </li>
              <li className="flex gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.68_0_0)]" />
                Fila de moderação de chat, fotos e perguntas num só lugar
              </li>
              <li className="flex gap-2.5">
                <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.68_0_0)]" />
                O que você abre aqui aparece no telão em segundos
              </li>
            </ul>
          </Reveal>

          <Reveal delay={100}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.14_0_0)] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[oklch(0.96_0_0)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gl-reaction)]" />
                  Diretor · ao vivo
                </span>
                <span className="text-[11px] text-[oklch(0.68_0_0)]">312 na sala</span>
              </div>
              <div className="space-y-2.5 p-5">
                {ACTIONS.map((action) => (
                  <div
                    key={action.label}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3"
                  >
                    <span className="text-[13px] font-medium text-[oklch(0.96_0_0)]">
                      {action.label}
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: action.tone }}
                      aria-hidden
                    />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
