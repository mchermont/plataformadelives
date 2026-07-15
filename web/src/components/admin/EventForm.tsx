"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  AccessMode,
  EventField,
  EventStatus,
  FieldType,
  LiveEvent,
  StreamProvider,
} from "@/lib/types";
import {
  ACCESS_MODE_LABELS,
  EVENT_STATUS_LABELS,
  PROVIDER_LABELS,
} from "@/lib/types";

interface EventFormProps {
  event?: LiveEvent;
  fields?: EventField[];
  userId: string;
}

interface DraftField {
  id?: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string; // separadas por vírgula na edição
}

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500";
const labelClass = "mb-1.5 block text-sm font-medium";

export function EventForm({ event, fields, userId }: EventFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState({
    title: event?.title ?? "",
    slug: event?.slug ?? "",
    description: event?.description ?? "",
    starts_at: event?.starts_at ? event.starts_at.slice(0, 16) : "",
    status: (event?.status ?? "draft") as EventStatus,
    stream_provider: (event?.stream_provider ?? "youtube") as StreamProvider,
    stream_ref: event?.stream_ref ?? "",
    access_mode: (event?.access_mode ?? "open") as AccessMode,
    allowed_domains: event?.allowed_domains.join(", ") ?? "",
    google_login_enabled: event?.google_login_enabled ?? true,
    capacity: event?.capacity ?? 1000,
    chat_enabled: event?.chat_enabled ?? true,
    quiz_enabled: event?.quiz_enabled ?? true,
    brand_color: event?.brand_color ?? "#0284c7",
    brand_logo_url: event?.brand_logo_url ?? "",
    cover_url: event?.cover_url ?? "",
  });
  const [uploading, setUploading] = useState<"logo" | "capa" | null>(null);

  const [draftFields, setDraftFields] = useState<DraftField[]>(
    (fields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      field_type: f.field_type,
      required: f.required,
      options: f.options.join(", "),
    })),
  );
  const [removedFieldIds, setRemovedFieldIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  async function save() {
    setBusy(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      description: form.description.trim(),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      status: form.status,
      stream_provider: form.stream_provider,
      stream_ref: form.stream_ref.trim(),
      access_mode: form.access_mode,
      allowed_domains: form.allowed_domains
        .split(",")
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
      google_login_enabled: form.google_login_enabled,
      capacity: form.capacity,
      chat_enabled: form.chat_enabled,
      quiz_enabled: form.quiz_enabled,
      brand_color: form.brand_color,
      brand_logo_url: form.brand_logo_url || null,
      cover_url: form.cover_url || null,
    };

    let eventId = event?.id;

    if (event) {
      const { error } = await supabase.from("events").update(payload).eq("id", event.id);
      if (error) {
        setError(errorMessage(error.message));
        setBusy(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();
      if (error || !data) {
        setError(errorMessage(error?.message ?? ""));
        setBusy(false);
        return;
      }
      eventId = data.id;
    }

    // Campos personalizados: remove os excluídos, faz upsert dos demais
    if (removedFieldIds.length > 0) {
      await supabase.from("event_fields").delete().in("id", removedFieldIds);
    }
    for (let i = 0; i < draftFields.length; i++) {
      const f = draftFields[i];
      const fieldPayload = {
        event_id: eventId,
        label: f.label.trim(),
        field_type: f.field_type,
        required: f.required,
        options:
          f.field_type === "select"
            ? f.options.split(",").map((o) => o.trim()).filter(Boolean)
            : [],
        position: i,
      };
      if (!fieldPayload.label) continue;
      if (f.id) {
        await supabase.from("event_fields").update(fieldPayload).eq("id", f.id);
      } else {
        await supabase.from("event_fields").insert(fieldPayload);
      }
    }

    router.push("/admin");
    router.refresh();
  }

  async function uploadImage(file: File, kind: "logo" | "capa") {
    setUploading(kind);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file);
    if (error) {
      setError("Falha no upload da imagem. Tente novamente.");
    } else {
      const url = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
      set(kind === "logo" ? "brand_logo_url" : "cover_url", url);
    }
    setUploading(null);
  }

  function errorMessage(message: string): string {
    if (message.includes("events_slug_key")) return "Já existe um evento com esse slug.";
    if (message.includes("slug")) return "Slug inválido: use letras minúsculas, números e hífens (mín. 3).";
    return "Não foi possível salvar o evento.";
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Informações básicas
        </h2>
        <div>
          <label className={labelClass}>Título *</label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Slug (URL)</label>
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder={slugify(form.title) || "meu-evento"}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Início</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as EventStatus)}
            className={inputClass}
          >
            {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Rascunho fica invisível; Ao vivo libera player e chat.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Vídeo
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fonte</label>
            <select
              value={form.stream_provider}
              onChange={(e) => set("stream_provider", e.target.value as StreamProvider)}
              className={inputClass}
            >
              {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>ID ou URL da transmissão</label>
            <input
              value={form.stream_ref}
              onChange={(e) => set("stream_ref", e.target.value)}
              placeholder="URL do vídeo/live ou ID"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Controle de acesso
        </h2>
        <div>
          <label className={labelClass}>Modo</label>
          <select
            value={form.access_mode}
            onChange={(e) => set("access_mode", e.target.value as AccessMode)}
            className={inputClass}
          >
            {Object.entries(ACCESS_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {form.access_mode === "domain" && (
          <div>
            <label className={labelClass}>Domínios permitidos (separados por vírgula)</label>
            <input
              value={form.allowed_domains}
              onChange={(e) => set("allowed_domains", e.target.value)}
              placeholder="empresa.com.br, parceiro.com"
              className={inputClass}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.google_login_enabled}
              onChange={(e) => set("google_login_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Permitir login com Google
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.chat_enabled}
              onChange={(e) => set("chat_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Chat
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.quiz_enabled}
              onChange={(e) => set("quiz_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Quiz
          </label>
        </div>
        <div>
          <label className={labelClass}>Capacidade</label>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => set("capacity", Number(e.target.value) || 1000)}
            className={inputClass}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Identidade visual (white-label)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Cor da marca</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.brand_color}
                onChange={(e) => set("brand_color", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-neutral-700 bg-neutral-950"
              />
              <input
                value={form.brand_color}
                onChange={(e) => set("brand_color", e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Usada em botões e destaques na página do evento.
            </p>
          </div>
          <div>
            <label className={labelClass}>Logo do evento/cliente</label>
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
              className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
            />
            {uploading === "logo" && (
              <p className="mt-1 text-xs text-neutral-500">Enviando…</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Capa (página de cadastro)</label>
            {form.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.cover_url}
                alt="Capa"
                className="mb-2 h-16 w-full rounded object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "capa");
              }}
              className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
            />
            {uploading === "capa" && (
              <p className="mt-1 text-xs text-neutral-500">Enviando…</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Campos do cadastro
          </h2>
          <button
            onClick={() =>
              setDraftFields((f) => [
                ...f,
                { label: "", field_type: "text", required: false, options: "" },
              ])
            }
            className="text-sm text-sky-400 hover:underline"
          >
            + Adicionar campo
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Nome e e-mail já são pedidos sempre. Adicione aqui campos extras
          (empresa, cargo, aceite de termos…).
        </p>
        {draftFields.map((field, i) => (
          <div
            key={field.id ?? `novo-${i}`}
            className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-3 rounded-lg border border-neutral-800 p-3"
          >
            <div>
              <label className={labelClass}>Rótulo</label>
              <input
                value={field.label}
                onChange={(e) =>
                  setDraftFields((fs) =>
                    fs.map((f, j) => (j === i ? { ...f, label: e.target.value } : f)),
                  )
                }
                placeholder="Ex.: Empresa"
                className={inputClass}
              />
              {field.field_type === "select" && (
                <input
                  value={field.options}
                  onChange={(e) =>
                    setDraftFields((fs) =>
                      fs.map((f, j) => (j === i ? { ...f, options: e.target.value } : f)),
                    )
                  }
                  placeholder="Opções separadas por vírgula"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            <select
              value={field.field_type}
              onChange={(e) =>
                setDraftFields((fs) =>
                  fs.map((f, j) =>
                    j === i ? { ...f, field_type: e.target.value as FieldType } : f,
                  ),
                )
              }
              className={`${inputClass} w-auto`}
            >
              <option value="text">Texto</option>
              <option value="select">Seleção</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <label className="flex items-center gap-1.5 pb-2 text-sm">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  setDraftFields((fs) =>
                    fs.map((f, j) => (j === i ? { ...f, required: e.target.checked } : f)),
                  )
                }
                className="h-4 w-4 accent-sky-500"
              />
              Obrigatório
            </label>
            <button
              onClick={() => {
                if (field.id) setRemovedFieldIds((ids) => [...ids, field.id!]);
                setDraftFields((fs) => fs.filter((_, j) => j !== i));
              }}
              className="pb-2 text-sm text-red-400 hover:underline"
            >
              Remover
            </button>
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={busy || !form.title.trim()}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? "Salvando…" : event ? "Salvar alterações" : "Criar evento"}
        </button>
        <button
          onClick={() => router.push("/admin")}
          className="rounded-lg border border-neutral-700 px-6 py-2.5 text-sm font-semibold transition hover:bg-neutral-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
