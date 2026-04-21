import { create } from 'zustand';

interface PendingAction {
  type: 'PRICE_OVERRIDE' | 'STOCK_OVERRIDE';
  productId: number;
  uomId: number;
  data?: any;
}

interface POSState {
  products: any[];
  categories: any[];
  conversions: any[];
  prices: any[];
  customers: any[];
  uoms: any[];
  paymentMethods: any[];
  expenseCategories: any[];
  priceTiers: string[];
  isLoading: boolean;
  isInitialized: boolean;
  
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;

  setBootstrapData: (data: any) => void;
  setLoading: (loading: boolean) => void;
  
  // Dialog States
  activeOverrideItem: { productId: number, uomId: number } | null;
  showPinChallenge: boolean;
  showOverrideDialog: boolean;
  
  setOverrideItem: (item: { productId: number, uomId: number } | null) => void;
  setShowPinChallenge: (show: boolean) => void;
  setShowOverrideDialog: (show: boolean) => void;
  showOpenBillsDrawer: boolean;
  setShowOpenBillsDrawer: (show: boolean) => void;
}

export const usePOSStore = create<POSState>((set) => ({
  products: [],
  categories: [],
  conversions: [],
  prices: [],
  customers: [],
  uoms: [],
  paymentMethods: [],
  expenseCategories: [],
  priceTiers: [],
  isLoading: false,
  isInitialized: false,

  setBootstrapData: (data) => set({
    products: data.products,
    categories: data.categories ?? [],
    conversions: data.conversions,
    prices: data.prices,
    customers: data.customers,
    uoms: data.uoms,
    paymentMethods: data.paymentMethods,
    expenseCategories: data.expenseCategories ?? [],
    priceTiers: data.priceTiers,
    isInitialized: true,
    isLoading: false
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),

  activeOverrideItem: null,
  showPinChallenge: false,
  showOverrideDialog: false,

  setOverrideItem: (item) => set({ activeOverrideItem: item }),
  setShowPinChallenge: (show) => set({ showPinChallenge: show }),
  setShowOverrideDialog: (show) => set({ showOverrideDialog: show }),
  showOpenBillsDrawer: false,
  setShowOpenBillsDrawer: (show) => set({ showOpenBillsDrawer: show }),
}));
