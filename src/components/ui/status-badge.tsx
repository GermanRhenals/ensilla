import { statusInfo } from "@/lib/constants";

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const info = statusInfo(status);
  return (
    <span className={`badge ${info.badge} ${className}`}>
      <span className={`size-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}
