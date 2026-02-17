"use client";

type Props = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: Props) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-8 text-slate-100">
      <div className="text-xl font-semibold">{title}</div>
      {message ? <div className="mt-2 text-slate-300">{message}</div> : null}
    </div>
  );
}
