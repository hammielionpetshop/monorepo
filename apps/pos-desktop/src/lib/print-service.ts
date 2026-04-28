import type { CartItem, CartTotals, TransactionPayment } from '@petshop/shared';

export interface PrintPayload {
  trxNumber: string;
  items: CartItem[];
  totals: CartTotals;
  payments: TransactionPayment[];
  isReprint?: boolean;
}

export const printService = {
  printReceipt: async (payload: PrintPayload) => {
    try {
      console.log('[PrintService] Requesting print for:', payload.trxNumber);
      const result = await (window as any).ipcRenderer.printer.printReceipt(payload);
      return result;
    } catch (err) {
      console.error('[PrintService] IPC Error:', err);
      return { success: false, error: (err as Error).message };
    }
  },
  printSettlementReport: async (summary: any, copies: number = 1) => {
    try {
      console.log('[PrintService] Requesting settlement print');
      const result = await (window as any).ipcRenderer.printer.printSettlement({ summary, copies });
      return result;
    } catch (err) {
      console.error('[PrintService] IPC Error:', err);
      return { success: false, error: (err as Error).message };
    }
  }
};
