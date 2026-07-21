"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewAgencyButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da agência/produtora.");
      return;
    }
    setBusy(true);

    const { data: agency, error: aErr } = await supabase
      .from("agencies")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (aErr || !agency) {
      setError("Não foi possível criar a agência.");
      setBusy(false);
      return;
    }

    const email = adminEmail.trim().toLowerCase();
    if (email.includes("@")) {
      await supabase.rpc("invite_to_agency", {
        p_agency_id: agency.id,
        p_email: email,
        p_role: "admin",
      });
    }

    setBusy(false);
    setOpen(false);
    router.push(`/admin/agencias/${agency.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
      >
        + Nova agência
      </button>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-4 text-lg font-bold">Nova agência / produtora</h2>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Agência XYZ"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              E-mail do responsável (admin da agência)
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="responsavel@agencia.com (opcional)"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Ele gerencia os clientes e a equipe da agência. Recebe acesso
              automático ao entrar na plataforma.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold transition hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Criando…" : "Criar agência"}
          </button>
        </div>
      </div>
    </div>
  );
}
