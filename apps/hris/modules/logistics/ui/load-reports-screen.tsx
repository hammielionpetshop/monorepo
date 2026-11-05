'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { LOAD_MAX_PHOTOS, LOAD_NOTE_DAYS, LOAD_STATUS_TONES, type LoadPhotoKind } from '../rules/load-reports';
import { rupiah } from '../rules/rates';
import type { CandidateNote, LoadBranch, LoadPhotoView, LoadReportListRow, LoadReportTab, loadReportDetail } from '../server/load-reports';
import { LiveCamera } from './capture';

const selectClass = 'min-h-9 rounded-lg border border-line bg-surface px-3 text-sm';
const TAB_LABELS: Record<LoadReportTab, string> = { DRAFT: 'Proses', DONE: 'Selesai', CANCELLED: 'Batal' };

type Filter = { tab: LoadReportTab; from: string; to: string; q: string };

function tabHref(filter: Filter, tab: LoadReportTab) {
  const params = new URLSearchParams({ tab, dari: filter.from, sampai: filter.to });
  if (filter.q) params.set('cari', filter.q);
  return `/logistik/laporan-muat?${params}`;
}

/** Cari dan pilih nota kasir (satu toko). `customerId` = hanya toko itu (menambah ke laporan yang ada). */
function NotePicker({ branchId, customerId, chosen, onChange }: {
  branchId: number; customerId?: number | null; chosen: CandidateNote[]; onChange: (notes: CandidateNote[]) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CandidateNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = customerId ?? chosen[0]?.customerId ?? null;
  useEffect(() => {
    let stop = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ branch: String(branchId) });
      if (q.trim()) params.set('q', q.trim());
      if (store) params.set('customer', String(store));
      try {
        const res = await fetch(`/api/logistics/load-reports?${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (stop) return;
        if (!res.ok) setError(data.error ?? 'Gagal memuat nota.');
        else {
          setError(null);
          setRows(data.rows);
        }
      } catch {
        if (!stop) setError('Terjadi kesalahan jaringan, silakan coba lagi.');
      } finally {
        if (!stop) setLoading(false);
      }
    }, 300);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [branchId, q, store]);
  const picked = new Set(chosen.map((n) => n.transactionId));
  function toggle(note: CandidateNote) {
    onChange(picked.has(note.transactionId) ? chosen.filter((n) => n.transactionId !== note.transactionId) : [...chosen, note]);
  }
  return (
    <div className="space-y-2">
      <Field id="load-note-search" label="Cari nomor nota atau nama toko">
        <Input id="load-note-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contoh: TRX-20261105 atau nama toko" />
      </Field>
      {store && !customerId && (
        <p className="text-sm text-ink-muted">
          Toko: <b>{chosen[0]?.store}</b>. Nota lain yang tampil hanya dari toko ini.{' '}
          <button type="button" className="underline" onClick={() => onChange([])}>Ganti toko</button>
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !rows.length ? <p className="text-sm text-ink-muted">Memuat nota…</p> : !rows.length ? (
        <EmptyState title="Tidak ada nota yang bisa dipilih.">
          Nota kasir cabang ini yang berpelanggan, {LOAD_NOTE_DAYS} hari terakhir, tidak batal, dan belum dipakai laporan muat lain.
        </EmptyState>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {rows.map((n) => (
            <li key={n.transactionId}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2">
                <input type="checkbox" className="mt-1" checked={picked.has(n.transactionId)} onChange={() => toggle(n)} />
                <span className="text-sm">
                  <b>{n.store}</b> · {n.trxNumber}<br />
                  <span className="text-ink-muted">{n.trxOn} {n.at} · <span className="tabular-nums">{rupiah(n.amount)}</span></span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Laporan Muat (spec LT1 §15.1): bukti foto barang yang dimuat, untuk menjawab komplain toko. */
export function LoadReportsScreen({ rows, branches, filter }: { rows: LoadReportListRow[]; branches: LoadBranch[]; filter: Filter }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(branches[0]?.id ?? null);
  const [chosen, setChosen] = useState<CandidateNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!branchId || !chosen.length) return;
    setBusy(true);
    setError(null);
    const sent = await postJson('/api/logistics/load-reports', { action: 'create', branchId, transactionIds: chosen.map((n) => n.transactionId) });
    setBusy(false);
    if (!sent.ok) return setError(sent.error ?? 'Gagal menyimpan.');
    router.push(`/logistik/laporan-muat/${sent.data?.id}`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Bukti foto barang yang dimuat, untuk menjawab bila toko komplain. Pilih nota kasirnya, foto nota, foto barang, lalu tekan <b>Selesai</b>.
        Laporan ini hanya bukti: tidak menahan pengiriman dan tidak mengubah kasir.
      </p>
      {branches.length > 0 && (
        <Button onClick={() => { setChosen([]); setError(null); setOpen(true); }} className="min-h-12">Buat laporan muat</Button>
      )}
      <nav className="flex flex-wrap gap-1" aria-label="Tab laporan muat">
        {(Object.keys(TAB_LABELS) as LoadReportTab[]).map((t) => (
          <Link key={t} href={tabHref(filter, t)} className={buttonClass({ variant: t === filter.tab ? 'primary' : 'secondary', size: 'sm' })}>{TAB_LABELS[t]}</Link>
        ))}
      </nav>
      <form action="/logistik/laporan-muat" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={filter.tab} />
        <label className="text-sm">Dari <input type="date" name="dari" defaultValue={filter.from} className={selectClass} /></label>
        <label className="text-sm">Sampai <input type="date" name="sampai" defaultValue={filter.to} className={selectClass} /></label>
        <input name="cari" defaultValue={filter.q} placeholder="Nomor nota, toko, atau pembuat" className={`${selectClass} w-60`} />
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
      </form>
      {!rows.length ? <EmptyState title="Tidak ada laporan muat di rentang ini." /> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/logistik/laporan-muat/${r.id}`} className="block">
                <Card className="space-y-1 hover:border-primary">
                  <p className="inline-flex flex-wrap items-center gap-1">
                    <Badge tone={LOAD_STATUS_TONES[r.status]}>{r.statusLabel}</Badge>
                    <span className="font-medium">{r.store}</span>
                    <span className="text-sm text-ink-muted">· {r.branch}</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {r.notes.join(', ') || '—'} · foto nota {r.photos.NOTE}, foto barang {r.photos.GOODS}
                  </p>
                  <p className="text-sm text-ink-muted">Dibuat {r.by} · {r.on} {r.at}{r.doneAt && <> · Selesai {r.doneAt}</>}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= 200 && <Alert tone="warn">Hanya 200 laporan terbaru yang ditampilkan. Persempit tanggal atau pencarian.</Alert>}

      <Dialog
        open={open} onClose={() => setOpen(false)} title="Buat laporan muat"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} disabled={!chosen.length || !branchId} onClick={create}>Lanjut foto</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {branches.length > 1 && (
            <Field id="load-branch" label="Cabang">
              <Select id="load-branch" value={branchId ?? ''} onChange={(e) => { setBranchId(Number(e.target.value)); setChosen([]); }}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}
          {branchId && <NotePicker branchId={branchId} chosen={chosen} onChange={setChosen} />}
          {chosen.length > 0 && <p className="text-sm">Dipilih {chosen.length} nota untuk <b>{chosen[0].store}</b>.</p>}
        </div>
      </Dialog>
    </div>
  );
}

