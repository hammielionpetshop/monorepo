import { create } from 'zustand';
import { CartItem, CartTotals } from '@petshop/shared';

interface CartState {
  items: CartItem[];
  customerId: number | null;

  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  updateItem: (productId: number, updates: Partial<CartItem>) => void;
  replaceItem: (productId: number, newItem: CartItem) => void;
  clearCart: () => void;
  setCustomer: (id: number | null) => void;

  getTotals: () => CartTotals;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,

  addItem: (newItem) => {
    const existingIndex = get().items.findIndex(
      (item) => item.productId === newItem.productId
    );

    if (existingIndex > -1) {
      // Product already in cart — update qty and recalc subtotal (keep existing UOM/price)
      const updatedItems = [...get().items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        qty: updatedItems[existingIndex].qty + newItem.qty,
        subtotal: (updatedItems[existingIndex].unitPrice * (updatedItems[existingIndex].qty + newItem.qty)) - updatedItems[existingIndex].discountAmount,
      };
      set({ items: updatedItems });
    } else {
      set({ items: [...get().items, newItem] });
    }
  },

  removeItem: (productId) => {
    set({
      items: get().items.filter((i) => i.productId !== productId)
    });
  },

  updateQty: (productId, qty) => {
    const updatedItems = get().items.map((item) => {
      if (item.productId === productId) {
        const newQty = Math.max(0, qty);
        return {
          ...item,
          qty: newQty,
          subtotal: (item.unitPrice * newQty) - item.discountAmount
        };
      }
      return item;
    }).filter(i => i.qty > 0);
    set({ items: updatedItems });
  },

  updateItem: (productId, updates) => {
    const updatedItems = get().items.map((item) => {
      if (item.productId === productId) {
        const newItem = { ...item, ...updates };
        return {
          ...newItem,
          subtotal: (newItem.unitPrice * newItem.qty) - newItem.discountAmount
        };
      }
      return item;
    });
    set({ items: updatedItems });
  },

  replaceItem: (productId, newItem) => {
    const updatedItems = get().items.map((item) => {
      if (item.productId === productId) {
        return newItem;
      }
      return item;
    });
    set({ items: updatedItems });
  },

  clearCart: () => set({ items: [], customerId: null }),
  
  setCustomer: (id) => set({ customerId: id }),

  getTotals: () => {
    const items = get().items;
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const discountTotal = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const grandTotal = subtotal - discountTotal;
    const itemCount = items.length;
    // Hanya hitung berat dari item yang punya weightGram
    const totalWeightGram = items.reduce((sum, item) => {
      if (item.weightGram != null) {
        return sum + (item.weightGram * item.qty);
      }
      return sum;
    }, 0);

    return { subtotal, discountTotal, grandTotal, itemCount, totalWeightGram };
  }
}));
