export function ITTProgressBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-green-500"
      : value >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="w-full h-2 bg-slate-700 rounded">
        <div
          className={`h-2 rounded ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold">
        {Math.round(value)}%
      </span>
    </div>
  );
}
