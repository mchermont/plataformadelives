"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESERVED = [
  "admin", "login", "logout", "auth", "api", "e", "c", "static",
  "assets", "sair", "entrar", "cadastro", "senha", "eventos",
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function NewClientButton({ agencyId }: { agencyId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slug.trim() || slugify(name);

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (effectiveSlug.length < 2) {
      setError("O endereço (slug) precisa ter ao menos 2 caracteres.");
      return;
    }
    if (RESERVED.includes(effectiveSlug)) {
      setError("Esse endereço é reservado pelo sistema. Escolha outro.");
      return;
    }
    setBusy(true);

    const { data: client, error: cErr } = await supabase
      .from("clients")
      .insert({ name: name.trim(), slug: effectiveSlug, agency_id: agencyId ?? null })
      .select()
      .single();

    if (cErr || !client) {
      setError(
        cErr?.message.includes("duplicate") || cErr?.message.includes("unique")
          ? "Já existe um cliente com esse endereço."
          : "Não foi possível criar o cliente.",
      );
      setBusy(false);
      return;
    }

    // Convida o admin do cliente (opcional)
    const email = adminEmail.trim().toLowerCase();
    if (email.includes("@")) {
      await supabase
        .from("client_invites")
        .insert({ client_id: client.id, email, role: "admin" });
    }

    setBusy(false);
    setOpen(false);
    router.push(`/admin/clientes/${client.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
      >
        + Novo cliente
      </button>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="mb-4 text-lg font-bold">Novo cliente</h2>

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
              placeholder="Ex.: Shell"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Endereço da pasta
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3">
              <span className="text-sm text-neutral-500">/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(name) || "shell"}
                className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-neutral-600"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              A página do cliente ficará em lives.propanofilmes.com.br/{effectiveSlug || "…"}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              E-mail do responsável (admin do cliente)
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="responsavel@cliente.com (opcional)"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Ele recebe acesso automático quando entrar na plataforma. Pode
              ficar em branco e ser convidado depois.
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
            {busy ? "Criando…" : "Criar cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
