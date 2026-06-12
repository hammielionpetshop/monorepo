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

export function calculateBulkSaleTotals(rows: BulkSaleRow[], amountPaid: number): BulkSaleTotals {
  assertNonNegativeInteger(amountPaid, "Jumlah bayar");

  const subtotal = rows.reduce((total, row) => total.plus(new Big(row.qty).times(row.unitPrice)), new Big(0));
  const discountTotal = rows.reduce((total, row) => total.plus(row.discountAmount), new Big(0));
  const grandTotal = subtotal.minus(discountTotal);
  const itemCount = rows.reduce((total, row) => total + row.qty, 0);

  return {
    subtotal: Number(subtotal.toFixed(0)),
    discountTotal: Number(discountTotal.toFixed(0)),
    grandTotal: Number(grandTotal.toFixed(0)),
    amountPaid,
    change: Number(new Big(amountPaid).minus(grandTotal).toFixed(0)),
    itemCount,
  };
}
