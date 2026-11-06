'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';
import { kgText } from '../rules/unloading';

type Candidate = { key: string; employeeId: number | null; casualWorkerId: number | null; name: string; detail: string; order: number };
type Unit = {
  productId: number; sku: string | null; name: string; uomId: number; uomName: string; isBase: boolean;
  /** Berat di Master Produk kasir (satu sumber); null = wajib diisi. */
  weight: { kg: string } | null;
};
type PoLine = { poItemId: number; remaining: string; productId: number; uomId: number; sku: string | null; name: string; uomName: string; isBase: boolean; weight: { kg: string } | null };
type PoOption = { id: number; number: string; status: string; createdAt: string; lines: PoLine[] };
type Source = 'ARRIVED_FIRST' | 'PO';
type ProductRow = {
  key: string; productId: number; uomId: number; name: string; uomName: string; quantity: string;
  currentKg: string | null; currentNote: string | null; weightKg: string; editWeight: boolean; weightReason: string;
  /** Pilihan "Dari PO yang ada": sisa jumlah di PO (pembanding selisih); null = di luar PO. */
  poQty?: string | null;
};
type OtherRow = { key: string; other: true; name: string; kg: string; reason: string };
type Row = ProductRow | OtherRow;
type Preview = {
  late: boolean; totalKg: string; rate: number; totalPay: number; lines: { name: string; kg: string }[];
  shares: { key: string; name: string; amount: number; plusOne: boolean }[]; flags: string[]; similar: { id: number; number: string } | null;
};

const DRAFT_KEY = 'hris.unloading.draft.v1';

export type CorrectionSeed = {
  id: number; number: string; paid: boolean;
  initial: { supplierId: number; rows: Row[]; people: string[]; noDeliveryNoteReason: string | null; photoCount: number };
};
type EffectRow = { key: string; name: string; before: number; after: number; topUp: number; overpay: number; reduced: number };
type Effect = { paid: boolean; before: { totalKg: string; totalPay: number }; after: { totalKg: string; totalPay: number }; rows: EffectRow[]; similar: { id: number; number: string } | null };
const isOther = (row: Row): row is OtherRow => 'other' in row;
const num = (v: string) => Number(v.replace(',', '.'));

/**
 * Laporan Bongkaran Baru (DRV-L12, 5 langkah; spec L8 §3.2): supplier + tanggal, barang, peserta, foto, periksa.
 * Angka di langkah Periksa dihitung server. Isian (kecuali foto) tersimpan di perangkat sampai terkirim (TAM-16).
 */
