// หัวเรื่องของหน้า — วางใต้ TopIconDock ทันที ใช้ Barlow Condensed (§8)
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="text-ink/70 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
