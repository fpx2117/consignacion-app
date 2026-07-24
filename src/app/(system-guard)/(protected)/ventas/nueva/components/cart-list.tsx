import { AnimatePresence, motion } from "motion/react";
import { ShoppingCart } from "lucide-react";

import type { CartItem } from "../types";
import { CartItemCard } from "./cart-item-card";

type CartDiscountInfo = {
  bestDiscountPct: number | null;
  nextDiscountPct: number | null;
  nextDiscountQty: number | null;
  totalSubQty: number;
  subcategoriaNombre: string;
};

type CartListProps = {
  cart: CartItem[];
  getDiscountInfo: (item: CartItem) => CartDiscountInfo;
  onRemoveItem: (productId: number) => void;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onSetQuantity: (productId: number, qty: number) => void;
};

export function CartList({
  cart,
  getDiscountInfo,
  onRemoveItem,
  onUpdateQuantity,
  onSetQuantity,
}: CartListProps) {
  if (cart.length === 0) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-3"
        role="status"
      >
        <div className="p-5 rounded-full bg-muted/50 border border-border/40">
          <ShoppingCart className="h-10 w-10 opacity-30" aria-hidden="true" />
        </div>
        <p className="text-sm font-black tracking-widest uppercase">
          Ticket vacio
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-2.5 pb-4" aria-label="Productos en carrito">
      <AnimatePresence mode="popLayout" initial={false}>
        {cart.map((item, idx) => {
          const discountInfo = getDiscountInfo(item);
          return (
            <motion.div
              key={item.producto.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -20 }}
            >
              <CartItemCard
                item={item}
                index={idx}
                isLast={idx === cart.length - 1}
                onRemove={onRemoveItem}
                onUpdateQuantity={onUpdateQuantity}
                onSetQuantity={onSetQuantity}
                {...discountInfo}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
