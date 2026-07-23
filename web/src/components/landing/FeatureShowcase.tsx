import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Check,
  Dices,
  Hash,
  Heart,
  MessageCircle,
  ShieldCheck,
  ThumbsUp,
  Trophy,
  Users,
} from "lucide-react";
import Reveal from "./Reveal";
import { BrowserFrame } from "./DeviceFrame";

type Block = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  color: string;
  soft: string;
  reverse?: boolean;
  art: React.ReactNode;
};

function QuizArt() {
  return (
    <BrowserFrame label="Ativar pergunta">
      <div className="space-y-3 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[var(--gl-quiz-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--gl-quiz)]">
            Rodada 3 de 5
          </span>
          <span className="text-[11px] font-medium text-[var(--gl-muted)]">
            142 respostas
          </span>
        </div>
        <p className="text-sm font-semibold text-[var(--gl-ink)]">
          Qual recurso mais engaja seu público?
        </p>
        {[
          ["Quiz em rodadas", 58],
          ["Nuvem de palavras", 27],
          ["Enquete rápida", 15],
        ].map(([label, pct]) => (
          <div
            key={label as string}
            className="relative h-8 overflow-hidden rounded-lg bg-[var(--gl-quiz-soft)]"
          >
            <div
              className="h-full rounded-lg bg-[var(--gl-quiz)] transition-all"
              style={{ width: `${pct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-[var(--gl-ink)]">
              <span>{label}</span>
              <span>{pct}%</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--gl-border)] px-3 py-2 text-[11px] font-medium text-[var(--gl-muted)]">
          <Trophy className="h-3.5 w-3.5 text-[var(--gl-quiz)]" />
          Ranking geral disponível a qualquer momento
        </div>
      </div>
    </BrowserFrame>
  );
}

function ChatQaArt() {
  return (
    <BrowserFrame label="Moderação">
      <div className="grid grid-cols-2 gap-px bg-[var(--gl-border)]">
        <div className="space-y-2 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gl-chat)]">
            Chat
          </p>
          {[
            "Consigo assistir depois?",
            "Adorei a dinâmica de hoje!",
          ].map((msg) => (
            <div
              key={msg}
              className="rounded-lg bg-[var(--gl-chat-soft)] px-2.5 py-1.5 text-[11px] text-[var(--gl-ink)]"
            >
              {msg}
            </div>
          ))}
        </div>
        <div className="space-y-2 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gl-chat)]">
            Q&amp;A pendente
          </p>
          <div className="rounded-lg border border-[var(--gl-border)] p-2.5">
            <p className="text-[11px] text-[var(--gl-ink)]">
              Vai ter replay com legenda?
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--gl-muted)]">
                <ThumbsUp className="h-3 w-3" /> 12
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[var(--gl-chat)] px-2 py-0.5 text-[10px] font-bold text-white">
                <Check className="h-3 w-3" /> Aprovar
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function RaffleArt() {
  return (
    <BrowserFrame label="Sorteio auditável">
      <div className="bg-white p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--gl-raffle)]">
          <ShieldCheck className="h-4 w-4" />
          Resultado verificável por seed pública
        </div>
        <div className="mt-3 rounded-xl bg-[var(--gl-raffle-soft)] p-4 text-center">
          <p className="text-[11px] font-medium text-[var(--gl-muted)]">
            Ganhador
          </p>
          <p className="mt-1 text-lg font-extrabold text-[var(--gl-ink)]">
            🎉 Marina Costa
          </p>
        </div>
        <dl className="mt-3 space-y-1.5 font-mono text-[10px] text-[var(--gl-muted)]">
          <div className="flex justify-between gap-2">
            <dt>seed</dt>
            <dd className="truncate">7f3a-91cd-4e02</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>hash</dt>
            <dd className="truncate">md5:0c2b…a91f</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>participantes</dt>
            <dd>318</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-[var(--gl-muted)]">
          Sem edição depois do sorteio — log fica pronto pra exportar em CSV.
        </p>
      </div>
    </BrowserFrame>
  );
}

function PresenceArt() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gl-border)] bg-[var(--gl-ink)] p-6 text-white shadow-[0_24px_60px_-24px_rgba(15,20,40,0.5)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
          <Users className="h-3.5 w-3.5" /> 312 na sala
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Telão · OBS
        </span>
      </div>
      <p className="mt-6 text-center text-sm font-medium text-white/70">
        nuvem de palavras — o que você espera do evento?
      </p>
      <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 px-2">
        {[
          ["networking", 30],
          ["inovação", 22],
          ["prêmios", 26],
          ["conexão", 16],
          ["diversão", 20],
        ].map(([word, size]) => (
          <span
            key={word as string}
            style={{ fontSize: `${size}px` }}
            className="font-bold text-white"
          >
            {word}
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="mt-6 flex items-center justify-center gap-3 text-2xl"
      >
        <span className="gl-float" style={{ animationDelay: "0s" }}>
          🔥
        </span>
        <span className="gl-float" style={{ animationDelay: "0.6s" }}>
          <Heart className="h-6 w-6 fill-[var(--gl-reaction)] text-[var(--gl-reaction)]" />
        </span>
        <span className="gl-float" style={{ animationDelay: "1.3s" }}>
          👏
        </span>
      </div>
    </div>
  );
}

const BLOCKS: Block[] = [
  {
    id: "quiz",
    eyebrow: "Quiz, enquetes & nuvem de palavras",
    title: "Uma pergunta ativa por vez — sem bagunça na tela",
    description:
      "Word cloud, enquete, quiz em rodadas, escala, texto aberto com spotlight, ordenação e matriz. Sua equipe abre, fecha e revela do painel; o público só participa.",
    bullets: [
      "Ranking geral aparece quando você quiser, sem sair do quiz",
      "Você escolhe quais tipos de interação cada evento libera",
      "Filtro de palavras banidas em qualquer campo de texto livre",
    ],
    icon: BarChart3,
    color: "var(--gl-quiz)",
    soft: "var(--gl-quiz-soft)",
    art: <QuizArt />,
  },
  {
    id: "chat-qa",
    eyebrow: "Chat & Q&A",
    title: "Toda pergunta passa por aprovação antes de ficar pública",
    description:
      "Chat pré-moderado e Q&A com aprovação sempre obrigatória — nada vaza pro público sem sua equipe revisar. Upvote é opcional, configurável por evento.",
    bullets: [
      "Fila de moderação clara, feita pra decidir rápido ao vivo",
      "Denúncia e banimento de participante em dois cliques",
      "Anonimato nas telas públicas; export identificado pra você",
    ],
    icon: MessageCircle,
    color: "var(--gl-chat)",
    soft: "var(--gl-chat-soft)",
    reverse: true,
    art: <ChatQaArt />,
  },
  {
    id: "sorteios",
    eyebrow: "Sorteios",
    title: "Resultado que você consegue provar, não só anunciar",
    description:
      "Cada sorteio roda por uma RPC com seed e hash determinísticos — sem botão de editar depois. O log fica pronto pra exportar e defender o resultado se alguém questionar.",
    bullets: [
      "Não existe caminho de UPDATE — o log é imutável por design",
      "Exibição do ganhador direto no telão, com efeito de revelação",
      "CSV de auditoria pra cada sorteio realizado",
    ],
    icon: Dices,
    color: "var(--gl-raffle)",
    soft: "var(--gl-raffle-soft)",
    art: <RaffleArt />,
  },
  {
    id: "presenca",
    eyebrow: "Reações, presença & telão",
    title: "O telão do evento vira parte do espetáculo",
    description:
      "Contador de presença e reações em tempo real, tudo opcional por evento. O telão (rota pública, pensada pra OBS) mostra agregados anônimos — nunca dados de participante.",
    bullets: [
      "Liga e desliga presença/reações sem mexer em nada técnico",
      "Overlay de sorteio, ranking e nuvem de palavras no telão",
      "Zero identificação pessoal em qualquer tela pública",
    ],
    icon: Hash,
    color: "var(--gl-reaction)",
    soft: "var(--gl-reaction-soft)",
    reverse: true,
    art: <PresenceArt />,
  },
];

export default function FeatureShowcase() {
  return (
    <section id="recursos" className="py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-xl">
          <span className="text-sm font-semibold text-[var(--gl-brand-text)]">
            Recursos
          </span>
          <h2
            className="mt-3 text-[clamp(1.875rem,2.5vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
            style={{ textWrap: "balance" }}
          >
            Gamificação de verdade, não só um chat do lado
          </h2>
        </Reveal>

        <div className="mt-24 flex flex-col gap-28">
          {BLOCKS.map((block) => (
            <div
              key={block.id}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                block.reverse ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <Reveal>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: block.soft, color: block.color }}
                >
                  <block.icon className="h-3.5 w-3.5" aria-hidden />
                  {block.eyebrow}
                </span>
                <h3
                  className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--gl-ink)] sm:text-[1.75rem]"
                  style={{ textWrap: "balance" }}
                >
                  {block.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--gl-muted)]">
                  {block.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {block.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-sm text-[var(--gl-ink)]">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: block.color }}
                        aria-hidden
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={100}>{block.art}</Reveal>
            </div>
          ))}
        </div>

        <Reveal className="mt-24 rounded-2xl border border-[var(--gl-border)] bg-[var(--gl-surface)] px-6 py-6 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gl-muted)]">
            E também
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm font-medium text-[var(--gl-ink)]">
            <li>Galeria de fotos moderada</li>
            <li>Materiais para download</li>
            <li>Evento on demand após a live</li>
            <li>Cadastro com campos personalizados</li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
