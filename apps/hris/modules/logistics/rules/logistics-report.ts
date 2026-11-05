import Big from 'big.js';
import { fuelPeriod } from './fuel';
import { addDays, type IsoDate } from './trip';

// Aturan murni Laporan Logistik (spec LT1 §17.2; LOG-81, 145): rentang, penjumlahan per tab dari fakta yang dibaca server,
// dan isi CSV. Laporan hanya membaca: angka uang dari cara bayar awak dan pemeriksaan Finance (Terima Uang), tanpa piutang.

export const REPORT_TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'trip', label: 'Per trip & perjalanan' },
  { key: 'toko', label: 'Per toko' },
  { key: 'cabang', label: 'Per cabang pemilik nota' },
  { key: 'mobil', label: 'Per mobil' },
  { key: 'awak', label: 'Per awak' },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]['key'];
export const isReportTab = (v: unknown): v is ReportTab => REPORT_TABS.some((t) => t.key === v);

export const REPORT_MAX_MONTHS = 3;
export const REPORT_PERIOD_CHOICES = 12;

export type ReportRange = { from: IsoDate; to: IsoDate; label: string; free: boolean };
export type RangeQuery = { periode?: string; dari?: string; sampai?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function validIso(v: unknown): v is IsoDate {
  if (typeof v !== 'string' || !ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function dayLabel(day: IsoDate): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Periode 26–25 diberi nama bulan akhirnya (26 Okt – 25 Nov = "Periode November 2026"). */
export function periodLabel(from: IsoDate): string {
  const to = fuelPeriod(from).to;
  const [y, m] = to.split('-').map(Number);
  const full = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `Periode ${full[m - 1]} ${y} (${dayLabel(from)} – ${dayLabel(to)})`;
}

/** Pilihan periode: periode berjalan lalu mundur. */
export function periodChoices(today: IsoDate, count = REPORT_PERIOD_CHOICES): { from: IsoDate; label: string }[] {
  const out: { from: IsoDate; label: string }[] = [];
  let from = fuelPeriod(today).from;
  for (let i = 0; i < count; i += 1) {
    out.push({ from, label: periodLabel(from) });
    from = fuelPeriod(addDays(from, -1)).from;
  }
  return out;
}

/** Tanggal yang sama N bulan kemudian (tanggal 31 ke bulan pendek = akhir bulan itu). */
export function addMonths(day: IsoDate, months: number): IsoDate {
  const [y, m, d] = day.split('-').map(Number);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/**
 * Rentang laporan (LOG-145): tanggal bebas (dari–sampai, paling panjang 3 bulan) bila keduanya diisi; selain itu periode 26–25
 * terpilih (bawaan: periode berjalan).
 */
export function reportRange(q: RangeQuery, today: IsoDate): { ok: true; range: ReportRange } | { ok: false; error: string; range: ReportRange } {
  const current = fuelPeriod(today);
  const fallback: ReportRange = { ...current, label: periodLabel(current.from), free: false };
  if (q.dari || q.sampai) {
    if (!validIso(q.dari) || !validIso(q.sampai)) return { ok: false, error: 'Isi tanggal dari dan sampai dengan benar.', range: fallback };
    if (q.dari > q.sampai) return { ok: false, error: 'Tanggal dari tidak boleh sesudah tanggal sampai.', range: fallback };
    if (q.sampai >= addMonths(q.dari, REPORT_MAX_MONTHS)) {
      return { ok: false, error: `Rentang paling panjang ${REPORT_MAX_MONTHS} bulan. Untuk melihat lebih lama, pakai pilihan periode satu per satu.`, range: fallback };
    }
    return { ok: true, range: { from: q.dari, to: q.sampai, label: `${dayLabel(q.dari)} – ${dayLabel(q.sampai)}`, free: true } };
  }
  if (q.periode) {
    if (!validIso(q.periode)) return { ok: false, error: 'Periode tidak dikenal.', range: fallback };
    const p = fuelPeriod(q.periode);
    return { ok: true, range: { ...p, label: periodLabel(p.from), free: false } };
  }
  return { ok: true, range: fallback };
}

// ---------- Fakta yang dibaca server ----------

export type CrewRole = 'DRIVER' | 'ASSISTANT' | 'PJ';
export type Outcome = 'DELIVERED' | 'TOMORROW' | 'FAILED';
export type PayMethod = 'NONE' | 'CASH' | 'TRANSFER' | 'PARTIAL' | 'TEMPO';

export type TripFact = {
  /** TRUCK = trip truk; SELF = perjalanan antar sendiri. */
  source: 'TRUCK' | 'SELF';
  key: string;
  number: string;
  date: IsoDate;
  vehicleId: number | null;
  vehicle: string | null;
  route: string | null;
  /** Cabang asal (antar sendiri). */
  branch: string | null;
  crew: { employeeId: number; role: CrewRole }[];
};

export type MoneyCheckFact = { kind: 'CASH' | 'TRANSFER'; reported: number; actual: number; responsibleEmployeeId: number | null };

export type VisitFact = {
  source: 'TRUCK' | 'SELF';
  tripKey: string;
  customerId: number | null;
  destination: string;
  outcome: Outcome;
  /** Nota di kunjungan: cabang kasir pemiliknya + jenis (SALE nota, TRANSFER PO Internal). */
  notes: { branch: string; kind: 'SALE' | 'TRANSFER' }[];
  method: PayMethod | null;
  received: number;
  checks: MoneyCheckFact[];
  /** Ditinjau Tidak wajar di luar titik toko. */
  notOk: boolean;
};

export type WageFact = { tripKey: string | null; employeeId: number; role: 'DRIVER' | 'ASSISTANT'; kind: 'RITASE' | 'SHOPPING'; vehicleId: number };
export type FuelFact = { vehicleId: number; vehicle: string; driverEmployeeId: number; amount: number; withRequest: boolean };
export type ReportFact = { tripKey: string; customerId: number | null; destination: string; isReturn: boolean };
export type VehicleAttentionFact = { vehicleId: number };

export type ReportFacts = {
  trips: TripFact[];
  visits: VisitFact[];
  wages: WageFact[];
  fuel: FuelFact[];
  reports: ReportFact[];
  vehicleAttention: VehicleAttentionFact[];
  vehicles: Map<number, string>;
  customers: Map<number, string>;
  people: Map<number, string>;
};

/** Bagian yang terlihat (§17.2 butir 6): Marketing tanpa bensin dan tanpa kurang serah. */
export type ReportParts = { fuel: boolean; shortage: boolean };

// ---------- Uang per kunjungan ----------

export type VisitMoney = {
  cash: number; transfer: number;
  checkedReported: number; checkedActual: number;
  uncheckedCash: number; uncheckedTransfer: number;
  shortage: number;
};

const sum = (values: number[]) => values.reduce((acc, v) => acc.plus(v), new Big(0)).toNumber();

/**
 * Uang dilaporkan awak dipisah: yang sudah diperiksa Finance (dilaporkan vs diterima sebenarnya) dan yang belum diperiksa.
 * Kurang serah = tunai yang diterima Finance lebih kecil dari laporan, atas nama pembawa.
 */
export function visitMoney(v: Pick<VisitFact, 'method' | 'received' | 'checks'>): VisitMoney {
  const cash = v.method === 'CASH' || v.method === 'PARTIAL' ? v.received : 0;
  const transfer = v.method === 'TRANSFER' ? v.received : 0;
  const cashChecks = v.checks.filter((c) => c.kind === 'CASH');
  const transferChecks = v.checks.filter((c) => c.kind === 'TRANSFER');
  const checkedCash = sum(cashChecks.map((c) => c.reported));
  const checkedTransfer = sum(transferChecks.map((c) => c.reported));
  return {
    cash, transfer,
    checkedReported: sum(v.checks.map((c) => c.reported)),
    checkedActual: sum(v.checks.map((c) => c.actual)),
    uncheckedCash: Math.max(0, new Big(cash).minus(checkedCash).toNumber()),
    uncheckedTransfer: Math.max(0, new Big(transfer).minus(checkedTransfer).toNumber()),
    shortage: sum(cashChecks.filter((c) => c.responsibleEmployeeId != null && c.actual < c.reported).map((c) => c.reported - c.actual)),
  };
}

// ---------- Tabel ----------

export type CellKind = 'text' | 'count' | 'money';
export type ReportColumn = { key: string; label: string; kind: CellKind; part?: keyof ReportParts };
export type ReportRow = Record<string, string | number>;
export type ReportTable = { columns: ReportColumn[]; rows: ReportRow[]; note?: string };

const visibleColumns = (cols: ReportColumn[], parts: ReportParts) => cols.filter((c) => !c.part || parts[c.part]);

type Counter = Record<string, number>;
const bump = (o: Counter, key: string, by = 1) => { o[key] = new Big(o[key] ?? 0).plus(by).toNumber(); };

function moneyInto(target: Counter, m: VisitMoney) {
  bump(target, 'cash', m.cash);
  bump(target, 'transfer', m.transfer);
  bump(target, 'checkedReported', m.checkedReported);
  bump(target, 'checkedActual', m.checkedActual);
  bump(target, 'unchecked', m.uncheckedCash + m.uncheckedTransfer);
  bump(target, 'shortage', m.shortage);
}

function outcomeNotes(target: Counter, v: VisitFact) {
  const saleNotes = v.notes.length ? v.notes.length : 1;
  bump(target, v.outcome === 'DELIVERED' ? 'notesDelivered' : v.outcome === 'TOMORROW' ? 'notesTomorrow' : 'notesFailed', saleNotes);
}

const MONEY_COLUMNS: ReportColumn[] = [
  { key: 'cash', label: 'Tunai dilaporkan', kind: 'money' },
  { key: 'transfer', label: 'Transfer dilaporkan', kind: 'money' },
  { key: 'checkedReported', label: 'Terperiksa: dilaporkan', kind: 'money' },
  { key: 'checkedActual', label: 'Terperiksa: diterima', kind: 'money' },
  { key: 'unchecked', label: 'Belum diperiksa', kind: 'money' },
];

const NOTE_COLUMNS: ReportColumn[] = [
  { key: 'notesDelivered', label: 'Nota terkirim', kind: 'count' },
  { key: 'notesTomorrow', label: 'Nota kirim besok', kind: 'count' },
  { key: 'notesFailed', label: 'Nota gagal', kind: 'count' },
];

const sortBy = <T,>(rows: T[], key: (r: T) => string) => rows.sort((a, b) => key(a).localeCompare(key(b), 'id'));

export function summaryTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const c: Counter = {};
  for (const t of f.trips) bump(c, t.source === 'TRUCK' ? 'truckTrips' : 'selfTrips');
  const stores = new Set<number>();
  for (const v of f.visits) {
    bump(c, 'visits');
    if (v.customerId != null && v.outcome === 'DELIVERED') stores.add(v.customerId);
    outcomeNotes(c, v);
    bump(c, 'transferNotes', v.notes.filter((n) => n.kind === 'TRANSFER').length);
    moneyInto(c, visitMoney(v));
    if (v.method === 'TEMPO') bump(c, 'tempo');
    if (v.method === 'PARTIAL') bump(c, 'partial');
    if (v.notOk) bump(c, 'notOk');
  }
  for (const r of f.reports) bump(c, r.isReturn ? 'returns' : 'otherReports');
  for (const w of f.wages) if (w.role === 'DRIVER') bump(c, w.kind === 'RITASE' ? 'ritase' : 'shopping');
  for (const fu of f.fuel) {
    bump(c, 'fuelAmount', fu.amount);
    bump(c, 'fuelCount');
    if (!fu.withRequest) bump(c, 'fuelNoRequest');
  }
  const lines: { label: string; key: string; kind: CellKind; part?: keyof ReportParts }[] = [
    { label: 'Trip truk', key: 'truckTrips', kind: 'count' },
    { label: 'Perjalanan antar sendiri', key: 'selfTrips', kind: 'count' },
    { label: 'Kunjungan / tujuan diproses', key: 'visits', kind: 'count' },
    { label: 'Toko dikirimi (Terkirim)', key: 'stores', kind: 'count' },
    ...NOTE_COLUMNS.map((n) => ({ label: n.label, key: n.key, kind: n.kind })),
    { label: 'Di antaranya PO Internal', key: 'transferNotes', kind: 'count' },
    ...MONEY_COLUMNS.map((m) => ({ label: m.label, key: m.key, kind: m.kind })),
    { label: 'Cara bayar Tempo (banyaknya)', key: 'tempo', kind: 'count' },
    { label: 'Cara bayar Bayar sebagian (banyaknya)', key: 'partial', kind: 'count' },
    { label: 'Kurang serah (selisih tunai)', key: 'shortage', kind: 'money', part: 'shortage' },
    { label: 'Retur dibawa pulang', key: 'returns', kind: 'count' },
    { label: 'Laporan barang lain (salah, kurang, rusak, harga beda, kendala)', key: 'otherReports', kind: 'count' },
    { label: 'Kiriman di luar titik dinilai Tidak wajar', key: 'notOk', kind: 'count' },
    { label: 'Ritase (driver)', key: 'ritase', kind: 'count' },
    { label: 'Belanja supplier (driver)', key: 'shopping', kind: 'count' },
    { label: 'Bensin', key: 'fuelAmount', kind: 'money', part: 'fuel' },
    { label: 'Pengisian bensin', key: 'fuelCount', kind: 'count', part: 'fuel' },
    { label: 'Di antaranya tanpa permintaan (lupa minta)', key: 'fuelNoRequest', kind: 'count', part: 'fuel' },
  ];
  c.stores = stores.size;
  return {
    columns: [{ key: 'label', label: 'Ukuran', kind: 'text' }, { key: 'value', label: 'Angka', kind: 'text' }],
    rows: lines.filter((l) => !l.part || parts[l.part]).map((l) => ({ label: l.label, value: l.kind === 'money' ? rupiahText(c[l.key] ?? 0) : String(c[l.key] ?? 0) })),
  };
}

export function tripTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const byTrip = new Map<string, Counter>();
  const at = (key: string) => { let c = byTrip.get(key); if (!c) { c = {}; byTrip.set(key, c); } return c; };
  for (const v of f.visits) {
    const c = at(v.tripKey);
    bump(c, 'visits');
    outcomeNotes(c, v);
    moneyInto(c, visitMoney(v));
  }
  for (const r of f.reports) if (r.isReturn) bump(at(r.tripKey), 'returns');
  for (const w of f.wages) if (w.tripKey && w.role === 'DRIVER' && w.kind === 'RITASE') bump(at(w.tripKey), 'ritase');
  const columns: ReportColumn[] = [
    { key: 'kind', label: 'Jenis', kind: 'text' },
    { key: 'number', label: 'Nomor', kind: 'text' },
    { key: 'date', label: 'Tanggal', kind: 'text' },
    { key: 'where', label: 'Mobil / cabang', kind: 'text' },
    { key: 'route', label: 'Rute', kind: 'text' },
    { key: 'driver', label: 'Driver / pengantar', kind: 'text' },
    { key: 'assistant', label: 'Kenek', kind: 'text' },
    { key: 'visits', label: 'Tujuan', kind: 'count' },
    ...NOTE_COLUMNS,
    ...MONEY_COLUMNS,
    { key: 'shortage', label: 'Kurang serah', kind: 'money', part: 'shortage' },
    { key: 'returns', label: 'Retur', kind: 'count' },
    { key: 'ritase', label: 'Ritase', kind: 'count' },
  ];
  const names = (t: TripFact, roles: CrewRole[]) => t.crew.filter((c) => roles.includes(c.role)).map((c) => f.people.get(c.employeeId) ?? `#${c.employeeId}`).join(', ');
  const rows = [...f.trips].sort((a, b) => (a.date === b.date ? a.number.localeCompare(b.number) : a.date.localeCompare(b.date))).map((t) => ({
    ...zero(columns), ...byTrip.get(t.key),
    kind: t.source === 'TRUCK' ? 'Truk' : 'Antar sendiri', number: t.number, date: t.date,
    where: t.source === 'TRUCK' ? (t.vehicle ?? '-') : (t.branch ?? '-'), route: t.route ?? '-',
    driver: names(t, ['DRIVER', 'PJ']) || '-', assistant: names(t, ['ASSISTANT']) || '-',
  }));
  return { columns: visibleColumns(columns, parts), rows };
}

const UMUM = 'Umum (tanpa pelanggan)';

export function storeTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const by = new Map<string, Counter>();
  const label = new Map<string, string>();
  const at = (customerId: number | null, fallback: string) => {
    const key = customerId == null ? 'umum' : String(customerId);
    if (!label.has(key)) label.set(key, customerId == null ? UMUM : f.customers.get(customerId) ?? fallback);
    let c = by.get(key); if (!c) { c = {}; by.set(key, c); } return c;
  };
  for (const v of f.visits) {
    if (v.notes.length && v.notes.every((n) => n.kind === 'TRANSFER')) continue;
    const c = at(v.customerId, v.destination);
    bump(c, 'visits');
    bump(c, v.outcome === 'DELIVERED' ? 'delivered' : v.outcome === 'TOMORROW' ? 'tomorrow' : 'failed');
    moneyInto(c, visitMoney(v));
    if (v.method === 'TEMPO') bump(c, 'tempo');
    if (v.notOk) bump(c, 'notOk');
  }
  for (const r of f.reports) bump(at(r.customerId, r.destination), r.isReturn ? 'returns' : 'otherReports');
  const columns: ReportColumn[] = [
    { key: 'name', label: 'Toko', kind: 'text' },
    { key: 'visits', label: 'Kunjungan', kind: 'count' },
    { key: 'delivered', label: 'Terkirim', kind: 'count' },
    { key: 'tomorrow', label: 'Kirim besok', kind: 'count' },
    { key: 'failed', label: 'Gagal', kind: 'count' },
    ...MONEY_COLUMNS,
    { key: 'tempo', label: 'Tempo (banyaknya)', kind: 'count' },
    { key: 'returns', label: 'Retur', kind: 'count' },
    { key: 'otherReports', label: 'Laporan barang lain', kind: 'count' },
    { key: 'notOk', label: 'Tidak wajar (di luar titik)', kind: 'count' },
  ];
  const rows = sortBy([...by.entries()].map(([key, c]) => ({ ...zero(columns), ...c, name: label.get(key) ?? key })), (r) => String(r.name));
  return { columns: visibleColumns(columns, parts), rows };
}

export const MIXED_BRANCH = 'Campuran (satu kunjungan, beberapa cabang)';

export function branchTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const by = new Map<string, Counter>();
  const at = (name: string) => { let c = by.get(name); if (!c) { c = {}; by.set(name, c); } return c; };
  for (const v of f.visits) {
    for (const n of v.notes) {
      const c = at(n.branch);
      if (n.kind === 'TRANSFER') { bump(c, 'transferNotes'); continue; }
      bump(c, v.outcome === 'DELIVERED' ? 'notesDelivered' : v.outcome === 'TOMORROW' ? 'notesTomorrow' : 'notesFailed');
    }
    const branches = new Set(v.notes.filter((n) => n.kind === 'SALE').map((n) => n.branch));
    if (!branches.size) continue;
    // Uang dicatat per kunjungan; kunjungan dengan nota dari beberapa cabang tidak dibagi-bagi tebakan.
    moneyInto(at(branches.size === 1 ? [...branches][0] : MIXED_BRANCH), visitMoney(v));
  }
  const columns: ReportColumn[] = [
    { key: 'name', label: 'Cabang pemilik nota', kind: 'text' },
    ...NOTE_COLUMNS,
    { key: 'transferNotes', label: 'PO Internal dikirim', kind: 'count' },
    ...MONEY_COLUMNS,
  ];
  const rows = sortBy([...by.entries()].map(([name, c]) => ({ ...zero(columns), ...c, name })), (r) => (r.name === MIXED_BRANCH ? '~' : String(r.name)));
  return {
    columns: visibleColumns(columns, parts), rows,
    note: 'Nota dihitung per cabang kasir asalnya. Uang dicatat awak per kunjungan; kunjungan yang membawa nota dari beberapa cabang masuk baris Campuran.',
  };
}

