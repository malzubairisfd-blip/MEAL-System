import { cn } from "@/lib/utils";

export function ITTStatusBadge({
  status
}: {
  status: "no data" | "off track" | "on track" | "achieved";
}) {
  const styles = {
    "no data": "bg-slate-600/20 text-slate-300",
    "off track": "bg-red-600/20 text-red-400",
    "on track": "bg-yellow-600/20 text-yellow-400",
    "achieved": "bg-green-600/20 text-green-400"
  };

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap",
        styles[status]
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}
