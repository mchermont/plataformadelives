"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Attendance,
  EventField,
  LeaderboardRow,
  LiveEvent,
  Registration,
  RegistrationStatus,
} from "@/lib/types";

interface PersonInfo {
  full_name: string;
  email: string;
}

interface RegistrationRow extends Registration {
  profiles: PersonInfo | null;
}

interface AttendanceRow extends Attendance {
  profiles: PersonInfo | null;
}

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  banned: "Banida",
};

/** Gera e baixa um CSV compatível com Excel pt-BR (separador ; e BOM UTF-8). */
function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const body = rows.map((row) => row.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "";
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export function ReportView({
  event,
  fields,
}: {
  event: LiveEvent;
  fields: EventField[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: regs }, { data: att }, { data: board }] = await Promise.all([
      supabase
        .from("registrations")
        .select("*, profiles(full_name, email)")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_attendance")
        .select("*, profiles(full_name, email)")
        .eq("event_id", event.id)
        .order("first_joined_at", { ascending: true }),
      supabase
        .from("quiz_leaderboard")
        .select("*")
        .eq("event_id", event.id)
        .order("score", { ascending: false }),
    ]);
    setRegistrations((regs as RegistrationRow[]) ?? []);
    setAttendance((att as AttendanceRow[]) ?? []);
    setLeaderboard((board as LeaderboardRow[]) ?? []);
    setLoading(false);
  }, [supabase, event.id]);

  useEffect(() => {
    load();
  }, [load]);

  const approved = registrations.filter((r) => r.status === "approved").length;
  const pending = registrations.filter((r) => r.status === "pending").length;
  const showRate =
    approved > 0 ? Math.round((attendance.length / approved) * 100) : 0;
  const totalWatchMinutes = Math.round(
    attendance.reduce((sum, a) => sum + a.watch_seconds, 0) / 60,
  );

  function exportRegistrations() {
    downloadCsv(`inscricoes-${event.slug}.csv`, [
      ["Nome", "E-mail", "Status", "Inscrito em", ...fields.map((f) => f.label)],
      ...registrations.map((r) => [
        r.profiles?.full_name ?? "",
        r.profiles?.email ?? "",
        STATUS_LABELS[r.status],
        formatDateTime(r.created_at),
        ...fields.map((f) => r.answers[f.id] ?? ""),
      ]),
    ]);
  }

  function exportAttendance() {
    downloadCsv(`presenca-${event.slug}.csv`, [
      ["Nome", "E-mail", "Entrou às", "Visto por último", "Tempo assistido (min)"],
      ...attendance.map((a) => [
        a.profiles?.full_name ?? "",
        a.profiles?.email ?? "",
        formatDateTime(a.first_joined_at),
        formatDateTime(a.last_seen_at),
        String(Math.round(a.watch_seconds / 60)),
      ]),
    ]);
  }

  function exportQuiz() {
    downloadCsv(`quiz-${event.slug}.csv`, [
      ["Posição", "Nome", "Acertos", "Pontuação"],
      ...leaderboard.map((row, i) => [
        String(i + 1),
        row.full_name,
        String(row.correct_count),
        String(row.score),
      ]),
    ]);
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Carregando…</p>;
  }

  const stats = [
    { label: "Inscrições", value: registrations.length },
    { label: "Aprovadas", value: approved },
    { label: "Pendentes", value: pending },
    { label: "Compareceram", value: attendance.length },
    { label: "Comparecimento", value: `${showRate}%` },
    { label: "Tempo assistido (total)", value: `${totalWatchMinutes} min` },
  ];

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-800 p-4"
          >
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-neutral-400">{stat.label}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Presença ({attendance.length})
          </h2>
          <button
            onClick={exportAttendance}
            disabled={attendance.length === 0}
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40"
          >
            <Download className="size-3.5" /> Exportar CSV
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Ninguém entrou na sala ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Participante</th>
                  <th className="px-4 py-2.5 font-medium">Entrou às</th>
                  <th className="px-4 py-2.5 font-medium">Visto por último</th>
                  <th className="px-4 py-2.5 font-medium">Tempo assistido</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.user_id} className="border-t border-neutral-800">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {a.profiles?.full_name || "Sem nome"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {a.profiles?.email}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-300">
                      {formatDateTime(a.first_joined_at)}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-300">
                      {formatDateTime(a.last_seen_at)}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-300">
                      {formatMinutes(a.watch_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Inscrições ({registrations.length})
          </h2>
          <button
            onClick={exportRegistrations}
            disabled={registrations.length === 0}
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40"
          >
            <Download className="size-3.5" /> Exportar CSV
          </button>
        </div>
        <p className="text-sm text-neutral-500">
          O CSV inclui todos os campos personalizados do cadastro
          {fields.length > 0 && ` (${fields.map((f) => f.label).join(", ")})`}.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Quiz — classificação final ({leaderboard.length})
          </h2>
          <button
            onClick={exportQuiz}
            disabled={leaderboard.length === 0}
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-40"
          >
            <Download className="size-3.5" /> Exportar CSV
          </button>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma resposta de quiz registrada neste evento.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Participante</th>
                  <th className="px-4 py-2.5 font-medium">Acertos</th>
                  <th className="px-4 py-2.5 font-medium">Pontuação</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.user_id} className="border-t border-neutral-800">
                    <td className="px-4 py-2.5 font-mono text-neutral-500">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.full_name}</td>
                    <td className="px-4 py-2.5 tabular-nums text-neutral-300">
                      {row.correct_count}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {row.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
