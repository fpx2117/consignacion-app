"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CatalogCartItem, PublicCatalogProduct } from "@/lib/types";
import { getCatalogCartSubtotal } from "@/lib/catalog-cart-pricing";

type UseCartOptions = {
  storageKey?: string;
  sucursalId?: number;
};

type UseCartReturn = {
  cart: CatalogCartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  total: number;
  hydrated: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: PublicCatalogProduct, pricingMode?: "default" | "consigne") => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
};

/**
 * Hook de carrito independiente.
 * Maneja estado, localStorage, y operaciones (agregar, quitar, cantidad, limpiar).
 */
export function useCart(options: UseCartOptions = {}): UseCartReturn {
  const storageKey = options.storageKey || "public_catalog_cart_v1:1";
  const [cart, setCart] = useState<CatalogCartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (e) {
      console.warn("useCart: error al hidratar carrito", e);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  // Persistir a localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (cart.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      }
    } catch (e) {
      console.warn("useCart: error al persistir carrito", e);
    }
  }, [cart, hydrated, storageKey]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addToCart = useCallback(
    (product: PublicCatalogProduct, pricingMode: "default" | "consigne" = "default") => {
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [...prev, { ...product, quantity: 1, pricingMode }];
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: number) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setIsOpen(false);
  }, []);

  const itemCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((acc, item) => acc + Number(item.precioVenta) * item.quantity, 0),
    [cart]
  );

  const total = subtotal;

  return {
    cart,
    isOpen,
    itemCount,
    subtotal,
    total,
    hydrated,
    openCart,
    closeCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  };
}
