import { describe, expect, it } from "vitest";
import { calcTonase, formatTonaseLine, resolveUomWeightGram } from "./delivery-note-weight";

describe("resolveUomWeightGram", () => {
  it("memakai berat konversi UOM bila tersedia", () => {
    // Berat 1 karung terdata langsung 25.000 g — ratio tidak dipakai.
    expect(resolveUomWeightGram(25000, 1000, 25)).toBe(25000);
  });

  it("fallback ke ratio x berat base bila konversi tidak punya berat", () => {
    // MINYAK IKAN: 1 PAX = 20 pcs, base 500 g/pcs -> 10.000 g per PAX.
    expect(resolveUomWeightGram(null, 500, 20)).toBe(10000);
  });

  it("base UOM (ratio 1) memakai berat base apa adanya", () => {
    expect(resolveUomWeightGram(null, 500, 1)).toBe(500);
  });

  it("null bila kedua sumber berat kosong", () => {
    expect(resolveUomWeightGram(null, null, 20)).toBeNull();
  });

  it("memperlakukan 0 dan nilai negatif sebagai tidak terdata", () => {
    expect(resolveUomWeightGram(0, 0, 20)).toBeNull();
    expect(resolveUomWeightGram(-5, null, 20)).toBeNull();
  });

  it("ratio tidak valid dianggap 1, bukan NaN", () => {
    expect(resolveUomWeightGram(null, 500, 0)).toBe(500);
    expect(resolveUomWeightGram(null, 500, Number.NaN)).toBe(500);
  });
});

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
