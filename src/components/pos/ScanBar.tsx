// =====================================================================
// ScanBar — แถบสแกน/ค้นหาของหน้าขาย
// อยู่ใต้ TopIconDock และโฟกัสอยู่ตลอดเวลา (§5 หน้า 1, §8 หลักการหน้าจอ)
// เครื่องสแกนทำงานเหมือนคีย์บอร์ดและจบด้วย Enter
// =====================================================================
import { useEffect, useRef, type FormEvent } from "react";
import { ScanLine } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** ถูกเรียกเมื่อกด Enter (เครื่องสแกนยิงจบด้วย Enter) */
  onSubmit: (code: string) => void;
  /** หยุดดึงโฟกัสกลับเมื่อมี modal เปิดอยู่ */
  paused?: boolean;
};

export function ScanBar({ value, onChange, onSubmit, paused = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // ดึงโฟกัสกลับช่องสแกนเสมอ ยกเว้นตอนที่มีหน้าต่างซ้อนเปิดอยู่
  useEffect(() => {
    if (paused) return;

    const focus = () => inputRef.current?.focus();
    focus();

    const timer = window.setInterval(() => {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;
      if (!isTyping) focus();
    }, 800);

    return () => window.clearInterval(timer);
  }, [paused]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const code = value.trim();
    if (!code) return;
    onSubmit(code);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky top-12 sm:top-14 z-30 bg-powder border-b border-royal/25 px-3 py-2"
    >
      <div className="flex items-center gap-2 max-w-6xl mx-auto">
        <ScanLine size={20} strokeWidth={1.5} className="text-royal shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อ/รหัสสินค้า แล้วกด Enter"
          aria-label="ช่องสแกนบาร์โค้ดและค้นหาสินค้า"
          className="flex-1 min-h-touch font-mono"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
    </form>
  );
}