export function vehicleTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const by = new Map<number, Counter>();
  const at = (id: number) => { let c = by.get(id); if (!c) { c = {}; by.set(id, c); } return c; };
  const tripVehicle = new Map(f.trips.filter((t) => t.vehicleId != null).map((t) => [t.key, t.vehicleId as number]));
  for (const t of f.trips) if (t.vehicleId != null) bump(at(t.vehicleId), 'trips');
  for (const v of f.visits) { const id = tripVehicle.get(v.tripKey); if (id != null) bump(at(id), 'visits'); }
  for (const w of f.wages) if (w.role === 'DRIVER') bump(at(w.vehicleId), w.kind === 'RITASE' ? 'ritase' : 'shopping');
  for (const fu of f.fuel) {
    const c = at(fu.vehicleId);
    bump(c, 'fuelAmount', fu.amount); bump(c, 'fuelCount');
    if (!fu.withRequest) bump(c, 'fuelNoRequest');
  }
  for (const a of f.vehicleAttention) bump(at(a.vehicleId), 'attention');
  const columns: ReportColumn[] = [
    { key: 'name', label: 'Mobil', kind: 'text' },
    { key: 'trips', label: 'Trip', kind: 'count' },
    { key: 'visits', label: 'Kunjungan', kind: 'count' },
    { key: 'ritase', label: 'Ritase (driver)', kind: 'count' },
    { key: 'shopping', label: 'Belanja supplier', kind: 'count' },
    { key: 'fuelAmount', label: 'Bensin', kind: 'money', part: 'fuel' },
    { key: 'fuelCount', label: 'Pengisian', kind: 'count', part: 'fuel' },
    { key: 'fuelNoRequest', label: 'Tanpa permintaan', kind: 'count', part: 'fuel' },
    { key: 'attention', label: 'Dilaporkan perlu perhatian', kind: 'count' },
  ];
  const rows = sortBy([...by.entries()].map(([id, c]) => ({ ...zero(columns), ...c, name: f.vehicles.get(id) ?? `Mobil #${id}` })), (r) => String(r.name));
  return { columns: visibleColumns(columns, parts), rows };
}

