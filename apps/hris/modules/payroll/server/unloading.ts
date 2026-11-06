import Big from 'big.js';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, notInArray, sql } from 'drizzle-orm';
import {
  unloadingItems, unloadingPhotos, unloadingReportVersions, unloadingReports, unloadingShares, unloadingWeightChanges,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { getOrgLookup, hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts, callBackofficeInternal } from '@/modules/accounts';
import { dayStatusesOf } from '@/modules/attendance';
import { listCasualWorkers, todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { settingOn } from '@/modules/settings';
import { addDays, longDate, periodEndOf, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import {
  DAY_STATUS_LABELS, FREQUENT_DAYS, HEAVY_WEIGHT_KG, MAX_PHOTOS, MIN_REASON, OTHER_SEARCH_MIN, SEARCH_MIN, UNLOADING_FLAG_LABELS, UNLOADING_STATUS_LABELS,
  computeUnloading, gramsToKg, isWholeQuantity, kgText, kgToGrams, poDifference, needsLook, parseDecimal3, reportNumber, weightChangePercent, weightFlagged, workDateCheck,
  type ItemInput, type ParticipantInput, type UnloadingFlag, type UnloadingStatus,
} from '../rules/unloading';
import { accountNames, loadPeriodPeople } from './data';
import { PO_SYNC_LABELS, type PoSyncStatus } from './unloading-sync';

// Laporan Bongkaran L8a (spec L8 §3.1–3.3; DRV-31 s.d. 46, 101 s.d. 110).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
const LINK = '/gaji/bongkaran';
const reportLink = (id: number) => `${LINK}/${id}`;
const ENDED: UnloadingStatus[] = ['REJECTED', 'WITHDRAWN', 'CANCELLED'];

export const canViewUnloading = (actor: Actor | null) =>
  !!actor && (hasAction(actor, 'unloading.view') || hasAction(actor, 'unloading.create') || hasAction(actor, 'unloading.decide'));
const canCreate = (actor: Actor | null) => !!actor && hasAction(actor, 'unloading.create');

export async function accountsWith(actions: string[]): Promise<number[]> {
  return [...(await activeHrisAccounts(await listEmployeesWithAnyAction(actions))).values()];
}

// ---- Data kasir (view hris.pos_*) ----

type UnitRow = { product_id: number; sku: string | null; name: string; uom_id: number; uom_code: string; uom_name: string; weight_gram: number | null; is_base: boolean };

export type ProductUnit = {
  productId: number; sku: string | null; name: string; uomId: number; uomName: string; isBase: boolean;
  /** Berat per satuan di Master Produk kasir — satu sumber (spec 2026-11-06), atau null = wajib diisi. */
  weight: { kg: string } | null;
};

async function unitsByIds(executor: typeof db | Tx, productIds: number[]): Promise<UnitRow[]> {
  if (!productIds.length) return [];
  return executor.execute<UnitRow>(sql`
    select p.id as product_id, p.sku, p.name, u.uom_id, u.uom_code, u.uom_name, u.weight_gram, u.is_base
    from hris.pos_products p join hris.pos_product_units u on u.product_id = p.id
    where p.id in ${sql.raw(`(${productIds.map(Number).join(',')})`)}
    order by p.name, u.is_base desc, u.uom_name`);
}

const posKg = (u: UnitRow) => gramsToKg(u.weight_gram == null ? null : Number(u.weight_gram));

/** Cari barang ≥ 2 huruf (nama atau kode) di daftar produk kasir; Barang lain yang sudah dipasangkan menjadi saran (DRV-34). */
export async function searchProducts(actor: Actor | null, query: string): Promise<ServiceResult<{ units: ProductUnit[]; allowOther: boolean }>> {
  if (!canCreate(actor)) return fail(403, 'Anda tidak berhak membuat Laporan Bongkaran.');
  const q = query.trim();
  if (q.length < SEARCH_MIN) return { ok: true, data: { units: [], allowOther: false } };
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const found = await db.execute<{ id: number }>(sql`
    select id from (
      select p.id, p.name from hris.pos_products p where p.active and (p.name ilike ${like} or p.sku ilike ${like})
      union
      select p.id, p.name from hris.unloading_items i join hris.pos_products p on p.id = i.linked_product_id
      where p.active and i.product_name ilike ${like}
    ) x order by name limit 25`);
  const ids = found.map((r) => Number(r.id));
  const units = await unitsByIds(db, ids);
  return {
    ok: true,
    data: {
      allowOther: q.length >= OTHER_SEARCH_MIN && ids.length === 0,
      units: units.map((u) => {
        const kg = posKg(u);
        return {
          productId: Number(u.product_id), sku: u.sku, name: u.name, uomId: Number(u.uom_id), uomName: u.uom_name, isBase: !!u.is_base,
          weight: kg ? { kg } : null,
        };
      }),
    },
  };
}

async function suppliers(): Promise<{ id: number; name: string; active: boolean }[]> {
  const rows = await db.execute<{ id: number; name: string; active: boolean }>(sql`select id, name, active from hris.pos_suppliers order by name`);
  return rows.map((r) => ({ id: Number(r.id), name: r.name, active: !!r.active }));
}

// ---- Peserta ----

export type Candidate = { key: string; employeeId: number | null; casualWorkerId: number | null; name: string; detail: string; order: number };

async function candidatesOn(workDate: IsoDate, executor: typeof db | Tx = db): Promise<Candidate[]> {
  const [people, casuals] = await Promise.all([loadPeriodPeople(workDate, workDate, 'ANY'), listCasualWorkers(executor)]);
  return [
    ...people.map((p) => ({ key: `E${p.id}`, employeeId: p.id, casualWorkerId: null, name: p.name, detail: `${p.positionName} · ${p.branchName}`, order: p.id })),
    ...casuals.filter((c) => c.active).map((c) => ({ key: `C${c.id}`, employeeId: null, casualWorkerId: c.id, name: c.name, detail: 'Pekerja lepas', order: 1_000_000_000 + c.id })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** Peserta bongkaran 30 hari terakhir (kunci E/C), paling sering dulu. */
async function frequentKeys(today: IsoDate): Promise<string[]> {
  const rows = await db.execute<{ key: string; n: number }>(sql`
    select coalesce('E' || s.employee_id, 'C' || s.casual_worker_id) as key, count(*)::int as n
    from hris.unloading_shares s join hris.unloading_reports r on r.id = s.report_id and r.version = s.version
    where s.status = 'ACTIVE' and r.work_date >= ${addDays(today, -FREQUENT_DAYS)}::date
    group by 1 order by 2 desc limit 20`);
  return rows.map((r) => r.key);
}

// ---- Laporan Baru ----

export async function unloadingFormScreen(actor: Actor | null, dateInput: string | null, now: Date = new Date()) {
  if (!canCreate(actor)) return null;
  const today = todayWib(now);
  const backdateDays = Number(await settingOn<number>('payroll.unloading_backdate_days', today) ?? 3);
  const workDate = dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput) && dateInput <= today ? dateInput : today;
  const late = workDateCheck(workDate, today, today, backdateDays).late;
  const [list, frequent, supplierList, rate] = await Promise.all([
    candidatesOn(workDate), frequentKeys(today), suppliers(), settingOn<number>('payroll.unloading_rate_per_kg', workDate),
  ]);
  return {
    today, workDate, minDate: addDays(today, -backdateDays), backdateDays, late, direct: !!actor!.fullAccess, rate: rate == null ? null : Number(rate),
    suppliers: supplierList.filter((s) => s.active).map(({ id, name }) => ({ id, name })),
    candidates: list, frequent: frequent.filter((key) => list.some((c) => c.key === key)),
    selfKey: `E${actor!.personId}`, maxPhotos: MAX_PHOTOS, minReason: MIN_REASON, heavyKg: HEAVY_WEIGHT_KG,
    searchMin: SEARCH_MIN, otherSearchMin: OTHER_SEARCH_MIN,
  };
}

export type UnloadingInput = {
  workDate: unknown; supplierId: unknown; lateReason?: unknown; similarConfirmedId?: unknown;
  items: unknown; participants: unknown; photoIds: unknown; noDeliveryNoteReason?: unknown;
  /** Asal barang: 'PO' = dari PO yang ada (poId wajib), selain itu barang datang dulu → Draft PO. */
  source?: unknown; poId?: unknown;
};

export type CheckedItem =
  | { kind: 'PRODUCT'; productId: number; uomId: number; productName: string; uomName: string; quantity: string; weightKg: string; fromKg: string | null; weightReason: string | null; flagged: boolean; poItemId: number | null; poQty: string | null }
  | { kind: 'OTHER'; productName: string; kg: string; reason: string };

export type Checked = {
  workDate: IsoDate; late: boolean; lateReason: string | null; supplierId: number; supplierName: string; rate: number;
  items: CheckedItem[]; participants: Candidate[]; photoIds: string[]; noDeliveryNoteReason: string | null;
  result: ReturnType<typeof computeUnloading>; similar: { id: number; number: string } | null; similarConfirmedId: number | null;
  costBranchId: number | null;
  source: 'PO' | 'ARRIVED_FIRST'; po: { id: number; number: string } | null; poMismatch: boolean;
};

const reasonOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Periksa isian laporan dan hitung (dipakai pratinjau, simpan, dan pengajuan terlambat). `strict` = simpan: foto, laporan serupa,
 * dan cabang penanggung wajib. Pratinjau mengembalikan angka walau foto belum lengkap.
 */
/** Koreksi (L8b, DRV-115): batas tanggal dihitung dari hari laporan dibuat; berat hanya salinan laporan; foto lama boleh dipakai; laporan itu sendiri bukan "serupa". */
export type CorrectionOf = { id: number; createdOn: IsoDate };

export async function checkUnloading(tx: typeof db | Tx, actor: Actor, input: UnloadingInput, now: Date, strict: boolean, correctionOf: CorrectionOf | null = null): Promise<Checked | Fail> {
  const today = todayWib(now);
  const backdateDays = Number(await settingOn<number>('payroll.unloading_backdate_days', today) ?? 3);
  const workDate = String(input.workDate ?? '');
  const dateCheck = workDateCheck(workDate, correctionOf?.createdOn ?? today, today, backdateDays);
  if (dateCheck.problem) return fail(400, dateCheck.problem);
  if (correctionOf && dateCheck.late && !actor.fullAccess) {
    return fail(400, `Tanggal kerja baru paling jauh ${backdateDays} hari sebelum hari laporan dibuat (${longDate(correctionOf.createdOn)}); lebih jauh hanya Pemilik atau GM.`);
  }
  const lateReason = dateCheck.late && !correctionOf ? reasonOf(input.lateReason) : null;
  if (dateCheck.late && strict && !correctionOf && (lateReason ?? '').length < MIN_REASON) {
    return fail(400, `Tanggal kerja lebih dari ${backdateDays} hari lalu: tulis alasannya (paling sedikit ${MIN_REASON} huruf).`);
  }
  const supplier = (await suppliers()).find((s) => s.id === Number(input.supplierId) && s.active);
  if (!supplier) return fail(400, 'Pilih supplier dari daftar supplier kasir.');

  const source: 'PO' | 'ARRIVED_FIRST' = input.source === 'PO' ? 'PO' : 'ARRIVED_FIRST';
  let po: { id: number; number: string } | null = null;
  let poLines: PoLine[] = [];
  if (source === 'PO') {
    const found = await openPurchaseOrder(tx, Number(input.poId));
    if (!found || found.supplierId !== supplier.id) return fail(400, 'Pilih PO supplier ini yang sudah disetujui dan belum selesai diterima.');
    po = { id: found.id, number: found.number };
    poLines = found.lines;
  }

  const rawItems = Array.isArray(input.items) ? input.items as Record<string, unknown>[] : [];
  if (!rawItems.length) return fail(400, 'Isi paling sedikit satu barang.');
  if (rawItems.length > 80) return fail(400, 'Paling banyak 80 baris barang per laporan.');
  const productIds = [...new Set(rawItems.filter((i) => i.productId != null).map((i) => Number(i.productId)))];
  const units = await unitsByIds(tx, productIds);
  const flagPercent = Number(await settingOn<number>('payroll.unloading_weight_flag_percent', today) ?? 10);
  const seen = new Set<string>();
  const items: CheckedItem[] = [];
  for (const raw of rawItems) {
    if (raw.productId == null) {
      const name = reasonOf(raw.name).replace(/\s+/g, ' ');
      const kg = parseDecimal3(raw.kg);
      const reason = reasonOf(raw.reason);
      if (name.length < 2 || name.length > 120) return fail(400, 'Nama Barang lain 2 sampai 120 huruf.');
      if (!kg) return fail(400, `Kg "${name}" harus angka lebih dari 0 (paling banyak 3 angka di belakang koma).`);
      if (reason.length < MIN_REASON) return fail(400, `Alasan Barang lain "${name}" paling sedikit ${MIN_REASON} huruf.`);
      items.push({ kind: 'OTHER', productName: name, kg, reason });
      continue;
    }
    const unit = units.find((u) => Number(u.product_id) === Number(raw.productId) && Number(u.uom_id) === Number(raw.uomId));
    if (!unit) return fail(400, 'Barang atau satuannya tidak ada di daftar produk kasir. Cari ulang barangnya.');
    const key = `${unit.product_id}:${unit.uom_id}`;
    if (seen.has(key)) return fail(400, `${unit.name} (${unit.uom_name}) tercantum dua kali; gabungkan jumlahnya di satu baris.`);
    seen.add(key);
    const quantity = parseDecimal3(raw.quantity);
    if (!quantity) return fail(400, `Jumlah ${unit.name} harus lebih dari 0 (paling banyak 3 angka di belakang koma).`);
    if (!isWholeQuantity(quantity)) return fail(400, `Jumlah ${unit.name} harus bilangan bulat (PO kasir memakai jumlah bulat).`);
    const currentKg = posKg(unit);
    const typed = raw.weightKg == null || raw.weightKg === '' ? null : parseDecimal3(raw.weightKg);
    if (raw.weightKg != null && raw.weightKg !== '' && !typed) return fail(400, `Berat per ${unit.uom_name} ${unit.name} harus kg lebih dari 0 (paling banyak 3 angka di belakang koma).`);
    const weightKg = typed ?? currentKg;
    if (!weightKg) return fail(400, `Isi berat per ${unit.uom_name} untuk ${unit.name}.`);
    const changed = currentKg != null && weightKg !== currentKg;
    const weightReason = changed ? reasonOf(raw.weightReason) : null;
    if (changed && !correctionOf && (weightReason ?? '').length < MIN_REASON) return fail(400, `Berat ${unit.name} diubah: tulis alasannya (paling sedikit ${MIN_REASON} huruf).`);
    items.push({
      kind: 'PRODUCT', productId: Number(unit.product_id), uomId: Number(unit.uom_id), productName: unit.name, uomName: unit.uom_name, quantity, weightKg,
      fromKg: currentKg, weightReason, flagged: changed && weightFlagged(currentKg, weightKg, flagPercent),
      ...poMatch(poLines, Number(unit.product_id), Number(unit.uom_id)),
    });
  }
  const poMismatch = source === 'PO' && poDiffers(items, poLines);

  const rawPeople = Array.isArray(input.participants) ? input.participants as unknown[] : [];
  const keys = rawPeople.map((p) => String(p));
  if (!keys.length) return fail(400, 'Pilih paling sedikit satu peserta.');
  if (new Set(keys).size !== keys.length) return fail(400, 'Satu orang hanya boleh tercantum sekali.');
  const candidates = await candidatesOn(workDate, tx);
  const participants: Candidate[] = [];
  for (const key of keys) {
    const found = candidates.find((c) => c.key === key);
    if (!found) return fail(400, `Peserta tidak aktif pada ${longDate(workDate)} atau tidak dikenal. Pilih ulang pesertanya.`);
    participants.push(found);
  }

  const photoIds = [...new Set(Array.isArray(input.photoIds) ? (input.photoIds as unknown[]).map(String) : [])];
  const noDeliveryNoteReason = reasonOf(input.noDeliveryNoteReason) || null;
  if (strict && !(correctionOf && photoIds.length === 0)) {
    if (photoIds.length < 1 || photoIds.length > MAX_PHOTOS) return fail(400, `Lampirkan 1 sampai ${MAX_PHOTOS} foto ${noDeliveryNoteReason ? 'barang yang dibongkar' : 'surat jalan supplier'}.`);
    if ((await filesUploadedBy(tx as Tx, actor.accountId, photoIds)).length !== photoIds.length) return fail(400, 'Foto tidak ditemukan. Unggah ulang fotonya.');
    if (noDeliveryNoteReason && noDeliveryNoteReason.length < MIN_REASON) return fail(400, `Alasan tidak ada surat jalan paling sedikit ${MIN_REASON} huruf.`);
  }

  const rate = await settingOn<number>('payroll.unloading_rate_per_kg', workDate);
  if (rate == null) return fail(400, `Tarif bongkaran untuk ${longDate(workDate)} belum ada. Hubungi Pemilik atau GM.`);
  let result: ReturnType<typeof computeUnloading>;
  try {
    const itemInputs: ItemInput[] = items.map((i) => (i.kind === 'PRODUCT' ? { kind: 'PRODUCT', quantity: i.quantity, weightKg: i.weightKg } : { kind: 'OTHER', kg: i.kg }));
    const people: ParticipantInput[] = participants.map((p) => ({ key: p.key, name: p.name, order: p.order }));
    result = computeUnloading(itemInputs, people, Number(rate));
  } catch (error) {
    return fail(400, (error as Error).message);
  }
  const [similarRow] = await tx.select({ id: unloadingReports.id, number: unloadingReports.number }).from(unloadingReports)
    .where(and(eq(unloadingReports.workDate, workDate), eq(unloadingReports.supplierId, supplier.id), eq(unloadingReports.totalKg, result.totalKg),
      notInArray(unloadingReports.status, ENDED), correctionOf ? ne(unloadingReports.id, correctionOf.id) : undefined)).orderBy(desc(unloadingReports.id)).limit(1);
  const similarConfirmedId = input.similarConfirmedId ? Number(input.similarConfirmedId) : null;
  if (strict && similarRow && similarConfirmedId !== similarRow.id) {
    return fail(409, `Sudah ada ${similarRow.number} dengan tanggal kerja, supplier, dan total kg yang sama. Periksa lagi; bila memang bongkaran lain, centang "Ini bongkaran lain".`);
  }
  const costBranch = await settingOn<string>('payroll.unloading_cost_branch', workDate);
  if (strict && !costBranch) return fail(400, 'Cabang yang menanggung biaya bongkaran belum diatur. Hubungi Pemilik atau GM.');
  return {
    workDate, late: dateCheck.late, lateReason, supplierId: supplier.id, supplierName: supplier.name, rate: Number(rate), items, participants, photoIds,
    noDeliveryNoteReason, result, similar: similarRow ?? null, similarConfirmedId: similarRow && similarConfirmedId === similarRow.id ? similarRow.id : null,
    costBranchId: costBranch ? Number(costBranch) : null, source, po, poMismatch,
  };
}

// ---- PO kasir (pilihan "Dari PO yang ada", spec 2026-11-06 §1) ----

type PoLine = { id: number; productId: number; uomId: number; remaining: string };

/** PO supplier yang bisa dicocokkan (view `hris.pos_purchase_orders`), dengan sisa jumlah tiap barisnya. */
export async function openPurchaseOrder(executor: typeof db | Tx, poId: number) {
  if (!Number.isInteger(poId) || poId <= 0) return null;
  const [head] = await executor.execute<{ id: number; po_number: string; supplier_id: number }>(sql`
    select id, po_number, supplier_id from hris.pos_purchase_orders where id = ${poId}`);
  if (!head) return null;
  const lines = await executor.execute<{ id: number; product_id: number; uom_id: number; remaining: number }>(sql`
    select id, product_id, uom_id, greatest(qty_ordered - qty_received, 0) as remaining from hris.pos_purchase_order_items where po_id = ${poId} order by id`);
  return {
    id: Number(head.id), number: head.po_number, supplierId: Number(head.supplier_id),
    lines: lines.map((l) => ({ id: Number(l.id), productId: Number(l.product_id), uomId: Number(l.uom_id), remaining: new Big(l.remaining).toFixed(3) })),
  };
}

function poMatch(lines: PoLine[], productId: number, uomId: number): { poItemId: number | null; poQty: string | null } {
  const line = lines.find((l) => l.productId === productId && l.uomId === uomId);
  return line ? { poItemId: line.id, poQty: line.remaining } : { poItemId: null, poQty: null };
}

/** Selisih dengan PO: jumlah beda, barang di luar PO, atau barang PO yang bersisa tapi tidak dibongkar (DRV-39/106). */
export function poDiffers(items: CheckedItem[], lines: PoLine[]): boolean {
  const products = items.filter((i): i is Extract<CheckedItem, { kind: 'PRODUCT' }> => i.kind === 'PRODUCT');
  if (items.some((i) => i.kind === 'OTHER')) return true;
  if (products.some((i) => i.poItemId == null || !new Big(i.quantity).eq(i.poQty ?? '0'))) return true;
  return lines.some((l) => new Big(l.remaining).gt(0) && !products.some((i) => i.poItemId === l.id));
}

/** PO supplier untuk langkah Asal barang di Laporan Baru. */
export async function purchaseOrdersForSupplier(actor: Actor | null, supplierId: number) {
  if (!canCreate(actor)) return fail(403, 'Anda tidak berhak membuat Laporan Bongkaran.');
  const heads = await db.execute<{ id: number; po_number: string; status: string; created_at: string }>(sql`
    select id, po_number, status, created_at::text from hris.pos_purchase_orders where supplier_id = ${supplierId} order by created_at desc limit 30`);
  const orders = [];
  for (const h of heads) {
    const po = await openPurchaseOrder(db, Number(h.id));
    if (!po) continue;
    const units = await unitsByIds(db, [...new Set(po.lines.map((l) => l.productId))]);
    const lines = po.lines.filter((l) => new Big(l.remaining).gt(0)).flatMap((l) => {
      const u = units.find((x) => Number(x.product_id) === l.productId && Number(x.uom_id) === l.uomId);
      if (!u) return [];
      const kg = posKg(u);
      return [{
        poItemId: l.id, remaining: l.remaining, productId: l.productId, uomId: l.uomId, sku: u.sku, name: u.name, uomName: u.uom_name,
        isBase: !!u.is_base, weight: kg ? { kg } : null,
      }];
    });
    if (lines.length) orders.push({ id: po.id, number: po.number, status: h.status, createdAt: h.created_at, lines });
  }
  return { ok: true as const, data: { orders } };
}

function flagsOf(checked: Pick<Checked, 'items' | 'participants' | 'noDeliveryNoteReason' | 'similarConfirmedId' | 'workDate' | 'poMismatch'>, creatorKey: string, createdOn: IsoDate): UnloadingFlag[] {
  const flags: UnloadingFlag[] = [];
  if (checked.participants.some((p) => p.key === creatorKey)) flags.push('CREATOR_JOINED');
  if (checked.items.some((i) => i.kind === 'OTHER')) flags.push('OTHER_ITEM');
  if (checked.items.some((i) => i.kind === 'PRODUCT' && i.flagged)) flags.push('WEIGHT_CHANGED');
  if (checked.noDeliveryNoteReason) flags.push('NO_DELIVERY_NOTE');
  if (checked.workDate !== createdOn) flags.push('BACKDATED');
  if (checked.similarConfirmedId) flags.push('SIMILAR');
  if (checked.poMismatch) flags.push('PO_DIFF');
  return flags;
}

/** Pratinjau langkah Periksa: angka dari server, tanda yang akan menempel, laporan serupa (DRV-L12 langkah 5). */
export async function previewUnloading(actor: Actor | null, input: UnloadingInput, now: Date = new Date()) {
  if (!canCreate(actor)) return fail(403, 'Anda tidak berhak membuat Laporan Bongkaran.');
  const checked = await checkUnloading(db, actor!, input, now, false);
  if ('ok' in checked) return checked;
  const flags = flagsOf({ ...checked, similarConfirmedId: checked.similar && input.similarConfirmedId ? checked.similar.id : null }, `E${actor!.personId}`, todayWib(now));
  if (input.noDeliveryNoteReason && !flags.includes('NO_DELIVERY_NOTE')) flags.push('NO_DELIVERY_NOTE');
  return {
    ok: true as const,
    data: {
      late: checked.late, totalKg: checked.result.totalKg, rate: checked.rate, totalPay: checked.result.totalPay,
      lines: checked.items.map((item, index) => ({ name: item.productName, kg: checked.result.lineKg[index] })),
      shares: checked.participants.map((p) => {
        const share = checked.result.shares.find((s) => s.key === p.key)!;
        return { key: p.key, name: p.name, amount: share.amount, plusOne: share.plusOne };
      }),
      flags: flags.map((f) => UNLOADING_FLAG_LABELS[f]),
      similar: checked.similar,
    },
  };
}

async function nextNumber(tx: Tx, workDate: IsoDate): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.unloading_number'), hashtext(${workDate}))`);
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(unloadingReports).where(eq(unloadingReports.workDate, workDate));
  return reportNumber(workDate, Number(n) + 1);
}

/**
 * Catat berat baru / berubah (DRV-32, 33, 105). Beratnya sendiri disimpan di POS (satu sumber, spec 2026-11-06): dikirim
 * bersama sinkron laporan (`syncUnloadingToPos`) atau langsung dari layar Berat; riwayat HRIS tetap di sini.
 */
export async function saveWeights(tx: Tx, actor: Actor, items: CheckedItem[], reportId: number | null) {
  for (const item of items) {
    if (item.kind !== 'PRODUCT') continue;
    const currentKg = item.fromKg;
    if (currentKg === item.weightKg) continue;
    await tx.insert(unloadingWeightChanges).values({
      productId: item.productId, uomId: item.uomId, productName: item.productName, uomName: item.uomName, fromKg: currentKg, toKg: item.weightKg,
      changePercent: currentKg ? weightChangePercent(currentKg, item.weightKg) : null, reason: currentKg ? item.weightReason : null,
      flagged: item.flagged, reportId, createdByAccountId: actor.accountId,
    });
  }
}

/** Status hari karyawan pada tanggal kerja (DRV-107), dibaca sekali saat laporan Berlaku. */
async function dayStatuses(participants: Candidate[], workDate: IsoDate): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const p of participants) {
    if (p.employeeId == null) continue;
    const status = (await dayStatusesOf(p.employeeId, [workDate])).get(workDate) ?? null;
    out.set(p.key, status);
  }
  return out;
}

/** Status kirim ke POS saat laporan dibuat: tanpa surat jalan (barang datang dulu) menunggu Pemilik/GM (keputusan A). */
export function initialSyncStatus(checked: Pick<Checked, 'source' | 'items' | 'noDeliveryNoteReason'>): 'NONE' | 'WAITING_APPROVAL' | 'PENDING' {
  if (checked.source === 'ARRIVED_FIRST' && !checked.items.some((i) => i.kind === 'PRODUCT')) return 'NONE';
  if (checked.source === 'ARRIVED_FIRST' && checked.noDeliveryNoteReason) return 'WAITING_APPROVAL';
  return 'PENDING';
}

async function insertReport(tx: Tx, actor: Actor, checked: Checked, status: 'ACTIVE' | 'PENDING', requestId: number | null, now: Date): Promise<{ id: number; number: string }> {
  const number = await nextNumber(tx, checked.workDate);
  const active = status === 'ACTIVE';
  const [report] = await tx.insert(unloadingReports).values({
    number, workDate: checked.workDate, supplierId: checked.supplierId, supplierName: checked.supplierName, status, version: 1,
    rate: checked.rate, totalKg: checked.result.totalKg, totalPay: checked.result.totalPay, costBranchId: active ? checked.costBranchId : null,
    lateReason: checked.lateReason, requestId, similarToId: checked.similarConfirmedId, noDeliveryNoteReason: checked.noDeliveryNoteReason,
    createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId, createdOn: todayWib(now),
    activatedAt: active ? now : null, activatedByAccountId: active ? actor.accountId : null,
    source: checked.source, poId: checked.po?.id ?? null, poNumber: checked.po?.number ?? null, poMismatch: checked.poMismatch,
    poSyncStatus: initialSyncStatus(checked),
  }).returning({ id: unloadingReports.id });
  const kind = checked.noDeliveryNoteReason ? 'GOODS' : 'DELIVERY_NOTE';
  await writeVersion(tx, actor, report.id, 1, checked, status, null, true, checked.photoIds.map((fileId) => ({ fileId, kind })));
  return { id: report.id, number };
}

/** Tulis satu versi laporan: baris versi, barang, (berat bila `applyWeights`), Buku Upah, foto. Dipakai buat dan koreksi (DRV-115). */
export async function writeVersion(
  tx: Tx, actor: Actor, reportId: number, version: number, checked: Checked, status: 'ACTIVE' | 'PENDING', reason: string | null, applyWeights: boolean,
  photos: { fileId: string; kind: string }[],
) {
  await tx.insert(unloadingReportVersions).values({
    reportId, version, workDate: checked.workDate, supplierId: checked.supplierId, supplierName: checked.supplierName,
    rate: checked.rate, totalKg: checked.result.totalKg, totalPay: checked.result.totalPay, reason, createdByAccountId: actor.accountId,
  });
  await tx.insert(unloadingItems).values(checked.items.map((item, index) => (item.kind === 'PRODUCT'
    ? {
      reportId, version, productId: item.productId, uomId: item.uomId, productName: item.productName, uomName: item.uomName,
      quantity: item.quantity, weightKg: item.weightKg, lineKg: checked.result.lineKg[index], weightFlagged: item.flagged,
      poItemId: item.poItemId, poQty: item.poQty,
    }
    : { reportId, version, productName: item.productName, lineKg: checked.result.lineKg[index], otherReason: item.reason })));
  if (applyWeights) await saveWeights(tx, actor, checked.items, reportId);
  const statuses = status === 'ACTIVE' ? await dayStatuses(checked.participants, checked.workDate) : new Map<string, string | null>();
  await tx.insert(unloadingShares).values(checked.participants.map((p) => {
    const share = checked.result.shares.find((s) => s.key === p.key)!;
    const dayStatus = statuses.get(p.key) ?? null;
    return {
      reportId, version, employeeId: p.employeeId, casualWorkerId: p.casualWorkerId, name: p.name, amount: share.amount, plusOne: share.plusOne,
      dayStatus, needsLook: needsLook(dayStatus), status,
    };
  }));
  if (photos.length) await tx.insert(unloadingPhotos).values(photos.map((p) => ({ reportId, version, fileId: p.fileId, kind: p.kind })));
}

export async function announceActive(tx: Tx, report: { id: number; number: string; totalPay: number; workDate: IsoDate; supplierName: string }, actorAccountId: number) {
  await notify(tx, await accountsWith(['unloading.pay']), {
    kind: 'unloading.active',
    title: `Laporan Bongkaran ${report.number} siap dibayar: ${rupiah(report.totalPay)}`,
    body: `${report.supplierName}, ${longDate(report.workDate)}. Dibayar tunai hari ini.`,
    link: reportLink(report.id), entity: 'unloading_report', entityId: report.id,
  }, actorAccountId);
}

async function announceWeights(tx: Tx, checked: Checked, actor: Actor, announce: ChangeAnnounce, reportId: number, number: string) {
  const flagged = checked.items.filter((i): i is Extract<CheckedItem, { kind: 'PRODUCT' }> => i.kind === 'PRODUCT' && i.flagged);
  if (!flagged.length) return;
  await announce(tx, actor.accountId, {
    what: `mengubah berat per satuan lebih dari ambang di ${number}: ${flagged.map((i) => `${i.productName} ${kgText(i.fromKg ?? '0')} → ${kgText(i.weightKg)} kg per ${i.uomName}`).join('; ')}`,
    link: `${LINK}/berat?tab=CHANGED`, entity: 'unloading_report', entityId: reportId,
  });
}

/** Laporan bertanggal kerja lebih lama dari batas, oleh bukan Pemilik/GM = pengajuan "Laporan Bongkaran terlambat" (DRV-104). */
export async function unloadingNeedsApproval(actor: Actor | null, workDate: unknown, now: Date = new Date()): Promise<boolean> {
  if (!actor || actor.fullAccess) return false;
  const today = todayWib(now);
  const backdateDays = Number(await settingOn<number>('payroll.unloading_backdate_days', today) ?? 3);
  return workDateCheck(String(workDate ?? ''), today, today, backdateDays).late;
}

/** Simpan Laporan Bongkaran langsung Berlaku (DRV-101), satu transaksi (DRV-31). */
export async function createUnloading(actor: Actor | null, input: UnloadingInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number; number: string; message: string }>> {
  if (!canCreate(actor)) return fail(403, 'Anda tidak berhak membuat Laporan Bongkaran.');
  if (await unloadingNeedsApproval(actor, input.workDate, now)) return fail(400, 'Laporan terlambat dikirim sebagai pengajuan.');
  return db.transaction(async (tx) => {
    const checked = await checkUnloading(tx, actor!, input, now, true);
    if ('ok' in checked) return checked;
    const saved = await insertReport(tx, actor!, checked, 'ACTIVE', null, now);
    await announceActive(tx, { id: saved.id, number: saved.number, totalPay: checked.result.totalPay, workDate: checked.workDate, supplierName: checked.supplierName }, actor!.accountId);
    await announceWeights(tx, checked, actor!, announce, saved.id, saved.number);
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'unloading_report', entityId: saved.id, action: 'unloading_report.create', before: null,
      after: { number: saved.number, workDate: checked.workDate, totalKg: checked.result.totalKg, totalPay: checked.result.totalPay, participants: checked.participants.length },
      reason: checked.lateReason ?? undefined,
    });
    return {
      ok: true as const,
      data: { id: saved.id, number: saved.number, message: `Laporan ${saved.number} tersimpan. Finance diberi tahu untuk membayar ${rupiah(checked.result.totalPay)}.` },
    };
  });
}

