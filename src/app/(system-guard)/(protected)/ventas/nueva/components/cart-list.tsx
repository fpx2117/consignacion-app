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
        className="h-full min-h-0 flex flex-col items-center justify-center text-center gap-3 px-4 [@media(max-height:600px)]:gap-2"
        role="status"
      >
        <div className="p-5 rounded-full bg-muted/60 border border-border/40 shadow-sm">
          <ShoppingCart
            className="h-10 w-10 text-muted-foreground/40"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-[900] tracking-widest uppercase text-muted-foreground/70">
            Ticket vacio
          </p>
          <p className="text-xs text-muted-foreground/50 max-w-[240px] leading-relaxed">
            Escanea un producto, presioná{" "}
            <span className="font-mono font-bold text-foreground/70">F1</span>{" "}
            para buscarlo o abrí la cámara.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full min-w-0 max-w-full space-y-2.5 overflow-x-clip pb-4" aria-label="Productos en carrito">
      <AnimatePresence initial={false}>
        {cart.map((item, idx) => {
          const discountInfo = getDiscountInfo(item);
          return (
            <motion.div key={item.producto.id} className="w-full min-w-0 max-w-full"
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
