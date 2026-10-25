export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="muted text-sm">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
