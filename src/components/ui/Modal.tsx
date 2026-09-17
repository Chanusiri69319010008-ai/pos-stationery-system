// Modal — ใช้เงาได้เฉพาะ modal และ dropdown (§8)
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, title, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-paper border border-royal/25 rounded shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-royal/20">
          <h2 className="font-display text-xl text-royal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="min-h-touch min-w-touch flex items-center justify-center text-royal"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-royal/20">{footer}</div>}
      </div>
    </div>
  );
}
