// =====================================================================
// useCart — ตะกร้าของหน้าขาย
// กติกา:
//   1. ส่งเข้า RPC เฉพาะ product_id และ quantity (§7.3)
//   2. ยอดที่โชว์บนจอเป็นการประมาณจาก estimateCartTotals() เท่านั้น
//      ค่าจริงมาจากแถว sales ที่ checkout_sale ส่งกลับ
//   3. client_uuid สร้างครั้งเดียวต่อหนึ่งตะกร้า กดยืนยันซ้ำได้บิลเดียว (§7.6)
// =====================================================================
import { useCallback, useMemo, useState } from "react";
import { checkoutSale } from "../api/sales.api";
import { estimateCartTotals, parseMoney } from "../lib/money";
import type { CheckoutItem, PaymentMethod, ProductForStaff, Sale, Uuid } from "../types/db";

export type CartLine = {
  product: ProductForStaff;
  quantity: number;
  /** ยอดคงเหลือที่อ่านมาตอนหยิบใส่ตะกร้า ใช้เตือนบนจอเท่านั้น ของจริงเช็คที่ RPC */
  availableQty: number;
};

function newClientUuid(): Uuid {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  throw new Error("เบราว์เซอร์นี้ไม่รองรับการสร้าง client_uuid");
}

export function useCart(vatRate: number) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [clientUuid, setClientUuid] = useState<Uuid>(() => newClientUuid());
  const [submitting, setSubmitting] = useState(false);

  const addProduct = useCallback((product: ProductForStaff, availableQty: number) => {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1, availableQty }];
    });
  }, []);

  const setQuantity = useCallback((productId: Uuid, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.product.id !== productId)
        : current.map((line) =>
            line.product.id === productId ? { ...line, quantity } : line,
          ),
    );
  }, []);

  const removeLine = useCallback((productId: Uuid) => {
    setLines((current) => current.filter((line) => line.product.id !== productId));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setClientUuid(newClientUuid());
  }, []);

  /** ประมาณการเพื่อ UX เท่านั้น — ยังไม่รวมโปรโมชั่นและส่วนลด (§7.3) */
  const estimate = useMemo(
    () =>
      estimateCartTotals(
        lines.map((line) => ({
          unitPrice: parseMoney(line.product.price),
          quantity: line.quantity,
        })),
        vatRate,
      ),
    [lines, vatRate],
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const submit = useCallback(
    async (params: {
      shiftId: Uuid;
      paymentMethod: PaymentMethod;
      cashReceived: number | null;
      manualDiscount: number;
    }): Promise<Sale> => {
      if (lines.length === 0) throw new Error("ตะกร้าว่าง ยังไม่มีสินค้าให้ปิดบิล");

      const items: CheckoutItem[] = lines.map((line) => ({
        product_id: line.product.id,
        quantity: line.quantity,
      }));

      setSubmitting(true);
      try {
        return await checkoutSale({
          client_uuid: clientUuid,
          shift_id: params.shiftId,
          items,
          payment_method: params.paymentMethod,
          cash_received: params.cashReceived,
          manual_discount: params.manualDiscount,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [lines, clientUuid],
  );

  return {
    lines,
    itemCount,
    estimate,
    clientUuid,
    submitting,
    addProduct,
    setQuantity,
    removeLine,
    clear,
    submit,
  };
}
