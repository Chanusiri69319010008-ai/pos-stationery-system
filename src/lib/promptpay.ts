// =====================================================================
// promptpay.ts — สร้าง payload ของ QR พร้อมเพย์เองตามมาตรฐาน EMV QRCPS (§4)
// (merchant-presented, dynamic เมื่อระบุจำนวนเงิน)
// ไฟล์นี้ไม่ใช่การคำนวณเงิน — เป็นการเข้ารหัสยอดที่ได้รับมาเท่านั้น
// =====================================================================

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** แปลงเบอร์มือถือ/เลขประจำตัวผู้เสียภาษี/e-Wallet ให้อยู่ในรูปแบบของพร้อมเพย์ */
function normalizeTarget(id: string): { tag: string; value: string } {
  const digits = id.replace(/\D/g, "");

  if (digits.length === 10) {
    // เบอร์มือถือ 0812345678 → 0066812345678 (13 หลัก: เติม 00 + รหัสประเทศ 66 + เบอร์ที่ตัด 0 หน้าออก)
    return { tag: "01", value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 13) {
    // เลขประจำตัวผู้เสียภาษี / เลขบัตรประชาชน
    return { tag: "02", value: digits };
  }
  if (digits.length === 15) {
    // e-Wallet ID
    return { tag: "03", value: digits };
  }
  throw new Error("รูปแบบพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขผู้เสียภาษี 13 หลัก)");
}

/** CRC-16/CCITT-FALSE ตามที่มาตรฐาน EMV กำหนด */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * สร้าง payload ของ QR พร้อมเพย์
 * @param promptpayId เบอร์มือถือ 10 หลัก หรือเลขผู้เสียภาษี 13 หลัก จาก store_settings
 * @param amount ยอดเงินที่ต้องการให้ลูกค้าโอน (ไม่ระบุ = ลูกค้ากรอกเอง)
 */
export function buildPromptPayPayload(promptpayId: string, amount?: number): string {
  const target = normalizeTarget(promptpayId);

  const merchantAccount = field(
    "29",
    field("00", "A000000677010111") + field(target.tag, target.value),
  );

  const body = [
    field("00", "01"),
    field("01", amount && amount > 0 ? "12" : "11"),
    merchantAccount,
    field("53", "764"),
    amount && amount > 0 ? field("54", amount.toFixed(2)) : "",
    field("58", "TH"),
  ].join("");

  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
