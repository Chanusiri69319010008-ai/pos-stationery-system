// สถานะว่าง — ทุกหน้าต้องบอกว่าต้องทำอะไรต่อ (§8)
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel p-8 text-center">
      <p className="font-display text-xl text-royal mb-2">{title}</p>
      <p className="text-ink/70 mb-4">{description}</p>
      {action}
    </div>
  );
}
