"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "codigo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendEmail() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
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
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setError("Código inválido ou expirado.");
    } else {
      router.push("/admin");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="mb-6 text-center text-xl font-bold">Entrar na plataforma</h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {step === "email" ? (
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendEmail()}
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500"
            />
            <button
              onClick={sendEmail}
              disabled={busy || !email.includes("@")}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? "Enviando…" : "Receber e-mail de acesso"}
            </button>
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
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none placeholder:text-neutral-700 focus:border-sky-500"
            />
            <button
              onClick={verifyCode}
              disabled={busy || code.length < 6}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? "Verificando…" : "Confirmar código"}
            </button>
            <button
              onClick={() => setStep("email")}
              className="w-full text-center text-xs text-neutral-500 hover:underline"
            >
              Usar outro e-mail
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
