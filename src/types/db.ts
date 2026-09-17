// =====================================================================
// Type ที่ตรงกับ schema ใน supabase/migrations/001_tables.sql แบบ 1:1
// ชื่อฟิลด์ต้องตรงกับชื่อคอลัมน์เป๊ะ ห้ามเปลี่ยนเป็น camelCase
// เงินเป็น numeric(10,2) — PostgREST ส่งมาเป็น string หรือ number
// จึงประกาศเป็น Money แล้วอ่านผ่าน parseMoney() ใน src/lib/money.ts (§7.4)
// =====================================================================

export type Money = string | number;
export type Uuid = string;
export type Timestamptz = string;
export type DateOnly = string;

export type StaffRole = "owner" | "staff";
export type MovementType = "sale" | "receive" | "adjust" | "waste" | "return";
export type SaleStatus = "completed" | "voided" | "partially_returned" | "returned";
export type PaymentMethod = "cash" | "promptpay";
export type PromotionScope = "item" | "bill";
export type DiscountType = "percentage" | "fixed_amount";

export type Staff = {
  id: Uuid;
  name: string;
  role: StaffRole;
  email: string;
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

export type Supplier = {
  id: Uuid;
  name: string;
  contact: string | null;
  email: string | null;
  note: string | null;
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

/** ตาราง products — มี cost_price ซึ่ง staff ไม่มีสิทธิ์อ่าน */
export type Product = {
  id: Uuid;
  supplier_id: Uuid | null;
  name: string;
  sku: string;
  category: string;
  unit: string;
  cost_price: Money;
  price: Money;
  is_vat_exempt: boolean;
  image_url: string | null;
  barcode: string | null;
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

/** view products_for_staff — เหมือน products แต่ไม่มีคอลัมน์ cost_price */
export type ProductForStaff = Omit<Product, "cost_price">;

export type Inventory = {
  product_id: Uuid;
  quantity: number;
  reorder_point: number;
  updated_at: Timestamptz;
};

export type StockMovement = {
  id: Uuid;
  product_id: Uuid;
  type: MovementType;
  qty_change: number;
  ref_table: string | null;
  ref_id: Uuid | null;
  reason: string | null;
  unit_cost: Money | null;
  staff_id: Uuid;
  created_at: Timestamptz;
};

export type Shift = {
  id: Uuid;
  staff_id: Uuid;
  opened_at: Timestamptz;
  closed_at: Timestamptz | null;
  opening_cash: Money;
  expected_cash: Money | null;
  counted_cash: Money | null;
  cash_diff: Money | null;
  created_at: Timestamptz;
};

/** view shift_summary — ยอดรวมของรอบขายที่คำนวณฝั่งเซิร์ฟเวอร์ */
export type ShiftSummary = {
  shift_id: Uuid;
  staff_id: Uuid;
  opened_at: Timestamptz;
  closed_at: Timestamptz | null;
  opening_cash: Money;
  expected_cash: Money | null;
  counted_cash: Money | null;
  cash_diff: Money | null;
  bill_count: number;
  voided_count: number;
  cash_sales: Money;
  promptpay_sales: Money;
  total_sales: Money;
  vat_total: Money;
};

export type Promotion = {
  id: Uuid;
  name: string;
  scope: PromotionScope;
  product_id: Uuid | null;
  min_amount: Money | null;
  discount_type: DiscountType;
  discount_value: Money;
  start_date: DateOnly;
  end_date: DateOnly;
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

export type Sale = {
  id: Uuid;
  receipt_no: string;
  staff_id: Uuid;
  shift_id: Uuid;
  status: SaleStatus;
  subtotal: Money;
  item_discount: Money;
  bill_discount: Money;
  manual_discount: Money;
  vat_rate: Money;
  vat_amount: Money;
  total_amount: Money;
  payment_method: PaymentMethod;
  cash_received: Money | null;
  cash_change: Money | null;
  payment_confirmed_by: Uuid | null;
  client_uuid: Uuid;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

export type SaleItem = {
  id: Uuid;
  sale_id: Uuid;
  product_id: Uuid;
  quantity: number;
  unit_price: Money;
  unit_cost: Money;
  promotion_id: Uuid | null;
  discount_amount: Money;
  line_total_excl_vat: Money;
  returned_qty: number;
  created_at: Timestamptz;
};

/** view sale_items_for_staff — เหมือน sale_items แต่ไม่มีคอลัมน์ unit_cost */
export type SaleItemForStaff = Omit<SaleItem, "unit_cost">;

export type Return = {
  id: Uuid;
  sale_id: Uuid;
  /** รอบขายที่เงินคืนออกจากลิ้นชักจริง — ไม่ใช่รอบของบิลเดิม */
  shift_id: Uuid | null;
  staff_id: Uuid;
  reason: string;
  refund_amount: Money;
  refund_method: PaymentMethod;
  created_at: Timestamptz;
};

export type ReturnItem = {
  id: Uuid;
  return_id: Uuid;
  sale_item_id: Uuid;
  quantity: number;
  restock: boolean;
  refund_amount: Money;
};

export type StoreSettings = {
  id: number;
  shop_name: string;
  address: string | null;
  tax_id: string | null;
  is_vat_registered: boolean;
  vat_rate: Money;
  promptpay_id: string | null;
  receipt_prefix: string;
  receipt_reset_yearly: boolean;
  updated_at: Timestamptz;
};

export type AuditLog = {
  id: number;
  table_name: string;
  record_id: Uuid | null;
  action: string;
  changed_by: Uuid | null;
  old_data: unknown;
  new_data: unknown;
  created_at: Timestamptz;
};

// ---------------------------------------------------------------------
// รูปร่างข้อมูลที่ประกอบจากหลายตารางเพื่อใช้บนหน้าจอ
// ---------------------------------------------------------------------

/** สินค้า + ยอดคงเหลือ สำหรับหน้าขายและหน้าดูสต็อก */
export type ProductWithStock = ProductForStaff & {
  quantity: number;
  reorder_point: number;
  /** owner เท่านั้นที่ได้ค่านี้ (staff อ่าน view ที่ไม่มีคอลัมน์ต้นทุน) */
  cost_price?: Money;
};

/** พารามิเตอร์ของ RPC checkout_sale — ส่งเฉพาะ product_id กับ quantity (§7.3) */
export type CheckoutItem = {
  product_id: Uuid;
  quantity: number;
};

/** บิลพร้อมรายการ สำหรับหน้าใบเสร็จและหน้าคืนสินค้า (ไม่มีต้นทุน §2) */
export type SaleWithItems = Sale & {
  sale_items: (SaleItemForStaff & { products: Pick<Product, "name" | "sku" | "unit"> | null })[];
  staff: Pick<Staff, "name"> | null;
};

/** พารามิเตอร์รายบรรทัดของ RPC create_return */
export type ReturnItemInput = {
  sale_item_id: Uuid;
  quantity: number;
  /** true = ของขายต่อได้ คืนเข้าสต็อก / false = ของเสีย ไม่คืนเข้าสต็อก */
  restock: boolean;
};

/** ผลลัพธ์ที่ create_return ส่งกลับ — ตัวเลขทุกตัวคำนวณฝั่งฐานข้อมูล */
export type ReturnResult = {
  return_id: Uuid;
  sale_id: Uuid;
  shift_id: Uuid | null;
  receipt_no: string;
  refund_amount: Money;
  refund_method: PaymentMethod;
  sale_status: SaleStatus;
  items: {
    sale_item_id: Uuid;
    product_id: Uuid;
    name: string;
    quantity: number;
    restock: boolean;
    refund_amount: Money;
  }[];
};
