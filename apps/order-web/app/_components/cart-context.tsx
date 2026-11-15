'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CartView } from './types';

const EMPTY_CART: CartView = { items: [], subtotal: 0, minOrderAmount: 0, meetsMinimum: true };

interface CartContextValue {
  cart: CartView;
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, uomId: number, qty: number) => Promise<{ ok: boolean; error?: string }>;
  setQty: (cartItemId: number, qty: number) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (cartItemId: number) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/cart');
    if (res.ok) setCart(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId: number, uomId: number, qty: number) => {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, uomId, qty }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Gagal menambah item' };
    setCart(data);
    return { ok: true };
  }, []);

  const setQty = useCallback(async (cartItemId: number, qty: number) => {
    const res = await fetch(`/api/cart/${cartItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? 'Gagal mengubah jumlah' };
    setCart(data);
    return { ok: true };
  }, []);

  const removeItem = useCallback(async (cartItemId: number) => {
    const res = await fetch(`/api/cart/${cartItemId}`, { method: 'DELETE' });
    if (res.ok) setCart(await res.json());
  }, []);

  const itemCount = cart.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{ cart, itemCount, loading, refresh, addItem, setQty, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart harus dipakai di dalam CartProvider');
  return ctx;
}
