"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientRole } from "@/lib/types";
import { CLIENT_ROLE_LABELS } from "@/lib/types";

interface MemberRow {
  user_id: string;
  role: ClientRole;
  profiles: { full_name: string; email: string } | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: ClientRole;
}

type OrgKind = "client" | "agency";

/**
 * Gestão de equipe estilo Google Drive, reutilizada por Cliente e Agência.
 * Convida por e-mail (RPC resolve os dois casos), muda papel e remove.
 */
export function OrgTeam({
  kind,
  orgId,
  currentUserId,
  title = "Equipe",
  description,
}: {
  kind: OrgKind;
  orgId: string;
  currentUserId: string;
  title?: string;
  description?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const idColumn = `${kind}_id`;
  const membersTable = `${kind}_members`;
  const invitesTable = `${kind}_invites`;
  const inviteRpc = `invite_to_${kind}`;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClientRole>("collaborator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase
        .from(membersTable)
        .select("user_id, role, profiles(full_name, email)")
        .eq(idColumn, orgId),
      supabase
        .from(invitesTable)
        .select("id, email, role")
        .eq(idColumn, orgId)
        .is("accepted_at", null),
    ]);
    setMembers((m as unknown as MemberRow[]) ?? []);
    setInvites((inv as InviteRow[]) ?? []);
  }, [supabase, membersTable, invitesTable, idColumn, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc(inviteRpc, {
      [`p_${kind}_id`]: orgId,
      p_email: clean,
      p_role: role,
    });
    if (rpcErr) {
      setError("Não foi possível convidar. Tente novamente.");
      setBusy(false);
      return;
    }
    setEmail("");
    setRole("collaborator");
    await load();
    setBusy(false);
  }

  async function changeRole(userId: string, newRole: ClientRole) {
    await supabase
      .from(membersTable)
      .update({ role: newRole })
      .eq(idColumn, orgId)
      .eq("user_id", userId);
    await load();
  }

  async function removeMember(userId: string) {
    await supabase
      .from(membersTable)
      .delete()
      .eq(idColumn, orgId)
      .eq("user_id", userId);
    await load();
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from(invitesTable).delete().eq("id", inviteId);
    await load();
  }

  const inputClass =
    "rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        {description ??
          "Administradores gerenciam eventos e a equipe. Colaboradores recebem funções específicas por evento (chat, quiz, inscrições…)."}
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="e-mail da pessoa"
          className={`${inputClass} min-w-56 flex-1`}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ClientRole)}
          className={inputClass}
        >
          <option value="collaborator">Colaborador</option>
          <option value="admin">Administrador</option>
        </select>
        <button
          onClick={invite}
          disabled={busy || !email.includes("@")}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          Convidar
        </button>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 px-4 py-3"
          >
            <div>
              <p className="font-medium">
                {m.profiles?.full_name || "Sem nome"}
                {m.user_id === currentUserId && (
                  <span className="ml-2 text-xs text-neutral-500">(você)</span>
                )}
              </p>
              <p className="text-sm text-neutral-400">{m.profiles?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {m.user_id === currentUserId ? (
                <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300">
                  {CLIENT_ROLE_LABELS[m.role]}
                </span>
              ) : (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as ClientRole)}
                    className={`${inputClass} py-1.5 text-xs`}
                  >
                    <option value="collaborator">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-800 px-4 py-3"
          >
            <div>
              <p className="font-medium text-neutral-300">{inv.email}</p>
              <p className="text-xs text-amber-400">
                Convite pendente · {CLIENT_ROLE_LABELS[inv.role]}
              </p>
            </div>
            <button
              onClick={() => cancelInvite(inv.id)}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
            >
              Cancelar convite
            </button>
          </div>
        ))}

        {members.length === 0 && invites.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum membro ainda. Convide alguém pelo e-mail acima.
          </p>
        )}
      </div>
    </section>
  );
}