type Detail = NonNullable<Awaited<ReturnType<typeof loadReportDetail>>>;

function PhotoGrid({ photos, onRemove }: { photos: LoadPhotoView[]; onRemove?: (photo: LoadPhotoView) => void }) {
  if (!photos.length) return <p className="text-sm text-ink-muted">Belum ada foto.</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((p) => (
        <li key={p.id} className="space-y-1">
          <a href={p.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.label} className="aspect-[4/3] w-full rounded-lg bg-black object-cover" />
          </a>
          <p className="text-xs text-ink-muted">{p.by} · {p.at}{p.late && <> · <Badge tone="warn">susulan</Badge></>}</p>
          {onRemove && <Button size="sm" variant="secondary" onClick={() => onRemove(p)}>Buang</Button>}
        </li>
      ))}
    </ul>
  );
}

/** Rincian Laporan Muat (spec LT1 §15.1 butir 3–5, 8). */
export function LoadReportDetailScreen({ report }: { report: Detail }) {
  const router = useRouter();
  const toast = useToast();
  const [camera, setCamera] = useState<LoadPhotoKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addNotes, setAddNotes] = useState(false);
  const [extra, setExtra] = useState<CandidateNote[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function send(body: unknown, done?: string) {
    setBusy(true);
    setError(null);
    const sent = await postJson('/api/logistics/load-reports', body);
    setBusy(false);
    if (!sent.ok) {
      setError(sent.error ?? 'Gagal menyimpan.');
      return false;
    }
    if (done) toast(done, 'ok');
    router.refresh();
    return true;
  }

  async function upload(photo: Blob) {
    if (!camera) return;
    const form = new FormData();
    form.append('reportId', String(report.id));
    form.append('kind', camera);
    form.append('photo', photo, 'foto.jpg');
    if (await send(form, camera === 'NOTE' ? 'Foto nota tersimpan.' : 'Foto barang tersimpan.')) setCamera(null);
  }

  const notePhotos = report.photos.filter((p) => p.kind === 'NOTE');
  const goodsPhotos = report.photos.filter((p) => p.kind === 'GOODS');
  const late = report.status === 'DONE';
  const remove = report.canEditDraft ? (p: LoadPhotoView) => send({ action: 'remove_photo', reportId: report.id, photoId: p.id }, 'Foto dibuang.') : undefined;
  const canNote = report.canWork && report.counts.NOTE < LOAD_MAX_PHOTOS.NOTE;
  const canGoods = report.canWork && report.counts.NOTE > 0 && report.counts.GOODS < LOAD_MAX_PHOTOS.GOODS;

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-1">
        <p className="inline-flex flex-wrap items-center gap-1">
          <Badge tone={LOAD_STATUS_TONES[report.status]}>{report.statusLabel}</Badge>
          <span className="font-semibold">{report.store}</span>
          <span className="text-sm text-ink-muted">· {report.branch}</span>
        </p>
        {(report.address || report.phone) && <p className="text-sm text-ink-muted">{[report.address, report.phone].filter(Boolean).join(' · ')}</p>}
        <p className="text-sm text-ink-muted">Dibuat {report.by} · {report.createdAt}</p>
        {report.doneAt && <p className="text-sm text-ink-muted">Selesai {report.doneBy} · {report.doneAt}</p>}
        {report.cancelledAt && <p className="text-sm text-danger">Batal {report.cancelledBy} · {report.cancelledAt} · {report.cancelReason}</p>}
      </Card>

      <section className="space-y-2">
        <h2 className="font-semibold">Nota kasir</h2>
        <ul className="space-y-1">
          {report.notes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
              <span>
                <b>{n.trxNumber}</b> · <span className="tabular-nums">{rupiah(n.amount)}</span>
                {n.kasirAmount != null && n.kasirAmount !== n.amount && <> · <Badge tone="warn">kasir sekarang {rupiah(n.kasirAmount)}</Badge></>}
                {n.voided && <> · <Badge tone="danger">batal di kasir</Badge></>}
              </span>
              {report.canEditDraft && report.notes.length > 1 && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => send({ action: 'release_note', reportId: report.id, noteId: n.id }, 'Nota dilepas.')}>Lepas</Button>
              )}
            </li>
          ))}
        </ul>
        {report.canEditDraft && <Button size="sm" variant="secondary" onClick={() => { setExtra([]); setAddNotes(true); }}>Tambah nota toko ini</Button>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">1. Foto nota ({report.counts.NOTE}/{LOAD_MAX_PHOTOS.NOTE})</h2>
        <PhotoGrid photos={notePhotos} onRemove={remove} />
        {canNote && camera !== 'NOTE' && <Button variant={report.counts.NOTE ? 'secondary' : 'primary'} className="min-h-12" onClick={() => setCamera('NOTE')}>{late ? 'Tambah foto nota susulan' : 'Foto nota'}</Button>}
        {camera === 'NOTE' && <LiveCamera onPhoto={upload} onError={setError} label={busy ? 'Menyimpan…' : 'Ambil foto nota'} />}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. Foto barang ({report.counts.GOODS}/{LOAD_MAX_PHOTOS.GOODS})</h2>
        {report.counts.NOTE === 0 && report.status === 'DRAFT' ? <p className="text-sm text-ink-muted">Foto nota dulu, baru foto barang.</p> : <PhotoGrid photos={goodsPhotos} onRemove={remove} />}
        {canGoods && camera !== 'GOODS' && <Button variant={report.counts.GOODS ? 'secondary' : 'primary'} className="min-h-12" onClick={() => setCamera('GOODS')}>{late ? 'Tambah foto barang susulan' : 'Foto barang'}</Button>}
        {camera === 'GOODS' && <LiveCamera onPhoto={upload} onError={setError} label={busy ? 'Menyimpan…' : 'Ambil foto barang'} />}
      </section>

      {camera && <Button variant="secondary" onClick={() => setCamera(null)}>Tutup kamera</Button>}

      {report.canEditDraft && (
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-12" loading={busy} disabled={!report.counts.NOTE || !report.counts.GOODS} onClick={() => send({ action: 'finish', reportId: report.id }, 'Laporan muat selesai.')}>Selesai</Button>
          <Button variant="danger" disabled={busy} onClick={() => { setReason(''); setCancelOpen(true); }}>Batalkan laporan</Button>
        </div>
      )}
      {report.status === 'DRAFT' && <p className="text-sm text-ink-muted">Foto langsung tersimpan; laporan boleh ditinggal dan dilanjutkan. Sesudah Selesai, foto terkunci (hanya bisa menambah foto susulan).</p>}

      {report.removedPhotos.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">Foto yang dibuang selama Proses ({report.removedPhotos.length})</summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {report.removedPhotos.map((p) => <li key={p.id}>{p.label} · {p.by} · {p.at} · dibuang {p.removed} · <a href={p.url} target="_blank" rel="noreferrer" className="underline">Lihat</a></li>)}
          </ul>
        </details>
      )}

      <Dialog
        open={addNotes} onClose={() => setAddNotes(false)} title={`Tambah nota ${report.store}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAddNotes(false)}>Batal</Button><Button loading={busy} disabled={!extra.length} onClick={async () => { if (await send({ action: 'add_notes', reportId: report.id, transactionIds: extra.map((n) => n.transactionId) }, 'Nota ditambahkan.')) setAddNotes(false); }}>Tambah</Button></>}
      >
        <NotePicker branchId={report.branchId} customerId={report.customerId} chosen={extra} onChange={setExtra} />
      </Dialog>
      <Dialog
        open={cancelOpen} onClose={() => setCancelOpen(false)} title="Batalkan laporan muat"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setCancelOpen(false)}>Kembali</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={async () => { if (await send({ action: 'cancel', reportId: report.id, reason }, 'Laporan muat dibatalkan.')) setCancelOpen(false); }}>Batalkan</Button></>}
      >
        <Field id="load-cancel-reason" label="Alasan (wajib)">
          <Textarea id="load-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Contoh: salah pilih nota" />
        </Field>
        <p className="mt-2 text-sm text-ink-muted">Nota dilepas dan bisa dipakai laporan lain. Riwayat dan fotonya tetap tersimpan.</p>
      </Dialog>
    </div>
  );
}
