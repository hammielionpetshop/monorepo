import { describe, expect, it } from "vitest";
import {
  baseUnitWeightGram,
  fixedUnitWeightGram,
  formatWeightGram,
  resolveUomWeightGram,
} from "./product-weight";

describe("fixedUnitWeightGram", () => {
  it("GRAM dan KG punya berat pasti", () => {
    expect(fixedUnitWeightGram("GRAM")).toBe(1);
    expect(fixedUnitWeightGram("kg")).toBe(1000);
    expect(fixedUnitWeightGram(" Kg ")).toBe(1000);
  });

  it("satuan hitungan (PCS, SAK, DUS) tidak punya berat pasti", () => {
    expect(fixedUnitWeightGram("PCS")).toBeNull();
    expect(fixedUnitWeightGram("SAK")).toBeNull();
    expect(fixedUnitWeightGram(null)).toBeNull();
  });
});

describe("baseUnitWeightGram", () => {
  it("memakai berat yang terdata untuk satuan hitungan", () => {
    expect(baseUnitWeightGram("PCS", 80)).toBe(80);
    expect(baseUnitWeightGram("PCS", "80")).toBe(80);
  });

  it("kosong, 0, dan negatif dianggap belum terdata", () => {
    expect(baseUnitWeightGram("PCS", null)).toBeNull();
    expect(baseUnitWeightGram("PCS", "")).toBeNull();
    expect(baseUnitWeightGram("PCS", 0)).toBeNull();
    expect(baseUnitWeightGram("PCS", -5)).toBeNull();
  });

  it("satuan GRAM/KG mengabaikan angka yang salah isi", () => {
    // Jagung dijual per gram tapi beratnya sempat terisi 500 → tonase bengkak 500×.
    expect(baseUnitWeightGram("GRAM", 500)).toBe(1);
    expect(baseUnitWeightGram("KG", null)).toBe(1000);
  });
});

describe("resolveUomWeightGram", () => {
  it("satuan besar = isi × berat satuan terkecil", () => {
    // MEO pouch 80 g, 1 dus isi 12 → 960 g (bukan 1.920 yang dulu diketik manual).
    expect(resolveUomWeightGram("PCS", 80, 12)).toBe(960);
  });

  it("satuan terkecil (ratio 1) memakai berat apa adanya", () => {
    expect(resolveUomWeightGram("PCS", 500, 1)).toBe(500);
  });

  it("sak dari produk per-KG dihitung dari isi", () => {
    expect(resolveUomWeightGram("KG", 1000, 30)).toBe(30000);
    expect(resolveUomWeightGram("GRAM", 500, 8000)).toBe(8000);
  });

  it("null bila berat satuan terkecil belum terdata", () => {
    expect(resolveUomWeightGram("PCS", null, 20)).toBeNull();
    expect(resolveUomWeightGram("PCS", 0, 20)).toBeNull();
  });

  it("ratio tidak valid dianggap 1, bukan NaN", () => {
    expect(resolveUomWeightGram("PCS", 500, 0)).toBe(500);
    expect(resolveUomWeightGram("PCS", 500, Number.NaN)).toBe(500);
    expect(resolveUomWeightGram("PCS", 500, null)).toBe(500);
  });
});

describe("formatWeightGram", () => {
  it("gram di bawah 1 kg, kilogram di atasnya", () => {
    expect(formatWeightGram(80)).toBe("80 g");
    expect(formatWeightGram(960)).toBe("960 g");
    expect(formatWeightGram(1200)).toBe("1,2 kg");
    expect(formatWeightGram(20000)).toBe("20 kg");
  });
});
