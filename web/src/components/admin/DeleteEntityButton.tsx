"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendlyError";

/**
 * Botão de exclusão genérico para entidades do admin (cliente, agência,
 * evento). A permissão de verdade é sempre a RLS da tabela — este botão só
 * evita cliques de quem obviamente não pode; o erro amigável cobre o resto.
 */
export function DeleteEntityButton({
  table,
  id,
  confirmMessage,
  redirectTo,
  label = "Excluir",
}: {
  table: string;
  id: string;
  confirmMessage: string;
  redirectTo: string;
  label?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.from(table).delete().eq("id", id);
    if (rpcErr) {
      setError(friendlyError(rpcErr.message));
      setBusy(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <button
        onClick={handleDelete}
        disabled={busy}
        className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-950 disabled:opacity-40"
      >
        {busy ? "Excluindo…" : label}
      </button>
    </div>
  );
}
