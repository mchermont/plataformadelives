"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  EventAllowlistEntry,
  EventField,
  EventStatus,
  FieldType,
  LiveEvent,
  RegistrationMode,
  StreamProvider,
} from "@/lib/types";
import {
  EVENT_STATUS_LABELS,
  PROVIDER_LABELS,
  REGISTRATION_MODE_LABELS,
} from "@/lib/types";

interface EventFormProps {
  event?: LiveEvent;
  fields?: EventField[];
  allowlist?: EventAllowlistEntry[];
  userId: string;
  clientId?: string;
}

type ImageKind = "logo" | "bg" | "bgMobile" | "card" | "sponsor";

const IMAGE_FIELD: Record<Exclude<ImageKind, "sponsor">, "brand_logo_url" | "bg_image_url" | "bg_image_mobile_url" | "card_image_url"> = {
  logo: "brand_logo_url",
  bg: "bg_image_url",
  bgMobile: "bg_image_mobile_url",
  card: "card_image_url",
};

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

export function EventForm({ event, fields, allowlist, userId, clientId }: EventFormProps) {
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
    registration_mode: (event?.registration_mode ?? "open") as RegistrationMode,
    allowed_domains: event?.allowed_domains.join(", ") ?? "",
    require_approval: event?.require_approval ?? false,
    allowlist_fallback_approval: event?.allowlist_fallback_approval ?? false,
    consent_text: event?.consent_text ?? "",
    google_login_enabled: event?.google_login_enabled ?? true,
    capacity: event?.capacity ?? 1000,
    chat_enabled: event?.chat_enabled ?? true,
    chat_moderation: event?.chat_moderation ?? false,
    quiz_enabled: event?.quiz_enabled ?? true,
    qa_enabled: event?.qa_enabled ?? false,
    gallery_enabled: event?.gallery_enabled ?? false,
    qa_allow_anonymous: event?.qa_allow_anonymous ?? true,
    qa_moderation: event?.qa_moderation ?? false,
    brand_color: event?.brand_color ?? "#0284c7",
    brand_logo_url: event?.brand_logo_url ?? "",
    bg_image_url: event?.bg_image_url ?? "",
    bg_image_mobile_url: event?.bg_image_mobile_url ?? "",
    card_image_url: event?.card_image_url ?? "",
    sponsor_logos: event?.sponsor_logos ?? ([] as string[]),
    listed_on_client_page: event?.listed_on_client_page ?? true,
    accept_client_base: event?.accept_client_base ?? false,
  });
  const [uploading, setUploading] = useState<ImageKind | null>(null);

  const belongsToClient = Boolean(clientId ?? event?.client_id);

  const [allowlistEmails, setAllowlistEmails] = useState<string[]>(
    (allowlist ?? []).map((a) => a.email),
  );
  const [newEmailsText, setNewEmailsText] = useState("");
  const [allowlistBusy, setAllowlistBusy] = useState(false);

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
      registration_mode: form.registration_mode,
      allowed_domains: form.allowed_domains
        .split(",")
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
      require_approval: form.require_approval,
      allowlist_fallback_approval: form.allowlist_fallback_approval,
      consent_text: form.consent_text.trim(),
      google_login_enabled: form.google_login_enabled,
      capacity: form.capacity,
      chat_enabled: form.chat_enabled,
      chat_moderation: form.chat_moderation,
      quiz_enabled: form.quiz_enabled,
      qa_enabled: form.qa_enabled,
      gallery_enabled: form.gallery_enabled,
      qa_allow_anonymous: form.qa_allow_anonymous,
      qa_moderation: form.qa_moderation,
      brand_color: form.brand_color,
      brand_logo_url: form.brand_logo_url || null,
      bg_image_url: form.bg_image_url || null,
      bg_image_mobile_url: form.bg_image_mobile_url || null,
      card_image_url: form.card_image_url || null,
      sponsor_logos: form.sponsor_logos,
      ...(belongsToClient
        ? {
            listed_on_client_page: form.listed_on_client_page,
            accept_client_base: form.accept_client_base,
          }
        : {}),
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
        .insert({ ...payload, created_by: userId, client_id: clientId ?? null })
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

    const backTo = clientId
      ? `/admin/clientes/${clientId}`
      : event?.client_id
        ? `/admin/clientes/${event.client_id}`
        : "/admin";
    router.push(backTo);
    router.refresh();
  }

  async function uploadImage(file: File, kind: ImageKind) {
    setUploading(kind);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file);
    if (error) {
      setError("Falha no upload da imagem. Tente novamente.");
    } else {
      const url = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
      if (kind === "sponsor") {
        setForm((f) => ({ ...f, sponsor_logos: [...f.sponsor_logos, url] }));
      } else {
        set(IMAGE_FIELD[kind], url);
      }
    }
    setUploading(null);
  }

  function removeSponsorLogo(url: string) {
    setForm((f) => ({ ...f, sponsor_logos: f.sponsor_logos.filter((u) => u !== url) }));
  }

  async function addAllowlistEmails() {
    if (!event?.id) return;
    const emails = Array.from(
      new Set(
        newEmailsText
          .split(/[\n,;]/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@") && !allowlistEmails.includes(e)),
      ),
    );
    if (emails.length === 0) return;
    setAllowlistBusy(true);
    const { error } = await supabase
      .from("event_allowlist")
      .upsert(emails.map((email) => ({ event_id: event.id, email })));
    if (!error) {
      setAllowlistEmails((prev) => [...prev, ...emails]);
      setNewEmailsText("");
    } else {
      setError("Não foi possível adicionar os e-mails.");
    }
    setAllowlistBusy(false);
  }

  async function removeAllowlistEmail(email: string) {
    if (!event?.id) return;
    setAllowlistBusy(true);
    const { error } = await supabase
      .from("event_allowlist")
      .delete()
      .eq("event_id", event.id)
      .eq("email", email);
    if (!error) {
      setAllowlistEmails((prev) => prev.filter((e) => e !== email));
    }
    setAllowlistBusy(false);
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
          <label className={labelClass}>Modo de inscrição</label>
          <select
            value={form.registration_mode}
            onChange={(e) => set("registration_mode", e.target.value as RegistrationMode)}
            className={inputClass}
          >
            {Object.entries(REGISTRATION_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {form.registration_mode === "domain" && (
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
        {form.registration_mode === "allowlist" && (
          <div className="space-y-3 rounded-lg border border-neutral-800 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allowlist_fallback_approval}
                onChange={(e) => set("allowlist_fallback_approval", e.target.checked)}
                className="h-4 w-4 accent-sky-500"
              />
              Quem não estiver na lista pode se inscrever mesmo assim, como pendente de aprovação
            </label>
            {!event?.id ? (
              <p className="text-xs text-neutral-500">
                Salve o evento para gerenciar a lista de e-mails convidados.
              </p>
            ) : (
              <>
                <label className={labelClass}>Adicionar e-mails (um por linha, ou separados por vírgula)</label>
                <textarea
                  value={newEmailsText}
                  onChange={(e) => setNewEmailsText(e.target.value)}
                  rows={3}
                  placeholder={"fulano@empresa.com\nciclana@empresa.com"}
                  className={inputClass}
                />
                <button
                  onClick={addAllowlistEmails}
                  disabled={allowlistBusy || !newEmailsText.trim()}
                  className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-semibold transition hover:bg-neutral-800 disabled:opacity-40"
                >
                  Adicionar à lista
                </button>
                <p className="text-xs text-neutral-500">
                  {allowlistEmails.length} e-mail(s) na lista.
                </p>
                {allowlistEmails.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {allowlistEmails.map((email) => (
                      <li
                        key={email}
                        className="flex items-center justify-between gap-2 rounded bg-neutral-900 px-2 py-1"
                      >
                        <span className="truncate">{email}</span>
                        <button
                          onClick={() => removeAllowlistEmail(email)}
                          disabled={allowlistBusy}
                          className="shrink-0 text-xs text-red-400 hover:underline disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.require_approval}
            onChange={(e) => set("require_approval", e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          Toda inscrição precisa de aprovação manual do organizador
        </label>
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
              checked={form.quiz_enabled}
              onChange={(e) => set("quiz_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Quiz
          </label>
        </div>
        {/* cada recurso com suas sub-opções logo abaixo (hierarquia clara) */}
        <div className="space-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.chat_enabled}
              onChange={(e) => set("chat_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Chat
          </label>
          {form.chat_enabled && (
            <label className="ml-6 flex items-center gap-2 text-neutral-300">
              <input
                type="checkbox"
                checked={form.chat_moderation}
                onChange={(e) => set("chat_moderation", e.target.checked)}
                className="h-4 w-4 accent-sky-500"
              />
              Aprovar mensagens do chat antes de publicar
            </label>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.qa_enabled}
              onChange={(e) => set("qa_enabled", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Perguntas do público (Q&amp;A)
          </label>
          {form.qa_enabled && (
            <div className="ml-6 flex flex-wrap gap-x-5 gap-y-2 text-neutral-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.qa_allow_anonymous}
                  onChange={(e) => set("qa_allow_anonymous", e.target.checked)}
                  className="h-4 w-4 accent-sky-500"
                />
                Permitir perguntas anônimas
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.qa_moderation}
                  onChange={(e) => set("qa_moderation", e.target.checked)}
                  className="h-4 w-4 accent-sky-500"
                />
                Aprovar perguntas antes de exibir
              </label>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.gallery_enabled}
            onChange={(e) => set("gallery_enabled", e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          Galeria de fotos (moderação obrigatória)
        </label>
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
        <div>
          <label className={labelClass}>Texto de consentimento (LGPD)</label>
          <textarea
            value={form.consent_text}
            onChange={(e) => set("consent_text", e.target.value)}
            rows={2}
            placeholder="Ex.: Aceito receber comunicações sobre este evento e concordo com o tratamento dos meus dados conforme a política de privacidade."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Se preenchido, o participante precisa marcar aceite antes de se inscrever. Deixe em branco para não exigir consentimento.
          </p>
        </div>
      </section>

      {belongsToClient && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Vínculo com o cliente
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.listed_on_client_page}
              onChange={(e) => set("listed_on_client_page", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Listar este evento na página do cliente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.accept_client_base}
              onChange={(e) => set("accept_client_base", e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Aceitar participantes já aprovados em outros eventos deste cliente
          </label>
        </section>
      )}

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
            <label className={labelClass}>Fundo (desktop, 1920×1080)</label>
            {form.bg_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.bg_image_url}
                alt="Fundo"
                className="mb-2 h-16 w-full rounded object-cover"
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
              className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
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
                className="mb-2 h-16 w-full rounded object-cover"
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
              className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
            />
            {uploading === "bgMobile" && (
              <p className="mt-1 text-xs text-neutral-500">Enviando…</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Card (900×560, opcional)</label>
            {form.card_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.card_image_url}
                alt="Card"
                className="mb-2 h-16 w-full rounded object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, "card");
              }}
              className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
            />
            {uploading === "card" && <p className="mt-1 text-xs text-neutral-500">Enviando…</p>}
          </div>
        </div>
        <div>
          <label className={labelClass}>Logos de apoiadores (400×200 cada, opcional)</label>
          {form.sponsor_logos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {form.sponsor_logos.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Apoiador"
                    className="h-10 rounded bg-neutral-900 object-contain p-1"
                  />
                  <button
                    onClick={() => removeSponsorLogo(url)}
                    className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] leading-4 text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={uploading !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, "sponsor");
              e.target.value = "";
            }}
            className="block w-full text-xs text-neutral-400 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-200 hover:file:bg-neutral-700"
          />
          {uploading === "sponsor" && <p className="mt-1 text-xs text-neutral-500">Enviando…</p>}
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
