// =====================================================================
// เงิน — ฟังก์ชันแปลงและแสดงผลที่เดียวของทั้งโปรเจกต์ (§7.4)
// กติกา:
//   1. ค่าเงินจากฐานข้อมูลเป็น numeric(10,2) อ่านเข้ามาเป็น string หรือ number
//      ต้องผ่าน parseMoney() เท่านั้น ห้าม Number() หรือ parseFloat() ที่อื่น
//   2. ยอดเงินจริงของบิลมาจาก RPC เสมอ ไฟล์นี้ไม่ใช่ที่คิดเงิน
//   3. estimateCartTotals() เป็น "ประมาณการเพื่อ UX" ตาม §7.3 เท่านั้น
//      ค่าที่ได้ห้ามส่งไปบันทึก และต้องถูกแทนที่ด้วยค่าจริงจาก checkout_sale
// =====================================================================

/** ค่าเงินที่อ่านมาจาก PostgREST (numeric มาได้ทั้ง string และ number) */
export type MoneyInput = string | number | null | undefined;

/** แปลงค่าเงินจากฐานข้อมูลเป็นตัวเลขสำหรับแสดงผล */
export function parseMoney(value: MoneyInput): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** แสดงเงินแบบ ฿1,234.50 — ทศนิยม 2 ตำแหน่งเสมอ (§8) */
export function formatMoney(value: MoneyInput): string {
  return `฿${parseMoney(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** แสดงเงินแบบไม่มีสัญลักษณ์ ใช้ในใบเสร็จและตาราง */
export function formatAmount(value: MoneyInput): string {
  return parseMoney(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ค่าเงินสำหรับเขียนลงไฟล์ CSV — ตัวเลขล้วน 2 ตำแหน่ง ไม่มีคอมมาและไม่มี ฿ */
export function csvMoney(value: MoneyInput): string {
  return parseMoney(value).toFixed(2);
}

/** แสดงเปอร์เซ็นต์ส่วนลด เช่น 10% — ตัดทศนิยม .00 ที่ไม่จำเป็นทิ้ง */
export function formatPercent(value: MoneyInput): string {
  return `${parseMoney(value).toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`;
}

/** แสดงจำนวนเต็ม เช่น จำนวนชิ้น */
export function formatQty(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("th-TH");
}

/** ปัดครึ่งขึ้น 2 ตำแหน่ง — ใช้กับ "ประมาณการ" บนหน้าจอเท่านั้น ของจริงปัดที่ RPC (§7.5) */
function roundHalfUp(value: number, scale = 2): number {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export type CartEstimateLine = {
  /** ราคาต่อหน่วยไม่รวม VAT ที่อ่านมาจากฐานข้อมูล */
  unitPrice: number;
  quantity: number;
};

export type CartEstimate = {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
};

/**
 * ประมาณการยอดบนหน้าจอขายเพื่อให้แคชเชียร์เห็นตัวเลขทันที (§7.3)
 * ไม่คิดโปรโมชั่นและส่วนลดใด ๆ เพราะเป็นหน้าที่ของ checkout_sale
 * ค่าที่ได้เป็นเพียงการประมาณ ต้องถูกแทนที่ด้วยค่าจริงจาก response เสมอ
 */
export function estimateCartTotals(lines: CartEstimateLine[], vatRate: number): CartEstimate {
  const subtotal = roundHalfUp(
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );
  const vatAmount = roundHalfUp((subtotal * vatRate) / 100);
  return { subtotal, vatAmount, totalAmount: roundHalfUp(subtotal + vatAmount) };
}
