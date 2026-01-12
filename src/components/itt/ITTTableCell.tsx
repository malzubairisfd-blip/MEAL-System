import { cn } from "@/lib/utils";

export function ITTCell({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 border border-slate-700 text-sm align-top",
        className
      )}
    >
      {children}
    </td>
  );
}
