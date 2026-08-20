import { describe, expect, it } from "vitest";
import { filterShippedSjItems } from "./internal-transfer-sj";

describe("filterShippedSjItems", () => {
  it("membuang item yang qty kirimnya 0 (dikosongkan approver karena stok habis)", () => {
    const items = [
      { id: 1, qtyShipped: 5 },
      { id: 2, qtyShipped: 0 },
      { id: 3, qtyShipped: 3 },
    ];
    expect(filterShippedSjItems(items)).toEqual([
      { id: 1, qtyShipped: 5 },
      { id: 3, qtyShipped: 3 },
    ]);
  });

  it("tetap mengembalikan array kosong bila semua item qty kirimnya 0", () => {
    expect(filterShippedSjItems([{ qtyShipped: 0 }, { qtyShipped: 0 }])).toEqual([]);
  });

  it("mengembalikan semua item bila semua sudah dikirim", () => {
    const items = [{ qtyShipped: 2 }, { qtyShipped: 7 }];
    expect(filterShippedSjItems(items)).toEqual(items);
  });

  it("array kosong tetap menghasilkan array kosong", () => {
    expect(filterShippedSjItems([])).toEqual([]);
  });
});
