// =====================================================================
// CSV — จุดเดียวของทั้งโปรเจกต์ที่สร้างและดาวน์โหลดไฟล์ CSV (§5 หน้า 11)
// กติกา:
//   1. ไฟล์นี้ "จัดรูปแบบ" อย่างเดียว ห้ามคำนวณยอดใด ๆ ตัวเลขต้องมาจากฐานข้อมูลแล้ว
//   2. ใส่ BOM ไว้หน้าไฟล์เสมอ ไม่งั้น Excel บน Windows อ่านภาษาไทยเป็นตัวยึกยือ
//   3. ค่าเงินในไฟล์เขียนเป็นตัวเลขล้วน ไม่มี ฿ และไม่มีคอมมา เพื่อให้เอาไปคำนวณต่อได้
// =====================================================================

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

function escapeCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

/** ดาวน์โหลดเป็นไฟล์ .csv — ชื่อไฟล์ควรมีช่วงวันที่กำกับไว้เสมอ */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
