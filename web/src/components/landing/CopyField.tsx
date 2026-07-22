"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — o valor
      // já está visível e selecionável na tela, então não é bloqueante
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--gl-border)] bg-[var(--gl-surface)] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--gl-muted)]">{label}</p>
        <p className="truncate font-mono text-sm text-[var(--gl-ink)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--gl-muted)] transition hover:bg-white hover:text-[var(--gl-ink)]"
        aria-label={`Copiar ${label.toLowerCase()}`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-[var(--gl-chat)]" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
