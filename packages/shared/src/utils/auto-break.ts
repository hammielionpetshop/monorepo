/**
 * Auto-Break Algorithm for multi-UOM products.
 * Calculates how many "Besar" UOMs (e.g., Sak) should be broken into "Kecil" UOMs (e.g., Pcs).
 */

export interface StockState {
  /** Stock in big unit (e.g., Sak, Dus, Bal) */
  qtyBesar: number;
  /** Stock in small unit (e.g., Pcs, Bungkus, Gram) */
  qtyKecil: number;
  /** 1 Besar = [conversionRatio] Kecil */
  conversionRatio: number;
}

export interface AutoBreakResult {
  success: boolean;
  /** The final stock state after the sale */
  newStock: {
    qtyBesar: number;
    qtyKecil: number;
  };
  /** Whether any "Besar" units were actually broken */
  autoBreakTriggered: boolean;
  /** The number of "Besar" units that were broken */
  sacsBroken: number;
  /** Error message if successful = false */
  error?: string;
}

/**
 * Calculates the new stock state after selling a certain quantity of a specific UOM.
 * Supports auto-breaking "Besar" units into "Kecil" units if "Kecil" stock is insufficient.
 *
 * @param stock Current stock state and conversion ratio
 * @param uomType 'besar' or 'kecil'
 * @param qtyRequested Quantity being sold
 */
export function processSaleWithAutoBreak(
  stock: StockState,
  uomType: "besar" | "kecil",
  qtyRequested: number
): AutoBreakResult {
  const { qtyBesar, qtyKecil, conversionRatio } = stock;

  // Case 1: Selling "Besar" UOM
  if (uomType === "besar") {
    if (qtyBesar < qtyRequested) {
      return {
        success: false,
        newStock: { qtyBesar, qtyKecil },
        autoBreakTriggered: false,
        sacsBroken: 0,
        error: "Stok UOM Besar tidak mencukupi untuk transaksi ini.",
      };
    }

    return {
      success: true,
      newStock: {
        qtyBesar: qtyBesar - qtyRequested,
        qtyKecil,
      },
      autoBreakTriggered: false,
      sacsBroken: 0,
    };
  }

  // Case 2: Selling "Kecil" UOM
  // Case 2A: Stock is sufficient without breaking
  if (qtyKecil >= qtyRequested) {
    return {
      success: true,
      newStock: {
        qtyBesar,
        qtyKecil: qtyKecil - qtyRequested,
      },
      autoBreakTriggered: false,
      sacsBroken: 0,
    };
  }

  // Case 2B: Stock is insufficient, need "Auto-Break"
  const deficit = qtyRequested - qtyKecil;
  const sacsToBreak = Math.ceil(deficit / conversionRatio);

  if (sacsToBreak > qtyBesar) {
    return {
      success: false,
      newStock: { qtyBesar, qtyKecil },
      autoBreakTriggered: false,
      sacsBroken: 0,
      error: "Stok total (termasuk UOM Besar) tidak mencukupi untuk transaksi ini.",
    };
  }

  const newQtyBesar = qtyBesar - sacsToBreak;
  const newQtyKecil = qtyKecil + (sacsToBreak * conversionRatio) - qtyRequested;

  return {
    success: true,
    newStock: {
      qtyBesar: newQtyBesar,
      qtyKecil: newQtyKecil,
    },
    autoBreakTriggered: true,
    sacsBroken: sacsToBreak,
  };
}