// ---- Laporan terlambat (pengajuan unloading_late, DRV-104) ----

async function reportByRequest(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select().from(unloadingReports).where(eq(unloadingReports.requestId, requestId));
  return row ?? null;
}

export async function sharesOf(executor: typeof db | Tx, reportId: number, version: number) {
  return executor.select().from(unloadingShares).where(and(eq(unloadingShares.reportId, reportId), eq(unloadingShares.version, version))).orderBy(asc(unloadingShares.name), asc(unloadingShares.id));
}

export async function itemsOf(executor: typeof db | Tx, reportId: number, version: number) {
  return executor.select().from(unloadingItems).where(and(eq(unloadingItems.reportId, reportId), eq(unloadingItems.version, version))).orderBy(asc(unloadingItems.id));
}

export function unloadingLateHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM menyimpan laporan terlambat langsung.');
      const now = new Date();
      const checked = await checkUnloading(tx, actor, input as UnloadingInput, now, true);
      if ('ok' in checked) return checked;
      if (!checked.late) return fail(400, 'Laporan ini tidak terlambat; simpan biasa.');
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `${checked.supplierName}, ${longDate(checked.workDate)}: ${kgText(checked.result.totalKg)} kg, ${rupiah(checked.result.totalPay)} untuk ${checked.participants.length} orang`,
          dedupeKey: null,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            const saved = await insertReport(saveTx, actor, checked, 'PENDING', requestId, now);
            await announceWeights(saveTx, checked, actor, announce, saved.id, saved.number);
            await recordAudit(saveTx, {
              actorAccountId: actor.accountId, entity: 'unloading_report', entityId: saved.id, action: 'unloading_report.create_late', before: null,
              after: { number: saved.number, workDate: checked.workDate, totalPay: checked.result.totalPay }, reason: checked.lateReason ?? undefined,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const report = await reportByRequest(tx, requestId);
      if (!report || report.status !== 'PENDING') return fail(404, 'Laporan terlambat tidak ditemukan.');
      if (report.createdByAccountId === actorAccountId) return fail(403, 'Pembuat laporan tidak memutuskan laporannya sendiri.');
      const shares = await sharesOf(tx, report.id, report.version);
      const accounts = await activeHrisAccounts(shares.flatMap((s) => (s.employeeId ? [s.employeeId] : [])));
      if ([...accounts.values()].includes(actorAccountId)) return fail(403, 'Peserta laporan ini tidak memutuskannya; minta Pemilik atau GM lain.');
      const rate = await settingOn<number>('payroll.unloading_rate_per_kg', report.workDate);
      if (rate == null || Number(rate) !== report.rate) return fail(409, 'Tarif tanggal kerja itu berubah sejak laporan dikirim. Tolak, lalu minta laporan dikirim ulang.');
      const costBranch = await settingOn<string>('payroll.unloading_cost_branch', report.workDate);
      if (!costBranch) return fail(400, 'Cabang yang menanggung biaya bongkaran belum diatur.');
      const now = new Date();
      for (const share of shares) {
        const status = share.employeeId ? (await dayStatusesOf(share.employeeId, [report.workDate])).get(report.workDate) ?? null : null;
        await tx.update(unloadingShares).set({ status: 'ACTIVE', dayStatus: status, needsLook: needsLook(status) }).where(eq(unloadingShares.id, share.id));
      }
      await tx.update(unloadingReports).set({ status: 'ACTIVE', costBranchId: Number(costBranch), activatedAt: now, activatedByAccountId: actorAccountId })
        .where(eq(unloadingReports.id, report.id));
      await announceActive(tx, { id: report.id, number: report.number, totalPay: report.totalPay, workDate: report.workDate, supplierName: report.supplierName }, actorAccountId);
      await notify(tx, [report.createdByAccountId], {
        kind: 'unloading.late_approved', title: `Laporan Bongkaran terlambat ${report.number} disetujui dan siap dibayar.`,
        link: reportLink(report.id), entity: 'unloading_report', entityId: report.id,
      }, actorAccountId);
      await announce(tx, actorAccountId, { what: `menyetujui Laporan Bongkaran terlambat ${report.number} (${rupiah(report.totalPay)})`, link: reportLink(report.id), entity: 'unloading_report', entityId: report.id });
      return { ok: true as const, effect: `${rupiah(report.totalPay)} untuk ${shares.length} orang menjadi siap dibayar. Finance diberi tahu.` };
    },
    async close(tx, actorAccountId, requestId, reason) {
      const report = await reportByRequest(tx, requestId);
      if (!report || report.status !== 'PENDING') return;
      const withdrawn = actorAccountId === report.createdByAccountId;
      await tx.update(unloadingReports).set({ status: withdrawn ? 'WITHDRAWN' : 'REJECTED' }).where(and(eq(unloadingReports.id, report.id), eq(unloadingReports.status, 'PENDING')));
      await tx.update(unloadingShares).set({ status: 'CANCELLED' }).where(and(eq(unloadingShares.reportId, report.id), eq(unloadingShares.status, 'PENDING')));
      if (!withdrawn) {
        await notify(tx, [report.createdByAccountId], {
          kind: 'unloading.late_rejected', title: `Laporan Bongkaran terlambat ${report.number} ditolak; tidak dibayar.`,
          ...(reason ? { body: `Alasan: ${reason}` } : {}), link: reportLink(report.id), entity: 'unloading_report', entityId: report.id,
        }, actorAccountId);
      }
    },
    async effectPreview(requestId) {
      const report = await reportByRequest(db, requestId);
      if (!report) return 'Laporan ini akan berlaku.';
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(unloadingShares).where(and(eq(unloadingShares.reportId, report.id), eq(unloadingShares.version, report.version)));
      return `${rupiah(report.totalPay)} untuk ${n} orang menjadi siap dibayar (tarif ${rupiah(report.rate)}/kg tanggal ${longDate(report.workDate)}). Finance diberi tahu.`;
    },
    async describe(requestId) {
      const report = await reportByRequest(db, requestId);
      if (!report) return [];
      const [shares, items, others] = await Promise.all([
        sharesOf(db, report.id, report.version), itemsOf(db, report.id, report.version),
        db.select({ number: unloadingReports.number, totalKg: unloadingReports.totalKg, status: unloadingReports.status }).from(unloadingReports)
          .where(and(eq(unloadingReports.workDate, report.workDate), ne(unloadingReports.id, report.id))),
      ]);
      const lateDays = Math.round((Date.parse(report.createdOn) - Date.parse(report.workDate)) / 86_400_000);
      return [
        { label: 'Laporan', before: null, after: `${report.number} · ${report.supplierName}` },
        { label: 'Tanggal kerja', before: null, after: `${longDate(report.workDate)} (dibuat ${lateDays} hari sesudahnya)` },
        { label: 'Alasan terlambat', before: null, after: report.lateReason ?? '-' },
        { label: 'Barang', before: null, after: items.map((i) => `${i.productName}${i.quantity ? ` ${kgText(i.quantity)} ${i.uomName} × ${kgText(i.weightKg!)} kg` : ' (Barang lain)'} = ${kgText(i.lineKg)} kg`).join('; ') },
        { label: 'Total', before: null, after: `${kgText(report.totalKg)} kg × ${rupiah(report.rate)} = ${rupiah(report.totalPay)}` },
        { label: 'Peserta', before: null, after: shares.map((s) => `${s.name} ${rupiah(s.amount)}`).join(', ') },
        { label: 'Laporan lain di tanggal itu', before: null, after: others.length ? others.map((o) => `${o.number} (${kgText(o.totalKg)} kg, ${UNLOADING_STATUS_LABELS[o.status as UnloadingStatus]})`).join(', ') : 'Tidak ada' },
        { label: 'Rincian lengkap', before: null, after: reportLink(report.id) },
      ];
    },
    async resubmitValues() {
      return null;
    },
  };
}

