// =====================================================================
// ProductGrid — แท็บหมวด + รายการสินค้าของหน้าขาย (§5 หน้า 1)
// ราคาที่แสดงเป็นราคาไม่รวม VAT ตามที่เก็บใน products.price
// =====================================================================
import { formatMoney } from "../../lib/money";
import { StatusBadge } from "../ui/StatusBadge";
import type { ProductWithStock } from "../../types/db";

type Props = {
  products: ProductWithStock[];
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onPick: (product: ProductWithStock) => void;
};

export function ProductGrid({
  products,
  categories,
  activeCategory,
  onCategoryChange,
  onPick,
}: Props) {
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto mb-3" role="tablist" aria-label="หมวดสินค้า">
        {["ทั้งหมด", ...categories].map((category) => {
          const isActive = category === activeCategory;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onCategoryChange(category)}
              className={[
                "shrink-0 min-h-touch px-4 rounded border text-sm",
                isActive
                  ? "bg-royal text-paper border-royal font-medium"
                  : "bg-paper text-royal border-royal/30",
              ].join(" ")}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {products.map((product) => {
          const soldOut = product.quantity <= 0;
          return (
            <button
              key={product.id}
              type="button"
              disabled={soldOut}
              onClick={() => onPick(product)}
              className="panel p-3 text-left min-h-touch disabled:opacity-50 hover:border-royal"
            >
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt=""
                  loading="lazy"
                  aria-hidden
                  className="w-full aspect-square object-cover rounded border border-royal/15 mb-2"
                />
              )}
              <p className="font-medium text-ink leading-snug line-clamp-2">{product.name}</p>
              <p className="num text-xs text-ink/60 mt-1">{product.sku}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="num text-royal font-medium">{formatMoney(product.price)}</span>
                {soldOut ? (
                  <StatusBadge tone="danger">หมด</StatusBadge>
                ) : product.quantity <= product.reorder_point ? (
                  <StatusBadge tone="warning">เหลือ {product.quantity}</StatusBadge>
                ) : (
                  <span className="num text-xs text-ink/60">คงเหลือ {product.quantity}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
