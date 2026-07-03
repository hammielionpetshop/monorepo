import Big from "big.js";
import type { BulkSaleRow, BulkSaleTotals } from "./types";

type RowInput = {
  qty: number;
  unitPrice: number;
  discountAmount: number;
};

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} harus berupa angka bulat minimal 0`);
  }
}

export function calculateRowSubtotal(input: RowInput) {
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new Error("Qty harus berupa angka bulat positif");
  }
  if (!Number.isInteger(input.unitPrice) || input.unitPrice <= 0) {
    throw new Error("Harga harus berupa angka bulat positif");
  }
  assertNonNegativeInteger(input.discountAmount, "Diskon");

  const gross = new Big(input.qty).times(input.unitPrice);
  const discount = new Big(input.discountAmount);

  if (discount.gt(gross)) {
    throw new Error("Diskon tidak boleh lebih besar dari subtotal bruto");
  }

  return Number(gross.minus(discount).toFixed(0));
}

export function calculateBulkSaleTotals(
  rows: BulkSaleRow[],
  amountPaid: number,
  transactionDiscount = 0,
): BulkSaleTotals {
  assertNonNegativeInteger(amountPaid, "Jumlah bayar");
  assertNonNegativeInteger(transactionDiscount, "Diskon transaksi");

  const subtotal = rows.reduce((total, row) => total.plus(new Big(row.qty).times(row.unitPrice)), new Big(0));
  const discountTotal = rows.reduce((total, row) => total.plus(row.discountAmount), new Big(0));
  const netAfterItem = subtotal.minus(discountTotal);
  const netAfterItemNum = Number(netAfterItem.toFixed(0));
  const effectiveTransactionDiscount = Math.min(transactionDiscount, Math.max(0, netAfterItemNum));
  const grandTotal = netAfterItem.minus(effectiveTransactionDiscount);
  const itemCount = rows.reduce((total, row) => total + row.qty, 0);

  return {
    subtotal: Number(subtotal.toFixed(0)),
    discountTotal: Number(discountTotal.toFixed(0)),
    transactionDiscount: effectiveTransactionDiscount,
    grandTotal: Number(grandTotal.toFixed(0)),
    amountPaid,
    change: Number(new Big(amountPaid).minus(grandTotal).toFixed(0)),
    itemCount,
  };
}

// Mengalokasikan diskon transaksi (nominal) ke tiap baris secara proporsional
// terhadap nilai bersih baris (bruto − diskon item). Mengembalikan total diskon
// per baris (diskon item + porsi alokasi), integer, dijamin ≤ bruto baris dan
// jumlahnya == diskon item + diskon transaksi efektif.
export function allocateTransactionDiscount(rows: RowInput[], transactionDiscount: number): number[] {
  const baseDiscounts = rows.map((row) => row.discountAmount);
  if (transactionDiscount <= 0 || rows.length === 0) return baseDiscounts;

  const nets = rows.map((row) => new Big(row.qty).times(row.unitPrice).minus(row.discountAmount));
  const totalNet = nets.reduce((total, net) => total.plus(net), new Big(0));
  const totalNetNum = Number(totalNet.toFixed(0));
  if (totalNetNum <= 0) return baseDiscounts;

  const clamped = Math.min(transactionDiscount, totalNetNum);

  const shares = nets.map((net) => new Big(clamped).times(net).div(totalNet));
  const floors = shares.map((share) => Number(share.round(0, Big.roundDown)));
  let remainder = clamped - floors.reduce((total, value) => total + value, 0);

  const order = shares
    .map((share, index) => ({
      index,
      frac: Number(share.minus(floors[index])),
      room: Number(nets[index].toFixed(0)) - floors[index],
    }))
    .sort((a, b) => b.frac - a.frac);

  for (const entry of order) {
    if (remainder <= 0) break;
    if (entry.room > 0) {
      floors[entry.index] += 1;
      remainder -= 1;
    }
  }

  return baseDiscounts.map((discount, index) => discount + floors[index]);
}
