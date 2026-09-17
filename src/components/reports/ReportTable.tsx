// =====================================================================
// ReportTable — ตารางของหน้ารายงาน (§5 หน้า 11)
// รายงานทั้งสามแบบมีโครงเหมือนกัน (หัวตาราง + ตัวเลขชิดขวา) จึงใช้ตัวเดียวกัน
// ตัวเลขทุกช่องถูกจัดรูปแบบมาจากหน้าเรียกแล้ว ที่นี่ไม่คำนวณอะไรทั้งสิ้น
// =====================================================================
import type { ReactNode } from "react";

export type ReportColumn<T> = {
  header: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
};

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  footer,
}: {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  footer?: ReactNode;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table>
        <thead>
          <tr className="bg-powder text-royal text-left">
            {columns.map((column) => (
              <th
                key={column.header}
                className={`px-3 py-2 font-medium ${column.align === "right" ? "text-right" : ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-t border-royal/15">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`px-3 py-2 ${column.align === "right" ? "num text-right" : ""}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {footer && <div className="px-3 py-2 border-t border-royal/15 text-sm">{footer}</div>}
    </div>
  );
}