// ---- Daftar, rincian ----

export type UnloadingTab = 'UNPAID' | 'PENDING' | 'ALL' | 'OTHER' | 'OVERPAY' | 'PEOPLE';
export const UNLOADING_TAB_LABELS: Record<UnloadingTab, string> = {
  UNPAID: 'Belum dibayar', PENDING: 'Menunggu persetujuan', ALL: 'Semua', OTHER: 'Barang lain', OVERPAY: 'Lebih bayar', PEOPLE: 'Per orang',
};

type ReportRow = typeof unloadingReports.$inferSelect;

/** Tanda laporan dari isinya (versi berjalan). */
export async function reportFlags(reports: ReportRow[]): Promise<Map<number, UnloadingFlag[]>> {
  const out = new Map<number, UnloadingFlag[]>();
  if (!reports.length) return out;
  const ids = reports.map((r) => r.id);
  const [items, shares] = await Promise.all([
    db.select({ reportId: unloadingItems.reportId, version: unloadingItems.version, productId: unloadingItems.productId, flagged: unloadingItems.weightFlagged })
      .from(unloadingItems).where(inArray(unloadingItems.reportId, ids)),
    db.select({ reportId: unloadingShares.reportId, version: unloadingShares.version, employeeId: unloadingShares.employeeId }).from(unloadingShares)
      .where(inArray(unloadingShares.reportId, ids)),
  ]);
  for (const r of reports) {
    const flags: UnloadingFlag[] = [];
    const mine = items.filter((i) => i.reportId === r.id && i.version === r.version);
    if (shares.some((s) => s.reportId === r.id && s.version === r.version && s.employeeId === r.createdByEmployeeId)) flags.push('CREATOR_JOINED');
    if (mine.some((i) => i.productId == null)) flags.push('OTHER_ITEM');
    if (mine.some((i) => i.flagged)) flags.push('WEIGHT_CHANGED');
    if (r.noDeliveryNoteReason) flags.push('NO_DELIVERY_NOTE');
    if (r.workDate !== r.createdOn) flags.push('BACKDATED');
    if (r.similarToId) flags.push('SIMILAR');
    if (r.version > 1) flags.push('CORRECTED');
    if (r.question && !r.answeredAt) flags.push('ASKED');
    if (r.poMismatch) flags.push('PO_DIFF');
    out.set(r.id, flags);
  }
  return out;
}

