"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  EventField,
  LiveEvent,
  Profile,
  Registration,
} from "@/lib/types";
import { ACCESS_MODE_LABELS } from "@/lib/types";

interface EntrarFlowProps {
  event: LiveEvent;
  fields: EventField[];
  user: { id: string; email: string } | null;
  profile: Profile | null;
  registration: Registration | null;
}

type Step = "credenciais" | "codigo" | "cadastro" | "aguardando" | "bloqueado";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

export function EntrarFlow({ event, fields, user, profile, registration }: EntrarFlowProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const initialStep: Step = !user
    ? "credenciais"
    : registration?.status === "pending"
      ? "aguardando"
      : registration?.status === "rejected" || registration?.status === "banned"
        ? "bloqueado"
        : "cadastro";

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(
    registration?.answers ?? {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enquanto aguarda aprovação, escuta a própria inscrição em tempo real
  useEffect(() => {
    if (step !== "aguardando" || !registration) return;
    const channel = supabase
      .channel(`reg:${registration.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "registrations",
          filter: `id=eq.${registration.id}`,
        },
        (payload) => {
          const updated = payload.new as Registration;
          if (updated.status === "approved") {
            router.push(`/e/${event.slug}`);
            router.refresh();
          } else if (updated.status === "rejected" || updated.status === "banned") {
            setStep("bloqueado");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, registration, supabase, router, event.slug]);

  const domainHint =
    event.access_mode === "domain" && event.allowed_domains.length > 0
      ? `Apenas e-mails ${event.allowed_domains.map((d) => "@" + d).join(", ")}`
      : null;

  const cleanEmail = () => email.trim().toLowerCase();

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail(),
      password,
    });
    if (error) {
      setError(
        "E-mail ou senha incorretos. Primeira vez aqui? Use \"Criar conta\". Esqueceu a senha? Entre com código.",
      );
      setBusy(false);
      return;
    }
    setStep("cadastro");
    router.refresh();
    setBusy(false);
  }

  async function signUp() {
    if (password.length < 8) {
      setError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: cleanEmail(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/e/${event.slug}/entrar`,
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setError("Este e-mail já tem conta. Use \"Entrar\" com a sua senha, ou entre com código.");
      } else {
        setError("Não foi possível criar a conta. Verifique o e-mail e tente de novo.");
      }
      setBusy(false);
      return;
    }
    setStep("codigo");
    setBusy(false);
  }

  async function sendCode() {
    if (!cleanEmail().includes("@")) {
      setError("Informe seu e-mail primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/e/${event.slug}/entrar`,
      },
    });
    if (error) {
      setError("Não foi possível enviar o e-mail. Aguarde um minuto e tente de novo.");
    } else {
      setStep("codigo");
    }
    setBusy(false);
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setError("Código inválido ou expirado. Tente novamente.");
    } else {
      setStep("cadastro");
      router.refresh();
    }
    setBusy(false);
  }

  async function signInWithGoogle() {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/e/${event.slug}/entrar`,
      },
    });
  }

  async function register() {
    setBusy(true);
    setError(null);

    for (const f of fields) {
      if (f.required && !answers[f.id]?.trim()) {
        setError(`Preencha o campo "${f.label}".`);
        setBusy(false);
        return;
      }
    }
    if (!fullName.trim()) {
      setError("Informe seu nome.");
      setBusy(false);
      return;
    }

    await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user?.id ?? "");

    const { data, error } = await supabase.rpc("register_for_event", {
      p_event_id: event.id,
      p_answers: answers,
    });

    if (error) {
      if (error.message.includes("Domínio")) {
        setError("Seu e-mail não pertence a um domínio autorizado para este evento.");
      } else if (error.message.includes("lista")) {
        setError("Seu e-mail não está na lista de convidados deste evento.");
      } else if (error.message.includes("não permitida")) {
        setStep("bloqueado");
      } else {
        setError("Não foi possível concluir a inscrição. Tente novamente.");
      }
    } else {
      const reg = data as Registration;
      if (reg.status === "approved") {
        router.push(`/e/${event.slug}`);
        router.refresh();
      } else {
        router.refresh();
        setStep("aguardando");
      }
    }
    setBusy(false);
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-12"
      style={{ "--brand": event.brand_color } as React.CSSProperties}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {event.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.brand_logo_url}
              alt=""
              className="mx-auto mb-4 h-14 object-contain"
            />
          )}
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--brand,#38bdf8)]">
            {ACCESS_MODE_LABELS[event.access_mode]}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          {event.starts_at && (
            <p className="mt-2 text-sm text-neutral-400">
              {new Date(event.starts_at).toLocaleString("pt-BR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
          {error && (
            <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {step === "credenciais" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Seu e-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className={inputClass}
                />
                {domainHint && (
                  <p className="mt-1.5 text-xs text-neutral-500">{domainHint}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {creating ? "Crie uma senha" : "Sua senha"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (creating ? signUp() : signIn())}
                  placeholder={creating ? "Mínimo 8 caracteres" : "Senha"}
                  className={inputClass}
                />
              </div>

              {creating ? (
                <button
                  onClick={signUp}
                  disabled={busy || !email.includes("@") || password.length === 0}
                  className="w-full rounded-lg bg-[var(--brand,#0284c7)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? "Criando…" : "Criar conta"}
                </button>
              ) : (
                <button
                  onClick={signIn}
                  disabled={busy || !email.includes("@") || password.length === 0}
                  className="w-full rounded-lg bg-[var(--brand,#0284c7)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? "Entrando…" : "Entrar"}
                </button>
              )}

              <button
                onClick={() => {
                  setCreating(!creating);
                  setError(null);
                }}
                className="w-full text-center text-sm text-neutral-400 hover:underline"
              >
                {creating
                  ? "Já tenho conta — entrar com senha"
                  : "Primeira vez aqui? Criar conta"}
              </button>

              <div className="flex items-center gap-3 text-xs text-neutral-600">
                <div className="h-px flex-1 bg-neutral-800" />
                ou
                <div className="h-px flex-1 bg-neutral-800" />
              </div>

              <button
                onClick={sendCode}
                disabled={busy}
                className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm font-semibold transition hover:bg-neutral-800 disabled:opacity-40"
              >
                Entrar com código por e-mail
              </button>

              {event.google_login_enabled && (
                <button
                  onClick={signInWithGoogle}
                  disabled={busy}
                  className="w-full rounded-lg border border-neutral-700 py-2.5 text-sm font-semibold transition hover:bg-neutral-800 disabled:opacity-40"
                >
                  Continuar com Google
                </button>
              )}
            </div>
          )}

          {step === "codigo" && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-300">
                Enviamos um e-mail para{" "}
                <span className="font-semibold">{email}</span> com o seu{" "}
                <strong>código de acesso</strong>. Digite-o abaixo, ou clique no
                link do e-mail.
              </p>
              <input
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                placeholder="········"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none placeholder:text-neutral-700 focus:border-sky-500"
              />
              <button
                onClick={verifyCode}
                disabled={busy || code.length < 6}
                className="w-full rounded-lg bg-[var(--brand,#0284c7)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Verificando…" : "Confirmar código"}
              </button>
              <button
                onClick={() => setStep("credenciais")}
                className="w-full text-center text-xs text-neutral-500 hover:underline"
              >
                Voltar
              </button>
            </div>
          )}

          {step === "cadastro" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Nome completo <span className="text-red-400">*</span>
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como você quer aparecer no chat"
                  className={inputClass}
                />
              </div>

              {fields.map((field) => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium">
                    {field.label}{" "}
                    {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {field.field_type === "select" ? (
                    <select
                      value={answers[field.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [field.id]: e.target.value }))
                      }
                      className={inputClass}
                    >
                      <option value="">Selecione…</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.field_type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm text-neutral-300">
                      <input
                        type="checkbox"
                        checked={answers[field.id] === "sim"}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            [field.id]: e.target.checked ? "sim" : "",
                          }))
                        }
                        className="h-4 w-4 accent-sky-500"
                      />
                      Sim
                    </label>
                  ) : (
                    <input
                      value={answers[field.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [field.id]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  )}
                </div>
              ))}

              <button
                onClick={register}
                disabled={busy}
                className="w-full rounded-lg bg-[var(--brand,#0284c7)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {busy
                  ? "Enviando…"
                  : event.access_mode === "approval"
                    ? "Enviar inscrição para aprovação"
                    : "Entrar no evento"}
              </button>
            </div>
          )}

          {step === "aguardando" && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-[var(--brand,#0284c7)]" />
              <h2 className="font-semibold">Inscrição enviada!</h2>
              <p className="text-sm text-neutral-400">
                Sua participação está aguardando aprovação do organizador. Esta
                página atualiza sozinha assim que você for aprovado.
              </p>
            </div>
          )}

          {step === "bloqueado" && (
            <div className="space-y-2 py-4 text-center">
              <h2 className="font-semibold text-red-400">Acesso não autorizado</h2>
              <p className="text-sm text-neutral-400">
                Sua inscrição neste evento não foi aprovada. Em caso de dúvida,
                fale com o organizador.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
