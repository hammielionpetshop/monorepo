import { create } from 'zustand';
import { CartItem, CartTotals } from '@petshop/shared';

interface CartState {
  items: CartItem[];
  customerId: number | null;
  
  addItem: (item: CartItem) => void;
  removeItem: (productId: number, uomId: number) => void;
  updateQty: (productId: number, uomId: number, qty: number) => void;
  updateItem: (productId: number, uomId: number, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  setCustomer: (id: number | null) => void;
  
  getTotals: () => CartTotals;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerId: null,

  addItem: (newItem) => {
    const existingIndex = get().items.findIndex(
      (item) => item.productId === newItem.productId && item.uomId === newItem.uomId
    );

    if (existingIndex > -1) {
      const updatedItems = [...get().items];
      updatedItems[existingIndex].qty += newItem.qty;
      updatedItems[existingIndex].subtotal = (updatedItems[existingIndex].unitPrice * updatedItems[existingIndex].qty) - updatedItems[existingIndex].discountAmount;
      set({ items: updatedItems });
    } else {
      set({ items: [...get().items, newItem] });
    }
  },

  removeItem: (productId, uomId) => {
    set({
      items: get().items.filter((i) => !(i.productId === productId && i.uomId === uomId))
    });
  },

  updateQty: (productId, uomId, qty) => {
    const updatedItems = get().items.map((item) => {
      if (item.productId === productId && item.uomId === uomId) {
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
  
  updateItem: (productId, uomId, updates) => {
    const updatedItems = get().items.map((item) => {
      if (item.productId === productId && item.uomId === uomId) {
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

  clearCart: () => set({ items: [], customerId: null }),
  
  setCustomer: (id) => set({ customerId: id }),

  getTotals: () => {
    const items = get().items;
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
    const discountTotal = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const grandTotal = subtotal - discountTotal;
    const itemCount = items.length;

    return { subtotal, discountTotal, grandTotal, itemCount };
  }
}));
