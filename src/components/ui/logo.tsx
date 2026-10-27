import { Scissors } from "lucide-react";

export function Logo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex size-9 items-center justify-center rounded-full border border-current/25">
        <Scissors className="size-4 -rotate-45" strokeWidth={1.8} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-xl font-semibold tracking-tight">
            En-silla
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.34em] opacity-60">
            barbershop
          </span>
        </span>
      )}
    </span>
  );
}
