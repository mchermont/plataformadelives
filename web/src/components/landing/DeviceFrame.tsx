import type { ReactNode } from "react";

export function BrowserFrame({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--gl-border)] bg-white shadow-[0_24px_60px_-24px_rgba(15,20,40,0.35)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--gl-border)] bg-[var(--gl-surface)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--gl-reaction)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--gl-raffle)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--gl-chat)]/50" />
        <span className="ml-2 truncate rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--gl-muted)]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-[280px] overflow-hidden rounded-[2.25rem] border-[6px] border-[var(--gl-ink)] bg-[var(--gl-ink)] shadow-[0_24px_60px_-20px_rgba(15,20,40,0.45)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-white">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-[var(--gl-ink)]" />
        {children}
      </div>
    </div>
  );
}
