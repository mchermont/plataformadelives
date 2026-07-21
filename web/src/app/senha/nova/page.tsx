"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authInputClass as inputClass, authOtpInputClass } from "@/lib/authInputClass";

export default function NovaSenhaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se veio pelo link do e-mail, já há sessão e basta definir a senha.
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user));
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("email");
    if (prefill) setEmail(prefill);
  }, [supabase]);

  function validatePassword(): boolean {
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return false;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return false;
    }
    return true;
  }

  async function save() {
    if (!validatePassword()) return;
    setBusy(true);
    setError(null);

    // Sem sessão: valida primeiro o código de recuperação enviado por e-mail
    if (!hasSession) {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "recovery",
      });
      if (error) {
        setError("Código inválido ou expirado. Peça um novo em 'Esqueci minha senha'.");
        setBusy(false);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Não foi possível salvar a senha. Tente novamente.");
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="mb-2 text-center text-xl font-bold">Definir nova senha</h1>
        <p className="mb-6 text-center text-sm text-neutral-400">
          {hasSession
            ? "Escolha a senha que você usará para entrar na plataforma."
            : "Digite o código que enviamos por e-mail e escolha a nova senha."}
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {hasSession === false && (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={inputClass}
              />
              <input
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="········"
                className={authOtpInputClass}
              />
            </>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            className={inputClass}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Repita a nova senha"
            className={inputClass}
          />
          <button
            onClick={save}
            disabled={
              busy ||
              hasSession === null ||
              password.length === 0 ||
              confirm.length === 0 ||
              (hasSession === false && (code.length < 6 || !email.includes("@")))
            }
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Salvar senha e entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
