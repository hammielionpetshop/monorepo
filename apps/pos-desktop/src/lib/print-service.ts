export interface PrintPayload {
  trxNumber: string;
  items: any[];
  totals: any;
  payments: any[];
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
  }
};
