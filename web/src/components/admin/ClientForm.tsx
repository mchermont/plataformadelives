"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Client, FolderVisibility } from "@/lib/types";
import { FOLDER_VISIBILITY_LABELS } from "@/lib/types";

type ImageKind = "logo" | "bg" | "bgMobile";

const IMAGE_FIELD: Record<ImageKind, "brand_logo_url" | "bg_image_url" | "bg_image_mobile_url"> = {
  logo: "brand_logo_url",
  bg: "bg_image_url",
  bgMobile: "bg_image_mobile_url",
};

const inputClass =
  "w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";
const labelClass = "mb-1.5 block text-sm font-medium";
const fileClass =
  "block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700";

/** Página pública e identidade visual do cliente (usada na agregadora /slug). */
export function ClientForm({ client }: { client: Client }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState({
    name: client.name,
    slug: client.slug,
    folder_visibility: client.folder_visibility as FolderVisibility,
    brand_color: client.brand_color,
    brand_logo_url: client.brand_logo_url ?? "",
    bg_image_url: client.bg_image_url ?? "",
    bg_image_mobile_url: client.bg_image_mobile_url ?? "",
  });
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function uploadImage(file: File, kind: ImageKind) {
    setUploading(kind);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `cliente-${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file);
    if (error) {
      setError("Falha no upload da imagem. Tente novamente.");
    } else {
      const url = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
      set(IMAGE_FIELD[kind], url);
    }
    setUploading(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("clients")
      .update({
        name: form.name.trim(),
        slug: form.slug.trim(),
        folder_visibility: form.folder_visibility,
        brand_color: form.brand_color,
        brand_logo_url: form.brand_logo_url || null,
        bg_image_url: form.bg_image_url || null,
        bg_image_mobile_url: form.bg_image_mobile_url || null,
      })
      .eq("id", client.id);
    if (error) {
      if (error.message.includes("clients_slug_key")) {
        setError("Já existe um cliente com esse endereço (slug).");
      } else if (error.message.includes("slug")) {
        setError("Endereço inválido: use letras minúsculas, números e hífens (2 a 40).");
      } else {
        setError("Não foi possível salvar. Tente novamente.");
      }
    } else {
      setSaved(true);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Página pública e identidade
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Aparência da página{" "}
        <a
          href={`/${client.slug}`}
          target="_blank"
          className="text-sky-400 hover:underline"
        >
          /{client.slug}
        </a>{" "}
        e identidade padrão do cliente.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="space-y-4 rounded-xl border border-neutral-800 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Endereço (slug)</label>
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              className={`${inputClass} font-mono`}
            />
            <p className="mt-1 text-xs text-amber-500/80">
              Mudar o endereço quebra links já divulgados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Visibilidade da página</label>
            <select
              value={form.folder_visibility}
              onChange={(e) => set("folder_visibility", e.target.value as FolderVisibility)}
              className={inputClass}
            >
              {Object.entries(FOLDER_VISIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Eventos por link direto funcionam em qualquer visibilidade.
            </p>
          </div>
          <div>
            <label className={labelClass}>Cor da marca</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.brand_color}
                onChange={(e) => set("brand_color", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-neutral-800 bg-neutral-950"
              />
              <input
                value={form.brand_color}
                onChange={(e) => set("brand_color", e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Logo (PNG, até 800×320)</label>
            {form.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.brand_logo_url}
                alt="Logo"
                className="mb-2 h-10 rounded bg-neutral-900 object-contain p-1"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "logo");
              }}
              className={fileClass}
            />
            {uploading === "logo" && <p className="mt-1 text-xs text-neutral-500">Enviando…</p>}
          </div>
          <div>
            <label className={labelClass}>Fundo (desktop, 1920×1080)</label>
            {form.bg_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.bg_image_url}
                alt="Fundo"
                className="mb-2 h-14 w-full rounded object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "bg");
              }}
              className={fileClass}
            />
            {uploading === "bg" && <p className="mt-1 text-xs text-neutral-500">Enviando…</p>}
          </div>
          <div>
            <label className={labelClass}>Fundo mobile (1080×1920, opcional)</label>
            {form.bg_image_mobile_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.bg_image_mobile_url}
                alt="Fundo mobile"
                className="mb-2 h-14 w-full rounded object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "bgMobile");
              }}
              className={fileClass}
            />
            {uploading === "bgMobile" && (
              <p className="mt-1 text-xs text-neutral-500">Enviando…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy || !form.name.trim() || !form.slug.trim()}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Salvando…" : "Salvar"}
          </button>
          {saved && <span className="text-sm text-emerald-400">Salvo!</span>}
        </div>
      </div>
    </section>
  );
}
