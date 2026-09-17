// เส้นทางทั้งหมดของระบบ — หน้าที่ยังไม่ทำในรอบ P0 ทำเครื่องหมายไว้ตาม §11
export const paths = {
  login: "/login",
  pos: "/",
  receipt: "/receipt/:saleId",
  receiptOf: (saleId: string) => `/receipt/${saleId}`,
  shift: "/shift",
  stock: "/stock",
  products: "/products",
  // --- P1 ---
  salesHistory: "/sales",
  dashboard: "/dashboard",
  promotions: "/promotions",
  stockManage: "/stock-manage",
  returns: "/returns",
  // --- P2 ---
  suppliers: "/suppliers",
  staff: "/staff",
  reports: "/reports",
} as const;
