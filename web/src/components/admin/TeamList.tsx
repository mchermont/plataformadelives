"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function TeamList({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    setProfiles((data as Profile[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleModerator(profile: Profile) {
    setError(null);
    const { error } = await supabase.rpc("set_moderator", {
      p_user_id: profile.id,
      p_is_moderator: !profile.is_moderator,
    });
    if (error) {
      setError("Não foi possível alterar. Tente novamente.");
    } else {
      await load();
    }
  }

  async function deleteAccount(profile: Profile) {
    if (
      !confirm(
        `Excluir a conta de ${profile.full_name || profile.email}? Essa ação não pode ser desfeita — a pessoa perde o acesso a toda a plataforma.`,
      )
    )
      return;
    setError(null);
    const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Não foi possível excluir esta conta.");
      return;
    }
    await load();
  }

  // Sem busca: só quem já é equipe da plataforma (admin/moderador) — a
  // tabela profiles tem todo mundo que já logou, participante incluso.
  // Buscar por nome/e-mail abre pra qualquer pessoa, pra dar pra promover
  // alguém que ainda não é moderador.
  const term = search.trim().toLowerCase();
  const visible = term
    ? profiles.filter(
        (p) =>
          p.email.toLowerCase().includes(term) ||
          p.full_name.toLowerCase().includes(term),
      )
    : profiles.filter((p) => p.is_platform_admin || p.is_moderator);

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou e-mail…"
        className="mb-4 w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500"
      />

      <div className="space-y-2">
        {visible.map((profile) => (
          <div
            key={profile.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 px-4 py-3"
          >
            <div>
              <p className="font-medium">
                {profile.full_name || "Sem nome"}
                {profile.id === currentUserId && (
                  <span className="ml-2 text-xs text-neutral-500">(você)</span>
                )}
              </p>
              <p className="text-sm text-neutral-400">{profile.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {profile.is_platform_admin ? (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-400">
                  Admin
                </span>
              ) : (
                <>
                  {profile.is_moderator && (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      Moderador
                    </span>
                  )}
                  <button
                    onClick={() => toggleModerator(profile)}
                    className={
                      profile.is_moderator
                        ? "rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800"
                        : "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    }
                  >
                    {profile.is_moderator ? "Remover moderação" : "Tornar moderador"}
                  </button>
                </>
              )}
              {profile.id !== currentUserId && (
                <button
                  onClick={() => deleteAccount(profile)}
                  className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950"
                >
                  Excluir conta
                </button>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-neutral-400">
            Nenhum usuário encontrado.
          </p>
        )}
      </div>
    </div>
  );
}
