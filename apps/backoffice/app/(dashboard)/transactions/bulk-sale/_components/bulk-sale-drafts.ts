import type { DeliveryNoteData } from "@/lib/delivery-note-layout";
import type { BulkSaleRow } from "./types";

// Daftar tunggu Bulk Sale disimpan di server (tabel `bulk_sale_drafts`), bukan localStorage
// lagi — supaya draft tetap ada walau dilanjutkan dari device/browser lain (task kanban #38
// Bagian B). Batas jumlah draft per user ditegakkan di server (lihat
// `app/api/bo/bulk-sale-drafts/route.ts`), bukan lagi di sini.

export type BulkSaleDraftSource = {
  kind: "IBT" | "ORDER";
  id: number;
  number: string;
  destinationBranchName?: string | null;
};

export type BulkSaleDraft = {
  id: string;
  name: string;
  savedAt: string;
  branchId: number;
  branchName: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  paymentMethodId: number;
  dpMethodId: number;
  amountPaid: number;
  transactionDiscount: number;
  dueAt: string;
  rows: BulkSaleRow[];
  grandTotal: number;
  itemCount: number;
  // Tautan sumber ikut disimpan supaya draf dari Internal PO / Order Portal tidak
  // kehilangan kaitannya — kalau hilang, sumbernya tak pernah tertandai terkonversi.
  source: BulkSaleDraftSource | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseSource(value: unknown): BulkSaleDraftSource | null {
  if (!isRecord(value)) return null;
  if (value.kind !== "IBT" && value.kind !== "ORDER") return null;
  if (typeof value.id !== "number") return null;
  return {
    kind: value.kind,
    id: value.id,
    number: readString(value.number, String(value.id)),
    destinationBranchName: typeof value.destinationBranchName === "string" ? value.destinationBranchName : null,
  };
}

function parseDraft(value: unknown): BulkSaleDraft | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !Array.isArray(value.rows) || value.rows.length === 0) return null;

  return {
    id: value.id,
    name: readString(value.name, "Tanpa nama"),
    savedAt: readString(value.savedAt, new Date().toISOString()),
    branchId: readNumber(value.branchId),
    branchName: readString(value.branchName, "-"),
    customerId: typeof value.customerId === "number" ? value.customerId : null,
    customerName: readString(value.customerName),
    customerPhone: typeof value.customerPhone === "string" ? value.customerPhone : null,
    paymentMethodId: readNumber(value.paymentMethodId),
    dpMethodId: readNumber(value.dpMethodId),
    amountPaid: readNumber(value.amountPaid),
    transactionDiscount: readNumber(value.transactionDiscount),
    dueAt: readString(value.dueAt),
    rows: value.rows as BulkSaleRow[],
    grandTotal: readNumber(value.grandTotal),
    itemCount: readNumber(value.itemCount),
    source: parseSource(value.source),
  };
}

export function parseDrafts(raw: unknown): BulkSaleDraft[] {
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (!Array.isArray(value)) return [];
  return value.map(parseDraft).filter((draft): draft is BulkSaleDraft => draft !== null);
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchBulkSaleDrafts(): Promise<BulkSaleDraft[]> {
  try {
    const res = await fetch("/api/bo/bulk-sale-drafts");
    if (!res.ok) return [];
    return parseDrafts(await res.json());
  } catch {
    return [];
  }
}

// Melempar bila request gagal, supaya pemanggilnya bisa memberi tahu — bukan diam-diam
// kehilangan draf yang dikira sudah tersimpan.
export async function createBulkSaleDraft(
  draft: Omit<BulkSaleDraft, "id" | "savedAt">,
): Promise<BulkSaleDraft> {
  const res = await fetch("/api/bo/bulk-sale-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Gagal menyimpan draft bulk sale");
  }
  const parsed = parseDraft(await res.json());
  if (!parsed) throw new Error("Respons draft bulk sale tidak valid");
  return parsed;
}

export async function deleteBulkSaleDraft(id: string): Promise<void> {
  try {
    await fetch(`/api/bo/bulk-sale-drafts/${id}`, { method: "DELETE" });
  } catch {
    // abaikan — draft yatim di server tidak berbahaya, akan tampak lagi di daftar
    // kalau dibuka ulang dan bisa dihapus lagi saat itu
  }
}

/**
 * Surat jalan TANPA harga dari draf yang ditahan — untuk dicocokkan dengan sistem lama
 * sebelum transaksinya benar-benar dibuat. Nomor "DRAF" menandai ini bukan nota terbit.
 */
export function draftToDeliveryNote(
  draft: BulkSaleDraft,
  meta: { transactionDate: string; staffName: string },
): DeliveryNoteData {
  return {
    transactionNumber: `DRAF ${draft.name}`.slice(0, 28),
    transactionDate: meta.transactionDate,
    branchName: draft.branchName,
    customerName: draft.customerName || "-",
    customerPhone: draft.customerPhone,
    staffName: meta.staffName,
    withPrice: false,
    items: draft.rows,
  };
}
