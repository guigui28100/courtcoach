import { ReactNode } from "react";

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="border-b border-line bg-gradient-to-br from-sand to-[#f6e3d1]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
        <h1 className="mb-1">{title}</h1>
        {children && <div className="max-w-2xl text-muted">{children}</div>}
      </div>
    </section>
  );
}

export const Page = ({ children }: { children: ReactNode }) => <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6">{children}</div>;

export function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export const Err = ({ msg }: { msg?: string }) => (msg ? <p role="alert" className="alert-err m-0">{msg}</p> : null);
export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center text-muted">{children}</p>;

export function ProgressBar({ value, color = "#b8471f" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}
