"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";

interface ChatPanelProps {
  eventId: string;
  userId: string;
  isAdmin: boolean;
}

export function ChatPanel({ eventId, userId, isAdmin }: ChatPanelProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

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
          requestAnimationFrame(scrollToBottom);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const post = payload.new as Post;
          setPosts((prev) =>
            prev
              .map((p) => (p.id === post.id ? post : p))
              .filter((p) => isAdmin || !p.deleted_at),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, isAdmin, scrollToBottom]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);

    const { data, error } = await supabaseRef.current
      .from("posts")
      .insert({ event_id: eventId, author_id: userId, content })
      .select()
      .single();

    if (error) {
      setError("Não foi possível enviar. O chat pode estar fechado.");
    } else if (data) {
      setText("");
      setPosts((prev) =>
        prev.some((p) => p.id === data.id) ? prev : [...prev, data as Post],
      );
      requestAnimationFrame(scrollToBottom);
    }
    setSending(false);
  }

  async function moderate(post: Post, action: "pin" | "delete" | "ban") {
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

  const pinned = posts.filter((p) => p.pinned && !p.deleted_at);

  return (
    <div className="flex h-full flex-col">
      {pinned.length > 0 && (
        <div className="space-y-1 border-b border-neutral-800 p-3">
          {pinned.map((p) => (
            <div key={p.id} className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
              <span className="mr-1">📌</span>
              <span className="font-semibold">{p.author_name}:</span> {p.content}
            </div>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {posts.filter((p) => !p.deleted_at).map((post) => (
          <div key={post.id} className="group text-sm leading-relaxed">
            <span
              className={
                post.kind === "announcement"
                  ? "font-semibold text-amber-400"
                  : "font-semibold text-sky-400"
              }
            >
              {post.author_name || "Participante"}
            </span>{" "}
            <span className="text-neutral-200">{post.content}</span>
            {isAdmin && (
              <span className="ml-2 hidden gap-1 group-hover:inline-flex">
                <button
                  onClick={() => moderate(post, "pin")}
                  title={post.pinned ? "Desafixar" : "Fixar"}
                  className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-800"
                >
                  📌
                </button>
                <button
                  onClick={() => moderate(post, "delete")}
                  title="Apagar"
                  className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-800"
                >
                  🗑
                </button>
                <button
                  onClick={() => moderate(post, "ban")}
                  title="Banir participante"
                  className="rounded px-1 text-xs text-neutral-400 hover:bg-neutral-800"
                >
                  🚫
                </button>
              </span>
            )}
          </div>
        ))}
        {posts.length === 0 && (
          <p className="pt-8 text-center text-sm text-neutral-500">
            Seja o primeiro a comentar!
          </p>
        )}
      </div>

      <div className="border-t border-neutral-800 p-3">
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            maxLength={2000}
            placeholder="Escreva uma mensagem…"
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-sky-500"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="rounded-lg bg-[var(--brand,#0284c7)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
