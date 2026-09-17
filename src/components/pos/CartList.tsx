// =====================================================================
// CartList — ตะกร้าที่แก้จำนวนได้ (§5 หน้า 1)
// ราคาต่อหน่วยที่แสดงอ่านมาจากฐานข้อมูล staff แก้ราคาไม่ได้ (§4 ห้ามทำ ข้อ 2)
// =====================================================================
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatMoney, parseMoney } from "../../lib/money";
import type { CartLine } from "../../hooks/useCart";

type Props = {
  lines: CartLine[];
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
};

export function CartList({ lines, onSetQuantity, onRemove }: Props) {
  if (lines.length === 0) {
    return (
      <div className="panel p-6 text-center text-ink/70">
        ตะกร้าว่าง — สแกนบาร์โค้ดหรือเลือกสินค้าจากรายการเพื่อเริ่มบิลใหม่
      </div>
    );
  }

  return (
    <ul className="divide-y divide-royal/15">
      {lines.map((line) => {
        const overStock = line.quantity > line.availableQty;
        return (
          <li key={line.product.id} className="py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">{line.product.name}</p>
                <p className="num text-xs text-ink/60">
                  {formatMoney(line.product.price)} / {line.product.unit}
                </p>
                {overStock && (
                  <p className="text-xs text-danger mt-0.5">
                    คงเหลือในระบบ {line.availableQty} — ปิดบิลจะไม่ผ่าน
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="num text-base font-medium text-royal">
                  {formatMoney(parseMoney(line.product.price) * line.quantity)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                aria-label="ลดจำนวน"
                onClick={() => onSetQuantity(line.product.id, line.quantity - 1)}
                className="min-h-touch min-w-touch flex items-center justify-center border border-royal/30 rounded text-royal"
              >
                <Minus size={18} strokeWidth={1.5} />
              </button>

              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => onSetQuantity(line.product.id, Number(e.target.value))}
                aria-label={`จำนวนของ ${line.product.name}`}
                className="w-16 min-h-touch text-center num"
              />

              <button
                type="button"
                aria-label="เพิ่มจำนวน"
                onClick={() => onSetQuantity(line.product.id, line.quantity + 1)}
                className="min-h-touch min-w-touch flex items-center justify-center border border-royal/30 rounded text-royal"
              >
                <Plus size={18} strokeWidth={1.5} />
              </button>

              <button
                type="button"
                aria-label={`นำ ${line.product.name} ออกจากตะกร้า`}
                onClick={() => onRemove(line.product.id)}
                className="ml-auto min-h-touch min-w-touch flex items-center justify-center text-danger"
              >
                <Trash2 size={18} strokeWidth={1.5} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
