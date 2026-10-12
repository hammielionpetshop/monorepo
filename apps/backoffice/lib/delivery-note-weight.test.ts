import { describe, expect, it } from "vitest";
import { calcTonase, formatTonaseLine } from "./delivery-note-weight";

describe("calcTonase", () => {
  it("mengalikan qty dengan berat per unit", () => {
    const result = calcTonase([
      { qty: 2, weightGram: 10000 },
      { qty: 3, weightGram: 500 },
    ]);
    expect(result.totalGram).toBe(21500);
    expect(result.unknownCount).toBe(0);
    expect(result.isEmpty).toBe(false);
  });

  it("menghitung item tanpa berat sebagai unknown, bukan nol diam-diam", () => {
    const result = calcTonase([
      { qty: 2, weightGram: 10000 },
      { qty: 5, weightGram: null },
    ]);
    expect(result.totalGram).toBe(20000);
    expect(result.unknownCount).toBe(1);
    expect(result.isEmpty).toBe(false);
  });

  it("isEmpty saat tidak ada satu pun berat diketahui", () => {
    const result = calcTonase([
      { qty: 2, weightGram: null },
      { qty: 5 },
    ]);
    expect(result.totalGram).toBe(0);
    expect(result.isEmpty).toBe(true);
  });
});

describe("formatTonaseLine", () => {
  it("format kg dengan 2 desimal gaya id-ID", () => {
    expect(formatTonaseLine([{ qty: 2, weightGram: 10000 }])).toBe("TONASE: 20,00 kg");
  });

  it("memisahkan ribuan", () => {
    expect(formatTonaseLine([{ qty: 100, weightGram: 25000 }])).toBe("TONASE: 2.500,00 kg");
  });

  it("memberi catatan bila ada item tanpa data berat", () => {
    const line = formatTonaseLine([
      { qty: 2, weightGram: 10000 },
      { qty: 5, weightGram: null },
      { qty: 1, weightGram: null },
    ]);
    expect(line).toBe("TONASE: 20,00 kg (2 item tanpa data berat)");
  });

  it("null (baris tidak dicetak) bila tidak ada data berat sama sekali", () => {
    // Surat jalan lebih baik tanpa baris tonase daripada mencetak "0 kg" yang salah.
    expect(formatTonaseLine([{ qty: 2, weightGram: null }])).toBeNull();
    expect(formatTonaseLine([])).toBeNull();
  });
});
