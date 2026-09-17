// ป้ายสถานะ — พื้น Powder Blue ตัวอักษร Royal เป็นค่าตั้งต้น
// ใช้สีเตือน/ผิดพลาดเฉพาะกรณีที่เป็นความผิดพลาดจริง (§8)
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  default: "bg-powder text-royal border-royal/20",
  success: "bg-paper text-success border-success/40",
  warning: "bg-paper text-warning border-warning/40",
  danger: "bg-paper text-danger border-danger/40",
};

export function StatusBadge({
  tone = "default",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