export async function unloadingListScreen(actor: Actor | null, input: { tab?: string | null; from?: string | null; to?: string | null; q?: string | null }, now: Date = new Date()) {
  if (!canViewUnloading(actor)) return null;
  const today = todayWib(now);
  const tab: UnloadingTab = input.tab === 'PENDING' || input.tab === 'ALL' || input.tab === 'OTHER' || input.tab === 'OVERPAY' || input.tab === 'PEOPLE' ? input.tab : 'UNPAID';
  const periodStart = periodStartOf(today);
  const from = input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from) ? input.from : periodStart;
  const to = input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to) ? input.to : periodEndOf(periodStart);
  const q = (input.q ?? '').trim().toLowerCase();
  const [unpaid, pending, todays] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${unloadingReports.totalPay}), 0)::int`, oldest: sql<string | null>`min(${unloadingReports.workDate})::text` })
      .from(unloadingReports).where(eq(unloadingReports.status, 'ACTIVE')),
    db.select({ n: sql<number>`count(*)::int` }).from(unloadingReports).where(eq(unloadingReports.status, 'PENDING')),
    db.select({ n: sql<number>`count(*)::int`, kg: sql<string>`coalesce(sum(${unloadingReports.totalKg}), 0)::text`, sum: sql<number>`coalesce(sum(${unloadingReports.totalPay}), 0)::int` })
      .from(unloadingReports).where(and(eq(unloadingReports.workDate, today), notInArray(unloadingReports.status, ENDED))),
  ]);
  const head = {
    today: { count: Number(todays[0].n), kg: todays[0].kg, pay: Number(todays[0].sum) },
    unpaid: { count: Number(unpaid[0].n), pay: Number(unpaid[0].sum), oldest: unpaid[0].oldest },
    pending: Number(pending[0].n),
  };
  const base = { tab, from, to, q: input.q ?? '', head, canCreate: canCreate(actor), canLinkOther: hasAction(actor, 'unloading.other_item_link') };
  if (tab === 'OTHER') return { ...base, rows: [], other: await otherItems(from, to) };
  if (tab === 'OVERPAY' || tab === 'PEOPLE') return { ...base, rows: [], other: null };
  const where = tab === 'UNPAID' ? eq(unloadingReports.status, 'ACTIVE')
    : tab === 'PENDING' ? eq(unloadingReports.status, 'PENDING')
      : and(gte(unloadingReports.workDate, from), lte(unloadingReports.workDate, to));
  const reports = await db.select().from(unloadingReports).where(where).orderBy(tab === 'UNPAID' ? asc(unloadingReports.workDate) : desc(unloadingReports.workDate), desc(unloadingReports.id));
  const filtered = q ? reports.filter((r) => r.number.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q)) : reports;
  const [flags, names, counts] = await Promise.all([
    reportFlags(filtered), accountNames(),
    filtered.length
      ? db.select({ reportId: unloadingShares.reportId, version: unloadingShares.version, n: sql<number>`count(*)::int` }).from(unloadingShares)
        .where(inArray(unloadingShares.reportId, filtered.map((r) => r.id))).groupBy(unloadingShares.reportId, unloadingShares.version)
      : Promise.resolve([]),
  ]);
  return {
    ...base,
    other: null,
    rows: filtered.map((r) => ({
      id: r.id, number: r.number, workDate: r.workDate, supplierName: r.supplierName, totalKg: r.totalKg, totalPay: r.totalPay,
      participants: Number(counts.find((c) => c.reportId === r.id && c.version === r.version)?.n ?? 0),
      status: r.status as UnloadingStatus, statusLabel: UNLOADING_STATUS_LABELS[r.status as UnloadingStatus],
      flags: (flags.get(r.id) ?? []).map((f) => UNLOADING_FLAG_LABELS[f]), createdBy: names.get(r.createdByAccountId) ?? '-', requestId: r.requestId,
    })),
  };
}

async function otherItems(from: IsoDate, to: IsoDate) {
  const rows = await db.select({ item: unloadingItems, report: unloadingReports }).from(unloadingItems)
    .innerJoin(unloadingReports, and(eq(unloadingReports.id, unloadingItems.reportId), eq(unloadingReports.version, unloadingItems.version)))
    .where(and(isNull(unloadingItems.productId), gte(unloadingReports.workDate, from), lte(unloadingReports.workDate, to), notInArray(unloadingReports.status, ENDED)))
    .orderBy(desc(unloadingReports.workDate), desc(unloadingItems.id));
  const [names, totals] = await Promise.all([
    accountNames(),
    db.select({ kg: sql<string>`coalesce(sum(${unloadingReports.totalKg}), 0)::text` }).from(unloadingReports)
      .where(and(gte(unloadingReports.workDate, from), lte(unloadingReports.workDate, to), notInArray(unloadingReports.status, ENDED))),
  ]);
  const otherKg = rows.reduce((sum, r) => sum.plus(r.item.lineKg), new Big(0));
  const allKg = new Big(totals[0].kg);
  const byCreator = new Map<string, { lines: number; kg: Big }>();
  for (const r of rows) {
    const who = names.get(r.report.createdByAccountId) ?? '-';
    const cur = byCreator.get(who) ?? { lines: 0, kg: new Big(0) };
    byCreator.set(who, { lines: cur.lines + 1, kg: cur.kg.plus(r.item.lineKg) });
  }
  return {
    reports: new Set(rows.map((r) => r.report.id)).size, lines: rows.length, kg: otherKg.toFixed(3),
    percent: allKg.gt(0) ? otherKg.div(allKg).times(100).round(1).toFixed(1) : '0.0',
    byCreator: [...byCreator].map(([name, v]) => ({ name, lines: v.lines, kg: v.kg.toFixed(3) })),
    rows: rows.map((r) => ({
      itemId: r.item.id, reportId: r.report.id, number: r.report.number, workDate: r.report.workDate, name: r.item.productName, kg: r.item.lineKg,
      reason: r.item.otherReason ?? '', createdBy: names.get(r.report.createdByAccountId) ?? '-', linkedName: r.item.linkedProductName,
    })),
  };
}

export async function unloadingDetailScreen(actor: Actor | null, id: number) {
  if (!canViewUnloading(actor)) return null;
  const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, id));
  if (!report) return null;
  const [items, shares, photos, versions, flags, names, org] = await Promise.all([
    itemsOf(db, report.id, report.version), sharesOf(db, report.id, report.version),
    db.select().from(unloadingPhotos).where(and(eq(unloadingPhotos.reportId, report.id), eq(unloadingPhotos.version, report.version))).orderBy(asc(unloadingPhotos.id)),
    db.select().from(unloadingReportVersions).where(eq(unloadingReportVersions.reportId, report.id)).orderBy(asc(unloadingReportVersions.version)),
    reportFlags([report]), accountNames(), getOrgLookup(),
  ]);
  const flagList = flags.get(report.id) ?? [];
  const similar = report.similarToId ? (await db.select({ number: unloadingReports.number }).from(unloadingReports).where(eq(unloadingReports.id, report.similarToId)))[0] : null;
  const explain: Record<UnloadingFlag, string> = {
    CREATOR_JOINED: 'Pembuat laporan juga tercantum sebagai peserta.',
    OTHER_ITEM: 'Ada barang yang tidak ada di daftar produk kasir; kg-nya diketik.',
    WEIGHT_CHANGED: 'Ada berat per satuan yang diubah lebih dari ambang di laporan ini.',
    NO_DELIVERY_NOTE: `Supplier tidak memberi surat jalan; diganti foto barang. Alasan: ${report.noDeliveryNoteReason ?? '-'}`,
    BACKDATED: `Tanggal kerja ${longDate(report.workDate)}, dibuat ${longDate(report.createdOn)}.`,
    SIMILAR: `Dikonfirmasi bongkaran lain, bukan dobel dari ${similar?.number ?? '-'}.`,
    CORRECTED: `Dikoreksi ${report.version - 1} kali.`,
    ASKED: 'Ditanyakan Finance sebelum membayar.',
    PO_DIFF: `Jumlah dibongkar berbeda dengan ${report.poNumber ?? 'PO'} (lihat kolom Selisih).`,
  };
  return {
    id: report.id, number: report.number, status: report.status as UnloadingStatus, statusLabel: UNLOADING_STATUS_LABELS[report.status as UnloadingStatus],
    workDate: report.workDate, supplierName: report.supplierName, createdBy: names.get(report.createdByAccountId) ?? '-', createdAt: report.createdAt.toISOString(),
    rate: report.rate, totalKg: report.totalKg, totalPay: report.totalPay, version: report.version, requestId: report.requestId, lateReason: report.lateReason,
    costBranch: report.costBranchId ? org.branches.find((b) => b.id === report.costBranchId)?.name ?? '-' : null,
    flags: flagList.map((f) => ({ label: UNLOADING_FLAG_LABELS[f], explain: explain[f] })),
    items: items.map((i) => ({
      id: i.id, name: i.productName, uomName: i.uomName, quantity: i.quantity, weightKg: i.weightKg, lineKg: i.lineKg, other: i.productId == null,
      otherReason: i.otherReason, linkedName: i.linkedProductName, weightFlagged: i.weightFlagged,
      poQty: report.source === 'PO' ? i.poQty : null, poDiff: report.source === 'PO' && i.quantity ? poDifference(i.quantity, i.poQty) : null,
    })),
    po: {
      source: report.source as 'PO' | 'ARRIVED_FIRST', number: report.poNumber, syncStatus: report.poSyncStatus as PoSyncStatus,
      syncLabel: PO_SYNC_LABELS[report.poSyncStatus as PoSyncStatus], error: report.poSyncError,
      synced: report.poSyncedAt ? { at: report.poSyncedAt.toISOString(), version: report.poSyncedVersion } : null,
      stale: report.poSyncedVersion != null && report.poSyncedVersion !== report.version,
      canSend: (hasAction(actor, 'unloading.create') || !!actor!.fullAccess) && ['PENDING', 'FAILED'].includes(report.poSyncStatus) && ['ACTIVE', 'PAID', 'CANCELLED'].includes(report.status),
      canApproveDraft: !!actor!.fullAccess && report.poSyncStatus === 'WAITING_APPROVAL' && report.createdByAccountId !== actor!.accountId && report.status !== 'CANCELLED',
      draftApprovedBy: report.draftApprovedAt ? names.get(report.draftApprovedByAccountId ?? 0) ?? '-' : null,
    },
    shares: shares.map((s) => ({
      id: s.id, name: s.name, casual: s.casualWorkerId != null, amount: s.amount, plusOne: s.plusOne, status: s.status,
      look: s.needsLook ? { status: DAY_STATUS_LABELS[s.dayStatus ?? ''] ?? s.dayStatus, done: !!s.lookedAt } : null,
    })),
    photos: photos.map((p) => ({ id: p.id, kind: p.kind })),
    history: [
      ...versions.map((v) => ({
        at: v.createdAt.toISOString(), text: v.version === 1 ? `Dibuat ${names.get(v.createdByAccountId) ?? '-'}` : `Dikoreksi ${names.get(v.createdByAccountId) ?? '-'}: ${v.reason}`,
      })),
      ...(report.activatedAt && report.requestId ? [{ at: report.activatedAt.toISOString(), text: `Disetujui ${names.get(report.activatedByAccountId ?? 0) ?? '-'} (laporan terlambat)` }] : []),
    ],
  };
}

/** Foto laporan hanya untuk yang boleh melihat Laporan Bongkaran (spec v3 §3.3); selain itu 404. */
export async function openUnloadingPhoto(actor: Actor | null, photoId: number): Promise<string | null> {
  if (!canViewUnloading(actor)) return null;
  const [row] = await db.select({ fileId: unloadingPhotos.fileId }).from(unloadingPhotos).where(eq(unloadingPhotos.id, photoId));
  return row?.fileId ?? null;
}

// ---- Berat per Satuan (DRV-L14) ----

export type WeightTab = 'ALL' | 'CHANGED';

export async function weightsScreen(actor: Actor | null, tabInput: string | null) {
  if (!canViewUnloading(actor)) return null;
  const tab: WeightTab = tabInput === 'CHANGED' ? 'CHANGED' : 'ALL';
  const [changes, names, used] = await Promise.all([
    db.select().from(unloadingWeightChanges).orderBy(desc(unloadingWeightChanges.createdAt), desc(unloadingWeightChanges.id)),
    accountNames(),
    db.execute<{ product_id: number; uom_id: number; n: number }>(sql`
      select i.product_id, i.uom_id, count(distinct i.report_id)::int as n from hris.unloading_items i
      join hris.unloading_reports r on r.id = i.report_id and r.version = i.version
      where i.product_id is not null and r.status not in ('REJECTED', 'WITHDRAWN', 'CANCELLED') group by 1, 2`),
  ]);
  const reportNumbers = new Map((await db.select({ id: unloadingReports.id, number: unloadingReports.number }).from(unloadingReports)
    .where(inArray(unloadingReports.id, [...new Set(changes.flatMap((c) => (c.reportId ? [c.reportId] : [])))].concat([-1])))).map((r) => [r.id, r.number]));
  const label = (c: typeof changes[number]) => ({
    id: c.id, productName: c.productName, uomName: c.uomName, fromKg: c.fromKg, toKg: c.toKg, percent: c.changePercent, reason: c.reason,
    by: names.get(c.createdByAccountId) ?? '-', at: c.createdAt.toISOString(), report: c.reportId ? { id: c.reportId, number: reportNumbers.get(c.reportId) ?? '-' } : null,
    flagged: c.flagged, reviewed: c.reviewedAt ? { by: names.get(c.reviewedByAccountId ?? 0) ?? '-', note: c.reviewNote } : null,
  });
  return {
    tab, canEdit: canCreate(actor), canReview: hasAction(actor, 'unloading.weight_review'),
    changedCount: changes.filter((c) => c.flagged && !c.reviewedAt).length,
    // Berat dibaca dari Master Produk kasir (satu sumber, spec 2026-11-06) untuk barang yang pernah dibongkar atau berriwayat.
    weights: await posWeightRows(changes, used, (history) => {
      const last = history[0];
      return { by: last ? names.get(last.createdByAccountId) ?? '-' : 'Master Produk', on: last ? wibDate(last.createdAt) : null, history: history.map(label) };
    }),
    changed: changes.filter((c) => c.flagged && !c.reviewedAt).map(label),
  };
}

/** Ubah berat di luar laporan (Berat per Satuan): berlaku untuk laporan sesudahnya; alasan wajib (DRV-33, 105). */
const wibDate = (at: Date) => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

async function posWeightRows<T extends object>(
  changes: (typeof unloadingWeightChanges.$inferSelect)[], used: { product_id: number; uom_id: number; n: number }[],
  extra: (history: (typeof unloadingWeightChanges.$inferSelect)[]) => T,
) {
  const keys = new Map<string, { productId: number; uomId: number }>();
  for (const c of changes) keys.set(`${c.productId}:${c.uomId}`, { productId: c.productId, uomId: c.uomId });
  for (const u of used) keys.set(`${u.product_id}:${u.uom_id}`, { productId: Number(u.product_id), uomId: Number(u.uom_id) });
  const units = await unitsByIds(db, [...new Set([...keys.values()].map((k) => k.productId))]);
  return [...keys.values()].flatMap((k) => {
    const unit = units.find((u) => Number(u.product_id) === k.productId && Number(u.uom_id) === k.uomId);
    if (!unit) return [];
    const history = changes.filter((c) => c.productId === k.productId && c.uomId === k.uomId);
    return [{
      productId: k.productId, uomId: k.uomId, productName: unit.name, uomName: unit.uom_name, kg: posKg(unit),
      used: Number(used.find((u) => Number(u.product_id) === k.productId && Number(u.uom_id) === k.uomId)?.n ?? 0),
      ...extra(history),
    }];
  }).sort((a, b) => a.productName.localeCompare(b.productName, 'id'));
}

export async function changeWeight(actor: Actor | null, input: { productId: unknown; uomId: unknown; weightKg: unknown; reason: unknown }, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!canCreate(actor)) return fail(403, 'Anda tidak berhak mengubah berat per satuan.');
  const weightKg = parseDecimal3(input.weightKg);
  if (!weightKg) return fail(400, 'Berat harus kg lebih dari 0 (paling banyak 3 angka di belakang koma).');
  const reason = reasonOf(input.reason);
  if (reason.length < MIN_REASON) return fail(400, `Alasan paling sedikit ${MIN_REASON} huruf.`);
  const [unit] = await unitsByIds(db, [Number(input.productId)]).then((rows) => rows.filter((u) => Number(u.uom_id) === Number(input.uomId)));
  if (!unit) return fail(404, 'Produk atau satuan tidak ada di daftar kasir.');
  const currentKg = posKg(unit);
  if (currentKg === weightKg) return fail(400, 'Beratnya sama dengan yang berlaku.');
  // Berat satu sumber = POS: simpan dulu di kasir; riwayat HRIS ditulis sesudah kasir menerima (spec 2026-11-06 §4.2).
  const gram = kgToGrams(weightKg);
  const sent = await callBackofficeInternal('/api/internal/hris/product-weights', {
    productId: Number(unit.product_id), uomId: Number(unit.uom_id), gram, expectedGram: currentKg ? kgToGrams(currentKg) : null,
  }, `weight:${unit.product_id}:${unit.uom_id}:${gram}:${now.getTime()}`);
  if (!sent.ok) return fail(409, `Berat belum tersimpan di kasir: ${sent.error}`);
  return db.transaction(async (tx) => {
    const flagPercent = Number(await settingOn<number>('payroll.unloading_weight_flag_percent', todayWib(now)) ?? 10);
    const item: CheckedItem = {
      kind: 'PRODUCT', productId: Number(unit.product_id), uomId: Number(unit.uom_id), productName: unit.name, uomName: unit.uom_name, quantity: '1.000', weightKg,
      fromKg: currentKg, weightReason: reason, flagged: weightFlagged(currentKg, weightKg, flagPercent), poItemId: null, poQty: null,
    };
    await saveWeights(tx, actor!, [item], null);
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_weight', entityId: Number(unit.product_id), action: 'unloading_weight.change', before: { kg: currentKg }, after: { kg: weightKg, uomId: unit.uom_id }, reason });
    if (item.flagged) {
      await announce(tx, actor!.accountId, { what: `mengubah berat ${unit.name} ${kgText(currentKg ?? '0')} → ${kgText(weightKg)} kg per ${unit.uom_name}`, link: `${LINK}/berat?tab=CHANGED`, entity: 'unloading_weight', entityId: Number(unit.product_id) });
    }
    return { ok: true as const, data: {} };
  });
}

export async function reviewWeightChange(actor: Actor | null, id: number, note: unknown): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.weight_review')) return fail(403, 'Hanya Pemilik atau GM yang menandai Sudah dilihat.');
  const text = reasonOf(note).slice(0, 500) || null;
  const done = await db.update(unloadingWeightChanges).set({ reviewedAt: new Date(), reviewedByAccountId: actor!.accountId, reviewNote: text })
    .where(and(eq(unloadingWeightChanges.id, id), eq(unloadingWeightChanges.flagged, true), isNull(unloadingWeightChanges.reviewedAt))).returning({ id: unloadingWeightChanges.id });
  return done.length ? { ok: true, data: {} } : fail(404, 'Perubahan berat yang belum dilihat tidak ditemukan.');
}

// ---- Barang lain: Pasangkan ke produk (DRV-L15) ----

export async function linkOtherItem(actor: Actor | null, itemId: number, productId: number | null): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.other_item_link')) return fail(403, 'Hanya Pemilik atau GM yang memasangkan Barang lain.');
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(unloadingItems).where(and(eq(unloadingItems.id, itemId), isNull(unloadingItems.productId)));
    if (!item) return fail(404, 'Baris Barang lain tidak ditemukan.');
    let name: string | null = null;
    if (productId != null) {
      const [product] = await tx.execute<{ name: string }>(sql`select name from hris.pos_products where id = ${productId}`);
      if (!product) return fail(404, 'Produk tidak ada di daftar kasir.');
      name = product.name;
    }
    await tx.update(unloadingItems).set({ linkedProductId: productId, linkedProductName: name, linkedByAccountId: actor!.accountId, linkedAt: productId ? new Date() : null })
      .where(eq(unloadingItems.id, itemId));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_item', entityId: itemId, action: productId ? 'unloading_item.link' : 'unloading_item.unlink', before: { linkedProductId: item.linkedProductId }, after: { linkedProductId: productId } });
    return { ok: true as const, data: {} };
  });
}

// ---- Perlu dilihat HR (DRV-107) ----

export async function unloadingLookScreen(actor: Actor | null) {
  if (!hasAction(actor, 'unloading.review_day') && !canViewUnloading(actor)) return null;
  const rows = await db.select({ share: unloadingShares, report: unloadingReports }).from(unloadingShares)
    .innerJoin(unloadingReports, and(eq(unloadingReports.id, unloadingShares.reportId), eq(unloadingReports.version, unloadingShares.version)))
    .where(and(eq(unloadingShares.needsLook, true), eq(unloadingShares.status, 'ACTIVE'))).orderBy(desc(unloadingReports.workDate), asc(unloadingShares.name));
  const names = await accountNames();
  return {
    canReview: hasAction(actor, 'unloading.review_day'),
    rows: rows.map(({ share, report }) => ({
      id: share.id, name: share.name, workDate: report.workDate, number: report.number, status: DAY_STATUS_LABELS[share.dayStatus ?? ''] ?? share.dayStatus ?? '-',
      done: share.lookedAt ? { by: names.get(share.lookedByAccountId ?? 0) ?? '-', note: share.lookNote } : null,
    })),
  };
}

export async function reviewUnloadingDay(actor: Actor | null, shareId: number, note: unknown): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.review_day')) return fail(403, 'Hanya HR, Pemilik, atau GM yang menandai Sudah dilihat.');
  const done = await db.update(unloadingShares).set({ lookedAt: new Date(), lookedByAccountId: actor!.accountId, lookNote: reasonOf(note).slice(0, 500) || null })
    .where(and(eq(unloadingShares.id, shareId), eq(unloadingShares.needsLook, true), isNull(unloadingShares.lookedAt))).returning({ id: unloadingShares.id });
  return done.length ? { ok: true, data: {} } : fail(404, 'Baris yang perlu dilihat tidak ditemukan.');
}

// ---- Beranda dan Pekerja Lepas ----

export async function unloadingAttention(actor: Actor | null) {
  if (!actor) return null;
  const [look, unpaid, weights] = await Promise.all([
    hasAction(actor, 'unloading.review_day')
      ? db.select({ n: sql<number>`count(*)::int` }).from(unloadingShares).where(and(eq(unloadingShares.needsLook, true), eq(unloadingShares.status, 'ACTIVE'), isNull(unloadingShares.lookedAt)))
      : Promise.resolve([{ n: 0 }]),
    hasAction(actor, 'unloading.pay')
      ? db.select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${unloadingReports.totalPay}), 0)::int`, oldest: sql<string | null>`min(${unloadingReports.workDate})::text` })
        .from(unloadingReports).where(eq(unloadingReports.status, 'ACTIVE'))
      : Promise.resolve([{ n: 0, sum: 0, oldest: null }]),
    hasAction(actor, 'unloading.weight_review')
      ? db.select({ n: sql<number>`count(*)::int` }).from(unloadingWeightChanges).where(and(eq(unloadingWeightChanges.flagged, true), isNull(unloadingWeightChanges.reviewedAt)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return {
    look: Number(look[0].n),
    unpaid: { count: Number(unpaid[0].n), pay: Number(unpaid[0].sum), oldest: unpaid[0].oldest },
    weights: Number(weights[0].n),
  };
}

/** Tanggal kerja bongkaran terakhir tiap pekerja lepas (kolom KAR-L28). */
export async function casualLastJoined(): Promise<Map<number, string>> {
  const rows = await db.select({ id: unloadingShares.casualWorkerId, last: sql<string>`max(${unloadingReports.workDate})::text` }).from(unloadingShares)
    .innerJoin(unloadingReports, and(eq(unloadingReports.id, unloadingShares.reportId), eq(unloadingReports.version, unloadingShares.version)))
    .where(and(isNotNull(unloadingShares.casualWorkerId), eq(unloadingShares.status, 'ACTIVE'))).groupBy(unloadingShares.casualWorkerId);
  return new Map(rows.map((r) => [Number(r.id), r.last]));
}

