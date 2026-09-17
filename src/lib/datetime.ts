// =====================================================================
// วันที่และเวลา — จุดเดียวของทั้งโปรเจกต์
// รูปแบบตาม §8: วันที่ dd/mm/yyyy ปี ค.ศ. เวลาแบบ 24 ชม.
// ฐานข้อมูลเก็บเป็น UTC แสดงผลตามเวลาหน้าร้าน (Asia/Bangkok)
// =====================================================================

const TZ = "Asia/Bangkok";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return `${formatDate(value)} ${formatTime(value)}`;
}

/**
 * วันที่ "วันนี้" ตามเวลาหน้าร้าน ในรูปแบบ yyyy-mm-dd
 * ใช้เทียบกับคอลัมน์ชนิด date (start_date, end_date, sale_date) ซึ่งฐานข้อมูล
 * ก็ตัดวันด้วย Asia/Bangkok เหมือนกัน — ห้ามใช้ new Date().toISOString() เพราะเป็น UTC
 */
export function todayInBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}
