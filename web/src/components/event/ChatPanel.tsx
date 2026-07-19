"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";

interface ChatPanelProps {
  eventId: string;
  userId: string;
  isAdmin: boolean;
  /** chat pré-moderado: mensagens de participantes entram na fila (0015) */
  moderated?: boolean;
}

/** Paleta de cores de nome por autor (determinística via hash do id). */
const NAME_COLORS = [
  "text-sky-400",
  "text-violet-400",
  "text-rose-400",
  "text-amber-400",
  "text-teal-400",
  "text-indigo-400",
  "text-orange-400",
  "text-fuchsia-400",
];

function nameColor(authorId: string, isMine: boolean, isAnnouncement: boolean) {
  if (isAnnouncement) return "text-amber-400";
  if (isMine) return "text-emerald-400"; // o participante se identifica de longe
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = (hash * 31 + authorId.charCodeAt(i)) >>> 0;
  }
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({ eventId, userId, isAdmin, moderated }: ChatPanelProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Post | null>(null);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const supabaseRef = useRef(createClient());

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setUnread(0);
  }, []);

  // Auto-scroll só quando o leitor já está no fim (não puxa quem lê o histórico)
  const handleIncoming = useCallback(() => {
    if (atBottomRef.current) {
      requestAnimationFrame(scrollToBottom);
    } else {
      setUnread((n) => n + 1);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (!cancelled && data) {
        setPosts(data as Post[]);
        requestAnimationFrame(scrollToBottom);
      }
    }
    load();

    const channel = supabase
      .channel(`posts:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const post = payload.new as Post;
          setPosts((prev) =>
            prev.some((p) => p.id === post.id) ? prev : [...prev, post],
          );
          handleIncoming();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const post = payload.new as Post;
          // aprovação na moderação chega como UPDATE de uma mensagem que o
          // participante ainda não tem — entra na posição certa por data
          let added = false;
          setPosts((prev) => {
            const exists = prev.some((p) => p.id === post.id);
            added = !exists;
            const next = exists
              ? prev.map((p) => (p.id === post.id ? post : p))
              : [...prev, post].sort((a, b) => a.created_at.localeCompare(b.created_at));
            // autor mantém a própria mensagem visível mesmo removida (com selo)
            return next.filter((p) => isAdmin || !p.deleted_at || p.author_id === userId);
          });
          if (added) handleIncoming();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, isAdmin, scrollToBottom, handleIncoming]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = nearBottom;
    if (nearBottom) setUnread(0);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);

    const { data, error } = await supabaseRef.current
      .from("posts")
      .insert({
        event_id: eventId,
        author_id: userId,
        content,
        reply_to_id: replyTo?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      setError("Não foi possível enviar. O chat pode estar fechado.");
    } else if (data) {
      setText("");
      setReplyTo(null);
      setPosts((prev) =>
        prev.some((p) => p.id === data.id) ? prev : [...prev, data as Post],
      );
      requestAnimationFrame(scrollToBottom);
    }
    setSending(false);
  }

  async function review(post: Post, ok: boolean) {
    const supabase = supabaseRef.current;
    if (ok) {
      await supabase.from("posts").update({ approved: true }).eq("id", post.id);
    } else {
      await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", post.id);
    }
  }

  async function moderate(post: Post, action: "pin" | "delete" | "ban") {
    if (action === "delete" && !confirm("Apagar esta mensagem para todos?")) return;
    if (action === "ban" && !confirm(`Banir ${post.author_name || "este participante"}? Ele perde o acesso ao evento.`)) return;

    const supabase = supabaseRef.current;
    if (action === "pin") {
      await supabase.from("posts").update({ pinned: !post.pinned }).eq("id", post.id);
    } else if (action === "delete") {
      await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", post.id);
    } else {
      await supabase
        .from("registrations")
        .update({ status: "banned" })
        .eq("event_id", eventId)
        .eq("user_id", post.author_id);
    }
  }

  function startReply(post: Post) {
    setReplyTo(post);
    inputRef.current?.focus();
  }

  const pinned = posts.filter((p) => p.pinned && !p.deleted_at);
  // pendentes/removidas de outros ficam fora do fluxo (RLS já filtra);
  // a própria mensagem do autor continua visível mesmo removida, com selo
  // "removida pela moderação" em vez de sumir sem explicação
  const visible = posts.filter(
    (p) =>
      (!p.deleted_at && (p.approved || p.author_id === userId)) ||
      (p.deleted_at && p.author_id === userId),
  );
  const queue = isAdmin
    ? posts.filter((p) => !p.approved && !p.deleted_at && p.author_id !== userId)
    : [];
  const byId = new Map(posts.map((p) => [p.id, p]));

  return (
    <div className="flex h-full flex-col">
      {pinned.length > 0 && (
        <div className="space-y-1 border-b border-neutral-800 p-2">
          {pinned.map((p) => (
            <div
              key={p.id}
              className="break-words rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[13px] leading-snug"
            >
              <span className="mr-1">📌</span>
              <span className="font-semibold">{p.author_name}:</span> {p.content}
            </div>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="border-b border-amber-900 bg-amber-950/30 p-2">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
            Fila de moderação ({queue.length})
          </h4>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {queue.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-2 text-[13px] leading-snug"
              >
                <p className="min-w-0 break-words">
                  <span className="font-semibold">
                    {p.author_name || "Participante"}:
                  </span>{" "}
                  <span className="text-neutral-200">{p.content}</span>
                </p>
                <span className="flex shrink-0 gap-1">
                  <button
                    onClick={() => review(p, true)}
                    title="Aprovar"
                    className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => review(p, false)}
                    title="Rejeitar"
                    className="rounded border border-red-900 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-950"
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="h-full space-y-1.5 overflow-y-auto overflow-x-hidden p-2.5"
        >
          {visible.map((post) => {
            const isMine = post.author_id === userId;
            const quoted = post.reply_to_id ? byId.get(post.reply_to_id) : null;
            return (
              <div
                key={post.id}
                className="group break-words rounded-lg px-1.5 py-0.5 text-[13px] leading-snug hover:bg-neutral-800/40"
              >
                {quoted && !quoted.deleted_at && (
                  <p className="mb-0.5 truncate rounded bg-neutral-800/60 px-2 py-0.5 text-xs text-neutral-400">
                    ↩ <span className="font-medium">{quoted.author_name}:</span>{" "}
                    {quoted.content}
                  </p>
                )}
                <span
                  className={`font-semibold ${nameColor(post.author_id, isMine, post.kind === "announcement")}`}
                >
                  {post.author_name || "Participante"}
                  {isMine && (
                    <span className="ml-1 font-normal text-neutral-500">(você)</span>
                  )}
                </span>{" "}
                {post.deleted_at ? (
                  <span className="italic text-neutral-500">mensagem removida</span>
                ) : (
                  <span className={post.approved ? "text-neutral-200" : "text-neutral-400"}>
                    {post.content}
                  </span>
                )}
                {post.deleted_at && (
                  <span className="ml-1.5 rounded bg-red-500/15 px-1.5 align-middle text-[10px] text-red-400">
                    removida pela moderação
                  </span>
                )}
                {!post.deleted_at && !post.approved && (
                  <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 align-middle text-[10px] text-amber-400">
                    em moderação
                  </span>
                )}
                <span className="ml-1.5 align-middle text-[10px] text-neutral-600">
                  {formatTime(post.created_at)}
                </span>
                {!post.deleted_at && (
                <span className="ml-1.5 hidden gap-0.5 align-middle group-hover:inline-flex group-focus-within:inline-flex">
                  <button
                    onClick={() => startReply(post)}
                    title="Responder"
                    aria-label={`Responder a ${post.author_name}`}
                    className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-700"
                  >
                    ↩
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => moderate(post, "pin")}
                        title={post.pinned ? "Desafixar" : "Fixar"}
                        aria-label={post.pinned ? "Desafixar mensagem" : "Fixar mensagem"}
                        className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-700"
                      >
                        📌
                      </button>
                      <button
                        onClick={() => moderate(post, "delete")}
                        title="Apagar"
                        aria-label="Apagar mensagem"
                        className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-700"
                      >
                        🗑
                      </button>
                      <button
                        onClick={() => moderate(post, "ban")}
                        title="Banir participante"
                        aria-label={`Banir ${post.author_name || "participante"}`}
                        className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-700"
                      >
                        🚫
                      </button>
                    </>
                  )}
                </span>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="pt-8 text-center text-[13px] text-neutral-500">
              Seja o primeiro a comentar!
            </p>
          )}
        </div>

        {unread > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand,#0284c7)] px-3 py-1 text-xs font-semibold text-white shadow-lg"
          >
            ↓ {unread} nova{unread === 1 ? "" : "s"} mensagen{unread === 1 ? "m" : "s"}
          </button>
        )}
      </div>

      <div className="border-t border-neutral-800 p-2">
        {error && <p className="mb-1.5 text-xs text-red-400">{error}</p>}
        {moderated && !isAdmin && (
          <p className="mb-1.5 text-[11px] text-neutral-500">
            As mensagens passam por aprovação antes de aparecer para todos.
          </p>
        )}
        {replyTo && (
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-neutral-800/60 px-2.5 py-1 text-xs">
            <span className="min-w-0 truncate text-neutral-400">
              ↩ Respondendo a{" "}
              <span className="font-medium text-neutral-200">
                {replyTo.author_name}
              </span>
              : {replyTo.content}
            </span>
            <button
              onClick={() => setReplyTo(null)}
              aria-label="Cancelar resposta"
              className="shrink-0 rounded px-1 text-neutral-400 hover:bg-neutral-700 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
              if (e.key === "Escape") setReplyTo(null);
            }}
            maxLength={2000}
            placeholder={replyTo ? "Escreva sua resposta…" : "Escreva uma mensagem…"}
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[13px] outline-none placeholder:text-neutral-500 focus:border-sky-500"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="rounded-lg bg-[var(--brand,#0284c7)] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
