import { describe, expect, it } from "vitest";
import type { JWTPayload } from "@petshop/shared";
import {
  allowedBranchIds,
  canSwitchBranch,
  isBranchAllowed,
  resolveActiveBranchId,
  resolveActiveBranchName,
} from "./active-branch";

function payload(over: Partial<JWTPayload> = {}): JWTPayload {
  return {
    userId: 7,
    userName: "Sari",
    staffNumber: "S07",
    branchId: 2,
    branchName: "Toko Pusat",
    role: "KASIR",
    permissions: [],
    branchScope: "OWN",
    ...over,
  };
}

const cookies = (jar: Record<string, string>) => ({
  get: (name: string) => (name in jar ? { value: jar[name] } : undefined),
});

describe("allowedBranchIds", () => {
  it("scope ALL bebas memilih cabang mana pun", () => {
    expect(allowedBranchIds(payload({ branchScope: "ALL" }))).toBe("ALL");
  });

  it("token lama tanpa branchIds jatuh ke cabang utamanya saja", () => {
    // Sesi yang belum login ulang setelah fitur ini terpasang harus berperilaku
    // persis seperti sebelumnya: satu cabang, tak ada yang bisa dipilih.
    expect(allowedBranchIds(payload())).toEqual([2]);
  });

  it("cabang utama selalu ikut walau tidak ada di branchIds", () => {
    expect(allowedBranchIds(payload({ branchIds: [5, 9] }))).toEqual([2, 5, 9]);
  });
});

describe("canSwitchBranch", () => {
  it("staf bercabang tunggal tidak punya yang bisa dipilih", () => {
    expect(canSwitchBranch(payload({ branchIds: [2] }))).toBe(false);
  });

  it("staf dengan penugasan kedua boleh berpindah", () => {
    expect(canSwitchBranch(payload({ branchIds: [2, 5] }))).toBe(true);
  });

  it("pemegang scope ALL selalu boleh berpindah", () => {
    expect(canSwitchBranch(payload({ branchScope: "ALL" }))).toBe(true);
  });
});

describe("isBranchAllowed", () => {
  it("menolak cabang di luar penugasan", () => {
    expect(isBranchAllowed(payload({ branchIds: [2, 5] }), 9)).toBe(false);
  });

  it("menerima cabang yang ditugaskan", () => {
    expect(isBranchAllowed(payload({ branchIds: [2, 5] }), 5)).toBe(true);
  });
});

describe("resolveActiveBranchId", () => {
  it("memakai cookie bila cabangnya memang ditugaskan", () => {
    const p = payload({ branchIds: [2, 5] });
    expect(resolveActiveBranchId(p, cookies({ posBranchId: "5" }))).toBe(5);
  });

  it("cookie yang menunjuk cabang bukan haknya jatuh ke cabang utama", () => {
    // Inti perbaikan otorisasinya: sebelum ini cookie diterima apa adanya asalkan
    // role-nya kebetulan cocok, sehingga cabang mana pun bisa dipakai.
    const p = payload({ branchIds: [2, 5] });
    expect(resolveActiveBranchId(p, cookies({ posBranchId: "9" }))).toBe(2);
  });

  it("cookie sampah tidak menjatuhkan apa pun", () => {
    const p = payload({ branchIds: [2, 5] });
    expect(resolveActiveBranchId(p, cookies({ posBranchId: "abc" }))).toBe(2);
    expect(resolveActiveBranchId(p, cookies({ posBranchId: "-3" }))).toBe(2);
    expect(resolveActiveBranchId(p, cookies({}))).toBe(2);
  });

  it("pemegang scope ALL boleh memakai cabang di luar penugasannya", () => {
    const p = payload({ branchScope: "ALL", role: "OWNER" });
    expect(resolveActiveBranchId(p, cookies({ posBranchId: "9" }))).toBe(9);
  });
});

describe("resolveActiveBranchName", () => {
  it("mengikuti nama di cookie saat id-nya diterima", () => {
    const p = payload({ branchIds: [2, 5] });
    const jar = cookies({ posBranchId: "5", posBranchName: "Toko Depan" });
    expect(resolveActiveBranchName(p, jar)).toBe("Toko Depan");
  });

  it("nama ikut jatuh saat id-nya ditolak", () => {
    // Kalau nama tetap memakai cookie sementara datanya ditarik dari cabang utama,
    // layar akan menampilkan cabang yang bukan sumber angkanya.
    const p = payload({ branchIds: [2, 5] });
    const jar = cookies({ posBranchId: "9", posBranchName: "Gudang" });
    expect(resolveActiveBranchName(p, jar)).toBe("Toko Pusat");
  });
});
