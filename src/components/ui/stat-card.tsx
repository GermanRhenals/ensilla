import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "copper" | "sage" | "ink";
}) {
  const tones = {
    default: "bg-white text-ink",
    copper: "bg-copper-soft text-ink",
    sage: "bg-emerald-50 text-ink",
    ink: "bg-ink text-cream",
  };

  const iconTones = {
    default: "bg-sand text-stone-600",
    copper: "bg-white/70 text-copper-dark",
    sage: "bg-white/70 text-sage",
    ink: "bg-white/10 text-cream",
  };

  return (
    <div
      className={`rounded-2xl border border-line p-4 sm:p-5 ${tones[tone]} ${tone === "ink" ? "border-ink-soft" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${tone === "ink" ? "text-cream/60" : "text-stone-500"}`}
        >
          {label}
        </p>
        {icon && (
          <span
            className={`flex size-8 items-center justify-center rounded-full ${iconTones[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint && (
        <p
          className={`mt-1 text-xs ${tone === "ink" ? "text-cream/60" : "text-stone-500"}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