const ROLE_TEXT: Record<CrewRole, string> = { DRIVER: 'Driver', ASSISTANT: 'Kenek', PJ: 'Pengantar' };

export function crewTable(f: ReportFacts, parts: ReportParts): ReportTable {
  const by = new Map<number, Counter>();
  const roles = new Map<number, Set<CrewRole>>();
  const at = (id: number) => { let c = by.get(id); if (!c) { c = {}; by.set(id, c); } return c; };
  const tripCrew = new Map(f.trips.map((t) => [t.key, t.crew]));
  for (const t of f.trips) {
    for (const m of t.crew) {
      bump(at(m.employeeId), t.source === 'TRUCK' ? 'truckTrips' : 'selfTrips');
      if (!roles.has(m.employeeId)) roles.set(m.employeeId, new Set());
      roles.get(m.employeeId)?.add(m.role);
    }
  }
  for (const v of f.visits) {
    for (const m of tripCrew.get(v.tripKey) ?? []) {
      const c = at(m.employeeId);
      bump(c, v.outcome === 'DELIVERED' ? 'delivered' : v.outcome === 'TOMORROW' ? 'tomorrow' : 'failed');
      if (v.notOk) bump(c, 'notOk');
    }
    for (const ch of v.checks) {
      if (ch.kind === 'CASH' && ch.responsibleEmployeeId != null && ch.actual < ch.reported) bump(at(ch.responsibleEmployeeId), 'shortage', ch.reported - ch.actual);
    }
  }
  for (const w of f.wages) bump(at(w.employeeId), w.kind === 'RITASE' ? 'ritase' : 'shopping');
  for (const fu of f.fuel) if (!fu.withRequest) bump(at(fu.driverEmployeeId), 'forgotFuel');
  const columns: ReportColumn[] = [
    { key: 'name', label: 'Nama', kind: 'text' },
    { key: 'roles', label: 'Peran', kind: 'text' },
    { key: 'truckTrips', label: 'Trip truk', kind: 'count' },
    { key: 'selfTrips', label: 'Antar sendiri', kind: 'count' },
    { key: 'ritase', label: 'Ritase', kind: 'count' },
    { key: 'shopping', label: 'Belanja supplier', kind: 'count' },
    { key: 'delivered', label: 'Kunjungan terkirim', kind: 'count' },
    { key: 'tomorrow', label: 'Kirim besok', kind: 'count' },
    { key: 'failed', label: 'Gagal', kind: 'count' },
    { key: 'notOk', label: 'Tidak wajar (di luar titik)', kind: 'count' },
    { key: 'shortage', label: 'Kurang serah', kind: 'money', part: 'shortage' },
    { key: 'forgotFuel', label: 'Bensin lupa minta', kind: 'count', part: 'fuel' },
  ];
  const rows = sortBy([...by.entries()].map(([id, c]) => ({
    ...zero(columns), ...c, name: f.people.get(id) ?? `#${id}`,
    roles: [...(roles.get(id) ?? [])].map((r) => ROLE_TEXT[r]).join(', ') || '-',
  })), (r) => String(r.name));
  return {
    columns: visibleColumns(columns, parts), rows,
    note: 'Kunjungan dihitung untuk setiap awak trip itu. Kurang serah atas nama pembawa tunai (driver) dari Terima Uang; tanpa potongan otomatis.',
  };
}

