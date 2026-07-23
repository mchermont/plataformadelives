"use client";

import { useState } from "react";
import { Send, MessageSquare, X } from "lucide-react";

interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export function StudioPrivateChat({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      senderName: "Sistema",
      content: "Chat privado do Estúdio ativo. Mensagens aqui só são vistas pela equipe.",
      timestamp: "16:40",
    },
  ]);
  const [text, setText] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      senderName: "Diretor",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setText("");
  };

  return (
    <>
      {/* Botão de Pílula "Private Chat" no canto inferior esquerdo */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-neutral-900/90 border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 shadow-2xl backdrop-blur-md transition hover:bg-neutral-800 hover:text-emerald-400"
        >
          <MessageSquare className="h-4 w-4 text-emerald-400" />
          Private Chat
          {messages.length > 1 && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          )}
        </button>
      )}

      {/* Painel do Chat Privado */}
      {open && (
        <div className="fixed bottom-6 left-6 z-50 flex h-96 w-80 flex-col rounded-2xl border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-neutral-800 p-3">
            <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-400" /> Chat Privado da Equipe
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-emerald-400">{m.senderName}</span>
                  <span className="text-neutral-500">{m.timestamp}</span>
                </div>
                <p className="rounded-lg bg-neutral-950 p-2 text-xs text-neutral-200 border border-neutral-800/80">
                  {m.content}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="border-t border-neutral-800 p-2 flex gap-2">
            <input
              type="text"
              placeholder="Falar com a equipe..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-1.5 text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
