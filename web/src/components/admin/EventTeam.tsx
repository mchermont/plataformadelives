"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ClientRole, EventMember } from "@/lib/types";
import { EVENT_CAPABILITIES } from "@/lib/types";

interface TeamRow {
  user_id: string;
  role: ClientRole;
  profiles: { full_name: string; email: string } | null;
}

type CapabilityKey = (typeof EVENT_CAPABILITIES)[number]["key"];

const EMPTY_CAPS: Record<CapabilityKey, boolean> = {
  can_stream: false,
  can_chat: false,
  can_quiz: false,
  can_registrations: false,
  can_reports: false,
};

/**
 * Funções por evento (as 5 caixas): quem opera o quê neste evento.
 * Os nomes vêm da equipe do cliente — admins do cliente já têm acesso
 * total; colaboradores recebem capacidades marcadas aqui (event_members).
 */
export function EventTeam({
  eventId,
  clientId,
}: {
  eventId: string;
  clientId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [team, setTeam] = useState<TeamRow[]>([]);
  const [caps, setCaps] = useState<Record<string, Record<CapabilityKey, boolean>>>({});
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setLoaded(true);
      return;
    }
    const [{ data: members }, { data: eventMembers }] = await Promise.all([
      supabase
        .from("client_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("client_id", clientId),
      supabase.from("event_members").select("*").eq("event_id", eventId),
    ]);
    setTeam((members as unknown as TeamRow[]) ?? []);
    const byUser: Record<string, Record<CapabilityKey, boolean>> = {};
    for (const em of (eventMembers as EventMember[]) ?? []) {
      byUser[em.user_id] = {
        can_stream: em.can_stream,
        can_chat: em.can_chat,
        can_quiz: em.can_quiz,
        can_registrations: em.can_registrations,
        can_reports: em.can_reports,
      };
    }
    setCaps(byUser);
    setLoaded(true);
  }, [supabase, clientId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(userId: string, key: CapabilityKey) {
    const current = caps[userId] ?? EMPTY_CAPS;
    const next = { ...current, [key]: !current[key] };
    const hasAny = Object.values(next).some(Boolean);

    // Otimista: atualiza a tela, reverte se o banco recusar
    setCaps((c) => ({ ...c, [userId]: next }));
    setSavingFor(userId);
    setError(null);

    const { error: dbError } = hasAny
      ? await supabase
          .from("event_members")
          .upsert({ event_id: eventId, user_id: userId, ...next })
      : await supabase
          .from("event_members")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);

    if (dbError) {
      setCaps((c) => ({ ...c, [userId]: current }));
      setError("Não foi possível salvar. Verifique sua permissão e tente de novo.");
    }
    setSavingFor(null);
  }

  if (!clientId) {
    return (
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Funções neste evento
        </h2>
        <p className="text-sm text-neutral-500">
          Este evento não está vinculado a um cliente, então não há equipe para
          distribuir funções. Eventos novos criados dentro de um cliente têm
          esta seção habilitada.
        </p>
      </section>
    );
  }

  const admins = team.filter((m) => m.role === "admin");
  const collaborators = team.filter((m) => m.role === "collaborator");

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Funções neste evento
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Marque o que cada colaborador da equipe pode operar neste evento.
        Administradores do cliente já têm acesso total. Para adicionar alguém à
        equipe, use a página do cliente.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="text-sm text-neutral-500">Carregando equipe…</p>
      ) : team.length === 0 ? (
        <p className="text-sm text-neutral-500">
          A equipe deste cliente ainda não tem ninguém.{" "}
          <Link href={`/admin/clientes/${clientId}`} className="text-sky-400 hover:underline">
            Convidar pessoas na página do cliente
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="pb-2 pr-4 font-semibold">Pessoa</th>
                {EVENT_CAPABILITIES.map((cap) => (
                  <th key={cap.key} className="pb-2 pr-3 font-semibold" title={cap.hint}>
                    {cap.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((m) => (
                <tr key={m.user_id} className="border-t border-neutral-800">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{m.profiles?.full_name || "Sem nome"}</p>
                    <p className="text-xs text-neutral-500">{m.profiles?.email}</p>
                  </td>
                  <td colSpan={EVENT_CAPABILITIES.length} className="py-3 pr-3">
                    <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs text-neutral-300">
                      Administrador do cliente — acesso total
                    </span>
                  </td>
                </tr>
              ))}
              {collaborators.map((m) => {
                const userCaps = caps[m.user_id] ?? EMPTY_CAPS;
                return (
                  <tr key={m.user_id} className="border-t border-neutral-800">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{m.profiles?.full_name || "Sem nome"}</p>
                      <p className="text-xs text-neutral-500">{m.profiles?.email}</p>
                    </td>
                    {EVENT_CAPABILITIES.map((cap) => (
                      <td key={cap.key} className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={userCaps[cap.key]}
                          disabled={savingFor === m.user_id}
                          onChange={() => toggle(m.user_id, cap.key)}
                          title={cap.hint}
                          className="h-4 w-4 accent-sky-500 disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {collaborators.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">
              Nenhum colaborador ainda — só administradores.{" "}
              <Link href={`/admin/clientes/${clientId}`} className="text-sky-400 hover:underline">
                Convide colaboradores na página do cliente
              </Link>{" "}
              para distribuir funções.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
