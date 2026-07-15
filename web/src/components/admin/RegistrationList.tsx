"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventField, Registration, RegistrationStatus } from "@/lib/types";

interface RegistrationWithProfile extends Registration {
  profiles: { full_name: string; email: string } | null;
}

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  banned: "Banida",
};

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-neutral-700/40 text-neutral-400",
  banned: "bg-red-500/15 text-red-400",
};

export function RegistrationList({
  eventId,
  fields,
}: {
  eventId: string;
  fields: EventField[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<RegistrationWithProfile[]>([]);
  const [filter, setFilter] = useState<RegistrationStatus | "all">("pending");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("registrations")
      .select("*, profiles(full_name, email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setRows((data as RegistrationWithProfile[]) ?? []);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-regs:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `event_id=eq.${eventId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, load]);

  async function setStatus(reg: Registration, status: RegistrationStatus) {
    await supabase.from("registrations").update({ status }).eq("id", reg.id);
  }

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "banned", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === s
                ? "bg-sky-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {s === "all" ? "Todas" : STATUS_LABELS[s]}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma inscrição aqui.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((reg) => (
            <div
              key={reg.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {reg.profiles?.full_name || "Sem nome"}
                  <span className="ml-2 text-sm font-normal text-neutral-400">
                    {reg.profiles?.email}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {new Date(reg.created_at).toLocaleString("pt-BR")}
                </p>
                {fields.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    {fields.map((f) =>
                      reg.answers[f.id] ? (
                        <div key={f.id}>
                          <dt className="inline text-neutral-500">{f.label}: </dt>
                          <dd className="inline text-neutral-300">{reg.answers[f.id]}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[reg.status]}`}
                >
                  {STATUS_LABELS[reg.status]}
                </span>
                {reg.status !== "approved" && (
                  <button
                    onClick={() => setStatus(reg, "approved")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Aprovar
                  </button>
                )}
                {reg.status === "pending" && (
                  <button
                    onClick={() => setStatus(reg, "rejected")}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800"
                  >
                    Rejeitar
                  </button>
                )}
                {reg.status === "approved" && (
                  <button
                    onClick={() => setStatus(reg, "banned")}
                    className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950"
                  >
                    Banir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
