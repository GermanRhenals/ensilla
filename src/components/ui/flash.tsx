import { CheckCircle2, TriangleAlert } from "lucide-react";

export function Flash({
  ok,
  error,
  className = "",
}: {
  ok?: string | string[];
  error?: string | string[];
  className?: string;
}) {
  const okMessage = Array.isArray(ok) ? ok[0] : ok;
  const errorMessage = Array.isArray(error) ? error[0] : error;

  if (!okMessage && !errorMessage) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {okMessage && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{okMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