export function UnloadingForm(props: {
  today: string; workDate: string; minDate: string; backdateDays: number; late: boolean; direct: boolean; rate: number | null;
  suppliers: { id: number; name: string }[]; candidates: Candidate[]; frequent: string[]; selfKey: string;
  maxPhotos: number; minReason: number; heavyKg: number; searchMin: number; otherSearchMin: number;
  /** Mode Koreksi (DRV-L18): isi awal dari laporan, tanpa simpanan perangkat. */
  correction?: CorrectionSeed;
}) {
  const { workDate, minReason, correction } = props;
  const late = correction ? false : props.late;
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<Source>('ARRIVED_FIRST');
  const [poId, setPoId] = useState<number | null>(null);
  const [orders, setOrders] = useState<PoOption[] | null>(null);
  const [supplierId, setSupplierId] = useState(correction ? String(correction.initial.supplierId) : '');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [rows, setRows] = useState<Row[]>(correction?.initial.rows ?? []);
  const [people, setPeople] = useState<string[]>(correction?.initial.people ?? []);
  const [candidates, setCandidates] = useState(props.candidates);
  const [photos, setPhotos] = useState<File[]>([]);
  const [noNote, setNoNote] = useState(!!correction?.initial.noDeliveryNoteReason);
  const [noNoteReason, setNoNoteReason] = useState(correction?.initial.noDeliveryNoteReason ?? '');
  const [reason, setReason] = useState('');
  const [applyWeights, setApplyWeights] = useState(false);
  const [effect, setEffect] = useState<Effect | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [similarOk, setSimilarOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restored = useRef(false);

  // Muat dan simpan isian di perangkat (sinyal gudang sering putus).
  useEffect(() => {
    if (correction) { restored.current = false; return; }
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (draft && draft.workDate === workDate) {
        setSupplierId(draft.supplierId ?? ''); setLateReason(draft.lateReason ?? ''); setRows(draft.rows ?? []); setPeople(draft.people ?? []);
        setNoNote(!!draft.noNote); setNoNoteReason(draft.noNoteReason ?? '');
        setSource(draft.source === 'PO' ? 'PO' : 'ARRIVED_FIRST'); setPoId(draft.poId ?? null);
        if (draft.extraCandidates) setCandidates((list) => [...list, ...draft.extraCandidates.filter((c: Candidate) => !list.some((x) => x.key === c.key))]);
      }
    } catch { /* isian lama rusak: abaikan */ }
    restored.current = true;
  }, [workDate, correction]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      const extraCandidates = candidates.filter((c) => !props.candidates.some((x) => x.key === c.key));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ workDate, supplierId, lateReason, rows, people, noNote, noNoteReason, extraCandidates, source, poId }));
    } catch { /* penyimpanan perangkat penuh atau dimatikan */ }
  }, [workDate, supplierId, lateReason, rows, people, noNote, noNoteReason, candidates, props.candidates, source, poId]);

  // PO supplier yang bisa dicocokkan (pilihan "Dari PO yang ada").
  useEffect(() => {
    if (correction || source !== 'PO' || !supplierId) { setOrders(null); return; }
    let live = true;
    fetch(`/api/unloading/purchase-orders?supplierId=${supplierId}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
      .then((res) => { if (live) setOrders(res?.orders ?? []); });
    return () => { live = false; };
  }, [source, supplierId, correction]);

  function choosePo(order: PoOption) {
    setPoId(order.id);
    // Barang + jumlah terisi dari sisa PO; Kepala Gudang mencocokkan dengan yang benar-benar dibongkar.
    setRows(order.lines.map((l) => ({
      key: `${l.productId}:${l.uomId}`, productId: l.productId, uomId: l.uomId, name: l.name, uomName: l.uomName,
      quantity: String(Number(l.remaining)), poQty: l.remaining,
      currentKg: l.weight?.kg ?? null, currentNote: l.weight ? 'dari Master Produk kasir' : null,
      weightKg: l.weight?.kg ?? '', editWeight: !l.weight, weightReason: '',
    })));
  }

  const supplier = props.suppliers.find((s) => String(s.id) === supplierId);
  const runningKg = rows.reduce((sum, row) => sum + (isOther(row) ? num(row.kg) || 0 : (num(row.quantity) || 0) * (num(row.weightKg) || 0)), 0);

  function payload() {
    return {
      workDate, supplierId: Number(supplierId), lateReason: late ? lateReason : null, similarConfirmedId: similarOk && preview?.similar ? preview.similar.id : null,
      items: rows.map((row) => (isOther(row)
        ? { productId: null, name: row.name, kg: row.kg, reason: row.reason }
        : { productId: row.productId, uomId: row.uomId, quantity: row.quantity, weightKg: row.weightKg || null, weightReason: row.editWeight ? row.weightReason : null })),
      participants: people, photoIds: [] as string[], noDeliveryNoteReason: noNote ? noNoteReason : null,
      source, poId: source === 'PO' ? poId : null,
    };
  }

  function check(): string | null {
    if (step === 1) {
      if (!supplierId) return 'Pilih supplier.';
      if (!correction && source === 'PO' && !poId) return 'Pilih PO yang barangnya datang, atau pilih "Barang datang dulu".';
      if (late && lateReason.trim().length < minReason) return `Tulis alasan laporan terlambat (paling sedikit ${minReason} huruf).`;
    }
    if (step === 2) {
      if (!rows.length) return 'Isi paling sedikit satu barang.';
      for (const row of rows) {
        if (isOther(row)) {
          if (!(num(row.kg) > 0)) return `Isi kg "${row.name}".`;
          if (row.reason.trim().length < minReason) return `Alasan Barang lain "${row.name}" paling sedikit ${minReason} huruf.`;
          continue;
        }
        if (!(num(row.quantity) > 0)) return `Isi jumlah ${row.name}.`;
        if (!Number.isInteger(num(row.quantity))) return `Jumlah ${row.name} harus bilangan bulat (PO kasir memakai jumlah bulat).`;
        if (!(num(row.weightKg) > 0)) return `Isi berat per ${row.uomName} untuk ${row.name}.`;
        if (row.editWeight && row.currentKg && num(row.weightKg) !== num(row.currentKg) && row.weightReason.trim().length < minReason) return `Tulis alasan mengubah berat ${row.name} (paling sedikit ${minReason} huruf).`;
        if (num(row.weightKg) > props.heavyKg && !window.confirm(`Betul ${kgText(row.weightKg)} kg per ${row.uomName} untuk ${row.name}?`)) return 'Periksa lagi beratnya.';
      }
    }
    if (step === 3 && !people.length) return 'Pilih paling sedikit satu peserta.';
    if (step === 4) {
      if (!(correction && photos.length === 0) && (photos.length < 1 || photos.length > props.maxPhotos)) return `Lampirkan 1 sampai ${props.maxPhotos} foto ${noNote ? 'barang yang dibongkar' : 'surat jalan'}.`;
      if (noNote && noNoteReason.trim().length < minReason) return `Tulis alasan tidak ada surat jalan (paling sedikit ${minReason} huruf).`;
    }
    return null;
  }

  async function next() {
    setError(null);
    const problem = check();
    if (problem) return setError(problem);
    if (step === 4 && correction) {
      setBusy(true);
      const result = await postJson('/api/unloading', { kind: 'correct_preview', id: correction.id, report: payload() });
      setBusy(false);
      if (!result.ok) return setError(result.error ?? 'Akibat koreksi belum bisa dihitung.');
      const data = result.data as unknown as Effect;
      setEffect(data);
      setPreview({ late: false, totalKg: data.after.totalKg, rate: 0, totalPay: data.after.totalPay, lines: [], shares: [], flags: [], similar: data.similar });
      setSimilarOk(false);
    } else if (step === 4) {
      setBusy(true);
      const result = await postJson('/api/unloading', { kind: 'preview', report: payload() });
      setBusy(false);
      if (!result.ok) return setError(result.error ?? 'Angka belum bisa dihitung. Periksa sinyal, lalu coba lagi.');
      setPreview(result.data as unknown as Preview);
      setSimilarOk(false);
    }
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const photoIds: string[] = [];
    for (const photo of photos) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      photoIds.push(String(uploaded.data?.id));
    }
    if (correction) {
      const result = await postJson('/api/unloading', { kind: 'correct', id: correction.id, report: { ...payload(), photoIds }, reason, applyWeights });
      setBusy(false);
      if (!result.ok) return setError(result.error ?? 'Gagal menyimpan koreksi.');
      toast(String(result.data?.message ?? 'Laporan dikoreksi.'), 'ok');
      router.push(`/gaji/bongkaran/${correction.id}`);
      router.refresh();
      return;
    }
    const result = await postJson('/api/unloading', { kind: 'create', report: { ...payload(), photoIds } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ }
    toast(String(result.data?.message ?? 'Laporan tersimpan.'), 'ok');
    router.push(result.data?.late ? '/gaji/bongkaran?tab=PENDING' : `/gaji/bongkaran/${result.data?.id}`);
    router.refresh();
  }

  const titles = ['Supplier dan tanggal', 'Barang', 'Peserta', 'Foto surat jalan', 'Periksa'];
  return (
    <Card className="max-w-3xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 5 · {titles[step - 1]}</p>
      {step === 1 && (
        <div className="space-y-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Field id="ub-date" label="Tanggal kerja" hint={`Boleh mundur sampai ${longDate(props.minDate)}. Lebih lama dari itu menunggu persetujuan Pemilik atau GM.`}>
              <Input id="ub-date" type="date" name="tanggal" max={props.today} defaultValue={workDate} />
            </Field>
            <Button type="submit" variant="secondary">Ganti tanggal</Button>
          </form>
          <p className="text-sm">Tanggal kerja: <b>{longDate(workDate)}</b>{props.rate != null ? ` · tarif ${rupiah(props.rate)}/kg` : ''}</p>
          {props.rate == null && <Alert tone="danger">Tarif bongkaran untuk tanggal ini belum ada. Hubungi Pemilik atau GM.</Alert>}
          {late && (
            <>
              <Alert tone="warn">{props.direct ? 'Tanggal kerja lebih lama dari batas mundur: alasan tetap wajib, laporan langsung berlaku.' : 'Laporan ini menunggu persetujuan Pemilik atau GM sebelum bisa dibayar.'}</Alert>
              <Field id="ub-late" label="Alasan terlambat" hint={`Paling sedikit ${minReason} huruf.`}><Textarea id="ub-late" value={lateReason} onChange={(e) => setLateReason(e.target.value)} /></Field>
            </>
          )}
          <Field id="ub-sq" label="Cari supplier"><Input id="ub-sq" value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} placeholder="Ketik nama supplier" /></Field>
          <Field id="ub-supplier" label="Supplier" hint="Dari daftar supplier kasir. Supplier baru dibuat di backoffice.">
            <Select id="ub-supplier" value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPoId(null); }}>
              <option value="">Pilih supplier</option>
              {props.suppliers.filter((s) => !supplierQuery || s.name.toLowerCase().includes(supplierQuery.toLowerCase()) || String(s.id) === supplierId)
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          {!correction && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">Asal barang <NewBadge feature="fitur/bongkaran-draft-po" /></p>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ub-source" checked={source === 'ARRIVED_FIRST'} onChange={() => { setSource('ARRIVED_FIRST'); setPoId(null); }} />
                <span><b>Barang datang dulu</b> (PO belum dibuat) — Draft PO otomatis dibuat di kasir; kantor memeriksa, mengisi harga, dan menerima barang.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ub-source" checked={source === 'PO'} onChange={() => setSource('PO')} />
                <span><b>Dari PO yang ada</b> — barang dan jumlah terisi dari PO; cocokkan dengan yang dibongkar.</span>
              </label>
              {source === 'PO' && supplierId && (
                orders == null ? <p className="text-sm text-ink-muted">Memuat PO…</p>
                  : orders.length === 0 ? <Alert tone="warn">Tidak ada PO supplier ini yang menunggu barang. Pilih «Barang datang dulu».</Alert>
                    : (
                      <ul className="divide-y divide-line rounded-card border border-line text-sm">
                        {orders.map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 p-2">
                            <span><b>{o.number}</b> <span className="text-ink-muted">· {o.lines.length} barang · {longDate(o.createdAt.slice(0, 10))}</span></span>
                            <Button size="sm" variant={poId === o.id ? 'primary' : 'secondary'} onClick={() => choosePo(o)}>{poId === o.id ? 'Dipilih' : 'Pilih'}</Button>
                          </li>
                        ))}
                      </ul>
                    )
              )}
            </div>
          )}
        </div>
      )}
      {step === 2 && <ItemsStep rows={rows} setRows={setRows} minReason={minReason} searchMin={props.searchMin} otherSearchMin={props.otherSearchMin} runningKg={runningKg} />}
      {step === 3 && <PeopleStep candidates={candidates} setCandidates={setCandidates} frequent={props.frequent} people={people} setPeople={setPeople} selfKey={props.selfKey} />}
      {step === 4 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noNote} onChange={(e) => setNoNote(e.target.checked)} /> Tidak ada surat jalan (foto barang yang dibongkar)
          </label>
          {correction && <Alert tone="info">Biarkan kosong untuk tetap memakai {correction.initial.photoCount} foto lama.</Alert>}
          <Field id="ub-photos" label={noNote ? 'Foto barang yang dibongkar' : 'Foto surat jalan supplier'} hint={`1 sampai ${props.maxPhotos} foto. Foto tidak tersimpan di perangkat; ambil ulang bila halaman dimuat ulang.`}>
            <Input id="ub-photos" type="file" accept="image/*" capture="environment" multiple
              onChange={(e) => setPhotos((list) => [...list, ...Array.from(e.target.files ?? [])].slice(0, props.maxPhotos))} />
          </Field>
          {photos.length > 0 && (
            <ul className="space-y-1 text-sm">
              {photos.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span>{p.name}</span><Button size="sm" variant="ghost" onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}>Buang</Button>
                </li>
              ))}
            </ul>
          )}
          {noNote && <Field id="ub-nonote" label="Alasan tidak ada surat jalan" hint={`Paling sedikit ${minReason} huruf.`}><Textarea id="ub-nonote" value={noNoteReason} onChange={(e) => setNoNoteReason(e.target.value)} /></Field>}
        </div>
      )}
      {step === 5 && correction && effect && (
        <div className="space-y-3 text-sm">
          <p>Total {kgText(effect.before.totalKg)} kg · {rupiah(effect.before.totalPay)} → <b>{kgText(effect.after.totalKg)} kg · {rupiah(effect.after.totalPay)}</b></p>
          <ul className="space-y-1">
            {effect.rows.map((r) => (
              <li key={r.key}>{r.name}: {rupiah(r.before)} → <b>{rupiah(r.after)}</b>
                {r.topUp > 0 && <span> · susulan {rupiah(r.topUp)}</span>}{r.overpay > 0 && <span> · lebih bayar {rupiah(r.overpay)}</span>}{r.reduced > 0 && <span> · mengurangi lebih bayar {rupiah(r.reduced)}</span>}
              </li>
            ))}
          </ul>
          {effect.paid && <Alert tone="warn">Laporan ini sudah dibayar: pembayaran pertama tidak diubah. Kekurangan disusulkan tunai oleh Finance; kelebihan diperhitungkan di bongkaran orangnya berikutnya.</Alert>}
          {preview?.similar && (
            <Alert tone="warn">Sudah ada {preview.similar.number} dengan tanggal kerja, supplier, dan total kg yang sama.
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={similarOk} onChange={(e) => setSimilarOk(e.target.checked)} /> Ini bongkaran lain</label>
            </Alert>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={applyWeights} onChange={(e) => setApplyWeights(e.target.checked)} /> Pakai berat di laporan ini juga untuk laporan berikutnya</label>
          <Field id="ub-reason" label="Alasan koreksi" hint={`Paling sedikit ${minReason} huruf.`}><Textarea id="ub-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
      )}
      {step === 5 && !correction && preview && (
        <div className="space-y-3 text-sm">
          <p>
            {supplier?.name}, {longDate(workDate)}. {rows.length} barang, <b className="tabular-nums">{kgText(preview.totalKg)} kg</b> × {rupiah(preview.rate)} = <b className="tabular-nums">{rupiah(preview.totalPay)}</b>.
            {' '}Dibagi {preview.shares.length} orang: {preview.shares.map((s) => `${s.name} ${rupiah(s.amount)}`).join(', ')}.
          </p>
          <ul className="list-disc pl-5 text-ink-muted">{preview.lines.map((l, i) => <li key={i}>{l.name}: {kgText(l.kg)} kg</li>)}</ul>
          {preview.flags.length > 0 && <p className="flex flex-wrap gap-1">Tanda: {preview.flags.map((f) => <Badge key={f} tone="warn">{f}</Badge>)}</p>}
          {preview.similar && (
            <Alert tone="warn">
              Sudah ada <Link className="underline" href={`/gaji/bongkaran/${preview.similar.id}`} target="_blank">{preview.similar.number}</Link> dengan tanggal kerja, supplier, dan total kg yang sama.
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={similarOk} onChange={(e) => setSimilarOk(e.target.checked)} /> Ini bongkaran lain</label>
            </Alert>
          )}
          <p className="text-ink-muted">{source === 'PO'
            ? `Jumlah dibongkar dicatat di ${orders?.find((o) => o.id === poId)?.number ?? 'PO'}; stok masuk saat kantor Terima Barang.`
            : noNote ? 'Tanpa surat jalan: Draft PO di kasir dibuat sesudah Pemilik atau GM menyetujui.' : 'Draft PO dibuat otomatis di kasir; stok masuk sesudah kantor memeriksa dan menerima barang.'}</p>
          <p className="text-ink-muted"> {preview.late && !props.direct ? 'Laporan ini menunggu persetujuan Pemilik atau GM.' : 'Langsung berlaku; Finance diberi tahu untuk membayar.'}</p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1
          ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>
          : <Link className={buttonClass({ variant: 'secondary' })} href={correction ? `/gaji/bongkaran/${correction.id}` : '/gaji/bongkaran'}>Batal</Link>}
        {step < 5
          ? <Button loading={busy} disabled={step === 1 && props.rate == null} onClick={next}>Lanjut</Button>
          : <HoldButton loading={busy} disabled={(!!preview?.similar && !similarOk) || (!!correction && reason.trim().length < minReason)} onClick={save}>{correction ? 'Simpan koreksi' : 'Simpan'}</HoldButton>}
      </div>
    </Card>
  );
}

function ItemsStep({ rows, setRows, minReason, searchMin, otherSearchMin, runningKg }: {
  rows: Row[]; setRows: (fn: (rows: Row[]) => Row[]) => void; minReason: number; searchMin: number; otherSearchMin: number; runningKg: number;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Unit[]>([]);
  const [allowOther, setAllowOther] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < searchMin) { setResults([]); setAllowOther(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/unloading/products?q=${encodeURIComponent(q)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      setSearching(false);
      setResults(res?.units ?? []);
      setAllowOther(!!res?.allowOther);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchMin]);

  const grouped = useMemo(() => {
    const map = new Map<number, Unit[]>();
    for (const unit of results) map.set(unit.productId, [...(map.get(unit.productId) ?? []), unit]);
    return [...map.values()];
  }, [results]);

  function add(unit: Unit) {
    const key = `${unit.productId}:${unit.uomId}`;
    setRows((list) => (list.some((r) => r.key === key) ? list : [...list, {
      key, productId: unit.productId, uomId: unit.uomId, name: unit.name, uomName: unit.uomName, quantity: '',
      currentKg: unit.weight?.kg ?? null, currentNote: unit.weight ? 'dari Master Produk kasir' : null,
      weightKg: unit.weight?.kg ?? '', editWeight: !unit.weight, weightReason: '', poQty: null,
    }]));
    setQuery('');
  }
  function addOther() {
    setRows((list) => [...list, { key: `other-${Date.now()}`, other: true, name: query.trim(), kg: '', reason: '' }]);
    setQuery('');
  }
  const update = (key: string, patch: Partial<ProductRow> | Partial<OtherRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } as Row : r)));

  return (
    <div className="space-y-3">
      <Alert tone="info">Laporan Bongkaran bukan penerimaan stok. Jumlah di sini hanya untuk berat dan upah.</Alert>
      <Field id="ub-q" label="Cari barang" hint={`Ketik paling sedikit ${searchMin} huruf nama atau kode.`}>
        <Input id="ub-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="mis. pakan kucing 20 kg" />
      </Field>
      {searching && <p className="text-sm text-ink-muted">Mencari…</p>}
      {grouped.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line text-sm">
          {grouped.map((units) => (
            <li key={units[0].productId} className="space-y-1 p-2">
              <p className="font-medium">{units[0].name}{units[0].sku ? <span className="text-ink-muted"> · {units[0].sku}</span> : null}</p>
              <div className="flex flex-wrap gap-1">
                {units.map((u) => (
                  <Button key={u.uomId} size="sm" variant="secondary" onClick={() => add(u)}>
                    {u.uomName}{u.weight ? ` · ${kgText(u.weight.kg)} kg` : ''}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {allowOther && query.trim().length >= otherSearchMin && (
        <Alert tone="warn">
          Tidak ditemukan di daftar produk kasir. <Button size="sm" variant="secondary" onClick={addOther}>Barang tidak ada di daftar</Button>
          <span className="block text-xs">Jalan terakhir: wajib nama, kg, dan alasan; laporan bertanda Barang lain.</span>
        </Alert>
      )}
      {rows.map((row) => (
        <div key={row.key} className="space-y-2 rounded-card border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{row.name} {isOther(row) ? <Badge tone="warn">Barang lain</Badge> : <span className="text-ink-muted">· {row.uomName}</span>}</p>
            <Button size="sm" variant="ghost" onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}>Buang</Button>
          </div>
          {isOther(row) ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field id={`n-${row.key}`} label="Nama barang"><Input id={`n-${row.key}`} value={row.name} onChange={(e) => update(row.key, { name: e.target.value })} /></Field>
              <Field id={`k-${row.key}`} label="Kg"><Input id={`k-${row.key}`} inputMode="decimal" value={row.kg} onChange={(e) => update(row.key, { kg: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field id={`r-${row.key}`} label="Alasan" hint={`Paling sedikit ${minReason} huruf.`}><Textarea id={`r-${row.key}`} value={row.reason} onChange={(e) => update(row.key, { reason: e.target.value })} /></Field></div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field id={`q-${row.key}`} label={`Jumlah (${row.uomName})`} hint={row.poQty != null ? `Sisa di PO: ${kgText(row.poQty)}${num(row.quantity) !== Number(row.poQty) && num(row.quantity) > 0 ? ' · selisih dengan PO' : ''}` : undefined}>
                <Input id={`q-${row.key}`} inputMode="numeric" value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} />
              </Field>
              {row.editWeight ? (
                <Field id={`w-${row.key}`} label={`Berat per ${row.uomName} (kg)`} hint={row.currentKg ? `Sekarang ${kgText(row.currentKg)} kg; berat baru disimpan di Master Produk kasir.` : 'Belum ada berat di Master Produk kasir: isi sekali, tersimpan di kasir untuk bongkaran berikutnya.'}>
                  <Input id={`w-${row.key}`} inputMode="decimal" value={row.weightKg} onChange={(e) => update(row.key, { weightKg: e.target.value })} />
                </Field>
              ) : (
                <div className="text-sm">
                  <p>{kgText(row.weightKg)} kg per {row.uomName} <span className="text-ink-muted">({row.currentNote})</span></p>
                  <Button size="sm" variant="ghost" onClick={() => update(row.key, { editWeight: true })}>Ubah berat</Button>
                </div>
              )}
              {row.editWeight && row.currentKg && (
                <div className="sm:col-span-2"><Field id={`wr-${row.key}`} label="Alasan mengubah berat" hint={`Paling sedikit ${minReason} huruf.`}><Textarea id={`wr-${row.key}`} value={row.weightReason} onChange={(e) => update(row.key, { weightReason: e.target.value })} /></Field></div>
              )}
              <p className="text-sm text-ink-muted sm:col-span-2">= {num(row.quantity) > 0 && num(row.weightKg) > 0 ? kgText((num(row.quantity) * num(row.weightKg)).toFixed(3)) : '-'} kg</p>
            </div>
          )}
        </div>
      ))}
      <p className="text-sm">Jumlah berjalan: <b className="tabular-nums">{kgText(runningKg.toFixed(3))} kg</b> <span className="text-ink-muted">(angka akhir dihitung server di langkah Periksa)</span></p>
    </div>
  );
}

function PeopleStep({ candidates, setCandidates, frequent, people, setPeople, selfKey }: {
  candidates: Candidate[]; setCandidates: (fn: (list: Candidate[]) => Candidate[]) => void; frequent: string[];
  people: string[]; setPeople: (fn: (list: string[]) => string[]) => void; selfKey: string;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (key: string) => setPeople((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  const byKey = (key: string) => candidates.find((c) => c.key === key);
  const shown = query.trim().length >= 1 ? candidates.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30) : [];

  async function addCasual() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/casual-workers', { kind: 'save', id: null, name, phone });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menambah.');
    const id = Number(result.data?.id);
    const key = `C${id}`;
    setCandidates((list) => [...list, { key, employeeId: null, casualWorkerId: id, name: String(result.data?.name ?? name), detail: 'Pekerja lepas', order: 1_000_000_000 + id }]);
    setPeople((list) => [...list, key]);
    setAdding(false); setName(''); setPhone('');
  }

  return (
    <div className="space-y-3">
      {frequent.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-ink-muted">Sering ikut (30 hari terakhir)</p>
          <div className="flex flex-wrap gap-1">
            {frequent.map((key) => byKey(key) && (
              <Button key={key} size="sm" variant={people.includes(key) ? 'primary' : 'secondary'} onClick={() => toggle(key)}>{byKey(key)!.name}</Button>
            ))}
          </div>
        </div>
      )}
      <Field id="ub-pq" label="Cari peserta" hint="Karyawan aktif pada tanggal kerja (cabang mana pun) atau pekerja lepas.">
        <Input id="ub-pq" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik nama" />
      </Field>
      {shown.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line text-sm">
          {shown.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-2 p-2">
              <span>{c.name} <span className="text-ink-muted">· {c.detail}</span></span>
              <Button size="sm" variant={people.includes(c.key) ? 'primary' : 'secondary'} onClick={() => toggle(c.key)}>{people.includes(c.key) ? 'Dipilih' : 'Pilih'}</Button>
            </li>
          ))}
        </ul>
      )}
      {!adding ? <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>Tambah pekerja lepas</Button> : (
        <div className="space-y-2 rounded-card border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field id="ub-cn" label="Nama"><Input id="ub-cn" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field id="ub-cp" label="Nomor HP"><Input id="ub-cp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2"><Button size="sm" loading={busy} onClick={addCasual}>Tambah</Button><Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Batal</Button></div>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">Dipilih: {people.length} orang</p>
        <div className="flex flex-wrap gap-1">
          {people.map((key) => (
            <Button key={key} size="sm" variant="secondary" onClick={() => toggle(key)}>{byKey(key)?.name ?? key}{key === selfKey ? ' (Anda)' : ''} ✕</Button>
          ))}
        </div>
        {people.includes(selfKey) && <p className="text-xs text-ink-muted">Anda ikut jadi peserta: laporan bertanda «pembuat ikut jadi peserta» untuk Finance dan Pemilik.</p>}
      </div>
    </div>
  );
}
