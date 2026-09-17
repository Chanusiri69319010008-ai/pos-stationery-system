// ช่องกรอกพร้อมป้ายกำกับ — ใช้ทุกหน้าเพื่อให้หน้าตาเหมือนกัน
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ label, hint, error, className = "", id, ...rest }: Props) {
  const inputId = id ?? `field-${label}`;

  return (
    <label className="block" htmlFor={inputId}>
      <span className="block mb-1 text-ink font-medium">{label}</span>
      <input
        id={inputId}
        {...rest}
        className={["w-full min-h-touch", error ? "border-danger" : "", className].join(" ")}
      />
      {hint && !error && <span className="block mt-1 text-xs text-ink/60">{hint}</span>}
      {error && <span className="block mt-1 text-xs text-danger">{error}</span>}
    </label>
  );
}