function zero(columns: ReportColumn[]): ReportRow {
  return Object.fromEntries(columns.filter((c) => c.kind !== 'text').map((c) => [c.key, 0]));
}

export function reportTable(tab: ReportTab, f: ReportFacts, parts: ReportParts): ReportTable {
  switch (tab) {
    case 'ringkasan': return summaryTable(f, parts);
    case 'trip': return tripTable(f, parts);
    case 'toko': return storeTable(f, parts);
    case 'cabang': return branchTable(f, parts);
    case 'mobil': return vehicleTable(f, parts);
    case 'awak': return crewTable(f, parts);
  }
}

// ---------- CSV ----------

export function rupiahText(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
}

const csvCell = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** CSV titik koma (Excel Indonesia). Kolom uang tabel ditulis rupiah bulat tanpa titik ribuan supaya bisa dijumlah. */
export function reportCsv(table: ReportTable, meta: { title: string; range: string; madeBy: string; madeAt: string }): string {
  const lines = [
    [meta.title, meta.range, `dibuat ${meta.madeBy}`, meta.madeAt].map(csvCell).join(';'),
    table.columns.map((c) => csvCell(c.label)).join(';'),
    ...table.rows.map((r) => table.columns.map((c) => csvCell(String(r[c.key] ?? ''))).join(';')),
  ];
  if (table.note) lines.push(csvCell(table.note));
  return `${lines.join('\r\n')}\r\n`;
}
