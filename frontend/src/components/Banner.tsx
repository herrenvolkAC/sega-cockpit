"use client";

type Props = {
  kind: "info" | "warn" | "error";
  title: string;
  message?: string;
};

export function Banner({ kind, title, message }: Props) {
  const cls =
    kind === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : kind === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-slate-500/40 bg-slate-500/10 text-slate-100";

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="font-semibold">{title}</div>
      {message ? <div className="mt-1 text-sm opacity-90">{message}</div> : null}
    </div>
  );
}
