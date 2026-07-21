"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authInputClass, authOtpInputClass } from "@/lib/authInputClass";

type Step = "credenciais" | "codigo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>("credenciais");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [next, setNext] = useState("/admin");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("erro") === "link-expirado") {
      setError(
        "O link do e-mail expirou ou já foi usado. Use o código do e-mail, ou peça um novo.",
      );
    }
    // Destino pós-login (ex.: página restrita de um cliente); só caminhos internos
    const n = params.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
  }, []);

  async function signInWithPassword() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setError(
        "E-mail ou senha incorretos. Se preferir, entre com um código por e-mail.",
      );
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendCode() {
    if (!email.includes("@")) {
      setError("Informe seu e-mail primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (error) {
      setError("Não foi possível enviar o e-mail. Aguarde um minuto e tente de novo.");
    } else {
      setStep("codigo");
      setInfo(null);
    }
    setBusy(false);
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setError("Código inválido ou expirado.");
    } else {
      // Entrar com código não deixa senha definida — força já em seguida
      // pra não deixar a conta sem senha pra próxima vez.
      router.push("/senha/nova");
    }
    setBusy(false);
  }

  async function forgotPassword() {
    if (!email.includes("@")) {
      setError("Informe seu e-mail primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/senha/nova` },
    );
    if (error) {
      setError("Não foi possível enviar o e-mail de redefinição.");
      setBusy(false);
      return;
    }
    router.push(`/senha/nova?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  const inputClass = authInputClass;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="mb-1 text-center text-xl font-bold">Área do organizador</h1>
        <p className="mb-6 text-center text-sm text-neutral-400">
          Acesso para a equipe que cria e opera os eventos.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {info}
          </p>
        )}

        {step === "credenciais" ? (
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signInWithPassword()}
              placeholder="Sua senha"
              className={inputClass}
            />
            <button
              onClick={signInWithPassword}
              disabled={busy || !email.includes("@") || password.length === 0}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? "Entrando…" : "Entrar"}
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
              Primeiro acesso? Entrar com código
            </button>
            <p className="text-center text-xs text-neutral-500">
              Enviamos um código para o seu e-mail. Depois de entrar, você cria
              uma senha para as próximas vezes.
            </p>

            <div className="flex items-center justify-between text-xs">
              <button
                onClick={forgotPassword}
                disabled={busy}
                className="text-neutral-400 hover:underline"
              >
                Esqueci minha senha
              </button>
              <Link href="/" className="text-neutral-500 hover:underline">
                Voltar
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-300">
              Enviamos um e-mail para <span className="font-semibold">{email}</span>{" "}
              com o seu <strong>código de acesso</strong>. Digite-o abaixo, ou
              clique no link do e-mail.
            </p>
            <input
              inputMode="numeric"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              placeholder="········"
              className={authOtpInputClass}
            />
            <button
              onClick={verifyCode}
              disabled={busy || code.length < 6}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? "Verificando…" : "Confirmar código"}
            </button>
            <button
              onClick={() => setStep("credenciais")}
              className="w-full text-center text-xs text-neutral-500 hover:underline"
            >
              Voltar para e-mail e senha
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 w-full max-w-md rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-4 py-3 text-center text-xs leading-relaxed text-neutral-400">
        <strong className="text-neutral-300">Participa de um evento?</strong>{" "}
        Seu acesso é pela página exclusiva do evento — o cadastro acontece lá.
        Use o link enviado pelo organizador.
      </p>
    </div>
  );
}
