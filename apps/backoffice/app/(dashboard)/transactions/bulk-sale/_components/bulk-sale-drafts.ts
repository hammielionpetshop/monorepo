import type { BulkSaleRow } from "./types";

// Daftar tunggu bulk sale disimpan di browser, bukan di server: draf hanya ada di
// komputer & browser tempat ia ditahan, dan ikut hilang kalau data situs dibersihkan.
export const BULK_SALE_DRAFTS_KEY = "bulk_sale_drafts_v1";
export const MAX_BULK_SALE_DRAFTS = 20;

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

// Draf terbaru di atas; yang terlama dibuang saat melewati batas supaya penyimpanan
// browser tidak terus tumbuh tanpa ada yang membersihkan.
export function upsertDraft(drafts: BulkSaleDraft[], draft: BulkSaleDraft): BulkSaleDraft[] {
  const withoutSameId = drafts.filter((existing) => existing.id !== draft.id);
  return [draft, ...withoutSameId].slice(0, MAX_BULK_SALE_DRAFTS);
}

export function removeDraft(drafts: BulkSaleDraft[], id: string): BulkSaleDraft[] {
  return drafts.filter((draft) => draft.id !== id);
}

export function readDrafts(): BulkSaleDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return parseDrafts(window.localStorage.getItem(BULK_SALE_DRAFTS_KEY));
  } catch {
    return [];
  }
}

// Melempar bila penyimpanan penuh atau ditolak (mode privat), supaya pemanggilnya
// bisa memberi tahu — bukan diam-diam kehilangan draf yang dikira sudah tersimpan.
export function writeDrafts(drafts: BulkSaleDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BULK_SALE_DRAFTS_KEY, JSON.stringify(drafts));
}
