import type { Metadata } from "next";
import { ArrowRight, RefreshCcw, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import CopyField from "@/components/landing/CopyField";
import { WHATSAPP_URL } from "@/components/landing/contact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teste agora — GoLive",
  description:
    "Ambiente de demonstração compartilhado: entre como organizador ou como participante e veja a GoLive funcionando de verdade.",
};

// Evento "ao vivo" fixo do ambiente compartilhado (ver migração
// 0029_demo_trial.sql) — o modelo que define a configuração padrão fica
// em /admin/eventos, evento "evento-modelo".
const LIVE_EVENT_ID = "727046b8-fe59-4690-a035-30e8d863aff7";

const ADMIN_EMAIL = "demo@golive.net.br";
const PARTICIPANT_EMAIL = "participante@golive.net.br";
const DEMO_PASSWORD = "golive";

export default async function DemoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin, is_moderator")
      .eq("id", user.id)
      .single();
    isStaff = (profile?.is_platform_admin || profile?.is_moderator) ?? false;
  }
  const authHref = isStaff ? "/admin" : !user ? "/login" : null;
  const authLabel = isStaff ? "Painel" : !user ? "Entrar" : null;

  return (
    <div className="gl-landing bg-[var(--gl-bg)] text-[var(--gl-ink)]">
      <Header authHref={authHref} authLabel={authLabel} />

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--gl-brand-soft)] px-3 py-1 text-xs font-bold text-[var(--gl-brand-text)]">
          <Wrench className="h-3.5 w-3.5" aria-hidden />
          Ambiente de teste
        </span>
        <h1
          className="mt-4 text-[clamp(1.875rem,3vw+1rem,2.75rem)] font-extrabold tracking-[-0.03em] text-[var(--gl-ink)]"
          style={{ textWrap: "balance" }}
        >
          Teste a GoLive agora, sem falar com ninguém
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--gl-muted)]">
          Escolha um dos dois acessos abaixo pra entrar no mesmo evento de
          demonstração — um como quem organiza (painel Diretor e
          Configuração), outro como quem participa (chat, quiz, sorteio).
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--gl-border)] bg-[var(--gl-surface)] px-4 py-3 text-sm text-[var(--gl-muted)]">
          <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gl-muted)]" aria-hidden />
          <p>
            Ambiente <strong className="font-semibold text-[var(--gl-ink)]">compartilhado</strong> —
            outras pessoas podem estar testando ao mesmo tempo que você, e
            tudo volta ao padrão automaticamente a cada poucas horas. Não é
            o seu evento de verdade; pra isso, é só{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--gl-brand-text)] hover:underline"
            >
              falar com a gente
            </a>
            .
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-[var(--gl-border)] bg-white p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gl-brand-soft)]">
              <ShieldCheck className="h-5 w-5 text-[var(--gl-brand-text)]" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--gl-ink)]">
              Entrar como organizador
            </h2>
            <p className="mt-1.5 text-sm text-[var(--gl-muted)]">
              Painel Diretor e Configuração do evento — abra um quiz, modere o
              chat, rode um sorteio.
            </p>
            <div className="mt-4 space-y-2">
              <CopyField label="E-mail" value={ADMIN_EMAIL} />
              <CopyField label="Senha" value={DEMO_PASSWORD} />
            </div>
            <a
              href={`/login?next=/admin/eventos/${LIVE_EVENT_ID}/live`}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gl-brand)] py-3 text-sm font-semibold text-[var(--gl-ink)] transition hover:bg-[var(--gl-brand-strong)]"
            >
              Entrar no Diretor
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="flex flex-col rounded-2xl border border-[var(--gl-border)] bg-white p-6">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gl-chat-soft)]">
              <UserRound className="h-5 w-5 text-[var(--gl-chat)]" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[var(--gl-ink)]">
              Entrar como participante
            </h2>
            <p className="mt-1.5 text-sm text-[var(--gl-muted)]">
              A sala de quem assiste — vídeo, chat, quiz, reações e Q&amp;A,
              no celular ou no computador.
            </p>
            <div className="mt-4 space-y-2">
              <CopyField label="E-mail" value={PARTICIPANT_EMAIL} />
              <CopyField label="Senha" value={DEMO_PASSWORD} />
            </div>
            <a
              href="/demo/evento/entrar"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--gl-chat)] py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Entrar na sala
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[var(--gl-muted)]">
          Dica: abra os dois em abas (ou navegadores) diferentes pra ver as
          duas pontas — o que você faz no Diretor aparece na sala em tempo
          real.
        </p>
      </main>

      <Footer authHref={authHref} authLabel={authLabel} />
    </div>
  );
}
