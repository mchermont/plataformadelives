"use client";

import { useState } from "react";
import { RotateCcw, Vote } from "lucide-react";
import { BrowserFrame } from "./DeviceFrame";
import Reveal from "./Reveal";

const OPTIONS = [
  { id: "quiz", label: "Quiz em rodadas" },
  { id: "sorteio", label: "Sorteio" },
  { id: "nuvem", label: "Nuvem de palavras" },
  { id: "qa", label: "Q&A com upvote" },
];

const BASE_VOTES: Record<string, number> = {
  quiz: 41,
  sorteio: 35,
  nuvem: 18,
  qa: 26,
};

export default function LiveDemo() {
  const [votes, setVotes] = useState(BASE_VOTES);
  const [picked, setPicked] = useState<string | null>(null);

  const total = Object.values(votes).reduce((sum, v) => sum + v, 0);

  function vote(id: string) {
    if (picked) return;
    setPicked(id);
    setVotes((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  }

  function reset() {
    setVotes(BASE_VOTES);
    setPicked(null);
  }

  return (
    <section className="border-t border-[var(--gl-border)] bg-[var(--gl-surface)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--gl-brand-soft)] px-3 py-1 text-xs font-bold text-[var(--gl-brand-text)]">
              <Vote className="h-3.5 w-3.5" aria-hidden />
              Experimente
            </span>
            <h2
              className="mt-4 text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
              style={{ textWrap: "balance" }}
            >
              Isso ali do lado é o produto de verdade
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--gl-muted)]">
              Vote na enquete ao lado. É a mesma barra que atualiza em tempo
              real na sala do seu evento e no telão — só que aqui, sem
              backend, pra você testar agora.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <BrowserFrame label="Enquete ao vivo · demonstração">
              <div className="bg-white p-6">
                <p className="text-sm font-semibold text-[var(--gl-ink)]">
                  Qual recurso você mais quer testar no seu próximo evento?
                </p>

                <div className="mt-4 space-y-2">
                  {OPTIONS.map((opt) => {
                    const pct = total ? Math.round((votes[opt.id] / total) * 100) : 0;
                    const isPicked = picked === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => vote(opt.id)}
                        disabled={Boolean(picked)}
                        className={`relative block w-full overflow-hidden rounded-lg border text-left transition ${
                          picked
                            ? "cursor-default border-[var(--gl-border)]"
                            : "border-[var(--gl-border)] hover:border-[var(--gl-brand-text)]"
                        }`}
                      >
                        <div
                          className="h-10 bg-[var(--gl-brand-soft)] transition-all duration-700 ease-out"
                          style={{ width: picked ? `${pct}%` : "0%" }}
                        />
                        <span className="absolute inset-0 flex items-center justify-between px-3 text-sm font-medium text-[var(--gl-ink)]">
                          <span className="flex items-center gap-2">
                            {isPicked && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gl-brand)]" />
                            )}
                            {opt.label}
                          </span>
                          {picked && <span className="tabular-nums">{pct}%</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-[var(--gl-muted)]">
                  <span>
                    {picked
                      ? `Obrigado por votar — ${total} respostas`
                      : "Clique numa opção pra ver o resultado"}
                  </span>
                  {picked && (
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--gl-brand-text)] hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Votar de novo
                    </button>
                  )}
                </div>
              </div>
            </BrowserFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
