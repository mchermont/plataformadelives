"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NovaSenhaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(
        "Não foi possível salvar. O link pode ter expirado — peça um novo em 'Esqueci minha senha'.",
      );
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <h1 className="mb-2 text-center text-xl font-bold">Definir nova senha</h1>
        <p className="mb-6 text-center text-sm text-neutral-400">
          Escolha a senha que você usará para entrar na plataforma.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-4">
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
            disabled={busy || password.length === 0 || confirm.length === 0}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Salvar senha e entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
