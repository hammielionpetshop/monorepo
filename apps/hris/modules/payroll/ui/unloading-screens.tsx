'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';
import { kgText, type UnloadingStatus } from '../rules/unloading';

const TONE: Record<UnloadingStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  PENDING: 'warn', ACTIVE: 'info', PAID: 'ok', REJECTED: 'danger', WITHDRAWN: 'info', CANCELLED: 'danger',
};
const TABS = [['UNPAID', 'Belum dibayar'], ['PENDING', 'Menunggu persetujuan'], ['ALL', 'Semua'], ['OTHER', 'Barang lain']] as const;

type ListRow = {
  id: number; number: string; workDate: string; supplierName: string; totalKg: string; totalPay: number; participants: number;
  status: UnloadingStatus; statusLabel: string; flags: string[]; createdBy: string; requestId: number | null;
};
type OtherData = {
  reports: number; lines: number; kg: string; percent: string; byCreator: { name: string; lines: number; kg: string }[];
  rows: { itemId: number; reportId: number; number: string; workDate: string; name: string; kg: string; reason: string; createdBy: string; linkedName: string | null }[];
};

/** DRV-L11 Laporan Bongkaran: Belum dibayar (tanpa batas umur), Menunggu persetujuan, Semua (periode 26–25), Barang lain. */
export function UnloadingListScreen({ tab, from, to, q, head, rows, other, canCreate, canLinkOther }: {
  tab: string; from: string; to: string; q: string; canCreate: boolean; canLinkOther: boolean;
  head: { today: { count: number; kg: string; pay: number }; unpaid: { count: number; pay: number; oldest: string | null }; pending: number };
  rows: ListRow[]; other: OtherData | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Hari ini</p><p className="font-semibold">{head.today.count} laporan · {kgText(head.today.kg)} kg · {rupiah(head.today.pay)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Belum dibayar</p><p className="font-semibold">{head.unpaid.count} · {rupiah(head.unpaid.pay)}</p>{head.unpaid.oldest && <p className="text-xs text-ink-muted">paling lama {longDate(head.unpaid.oldest)}</p>}</Card>
        <Card><p className="text-sm text-ink-muted">Menunggu persetujuan</p><p className="font-semibold">{head.pending}</p></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(([key, label]) => (
          <Link key={key} href={key === 'UNPAID' ? '/gaji/bongkaran' : `/gaji/bongkaran?tab=${key}`} className={buttonClass({ variant: key === tab ? 'primary' : 'secondary', size: 'sm' })}>{label}</Link>
        ))}
        {canCreate && <Link className={buttonClass({})} href="/gaji/bongkaran/baru">Laporan baru</Link>}
        <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} href="/gaji/bongkaran/berat">Berat per satuan</Link>
      </div>
      {(tab === 'ALL' || tab === 'OTHER') && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <Field id="ul-from" label="Dari"><Input id="ul-from" type="date" name="dari" defaultValue={from} /></Field>
          <Field id="ul-to" label="Sampai"><Input id="ul-to" type="date" name="sampai" defaultValue={to} /></Field>
          {tab === 'ALL' && <Field id="ul-q" label="Cari nomor atau supplier"><Input id="ul-q" name="cari" defaultValue={q} /></Field>}
          <Button type="submit" variant="secondary">Tampilkan</Button>
        </form>
      )}
      {tab === 'OTHER' && other ? <OtherItems data={other} canLink={canLinkOther} /> : (
        <DataList
          rows={rows}
          rowKey={(r) => r.id}
          empty={tab === 'UNPAID' ? 'Tidak ada laporan yang belum dibayar.' : tab === 'PENDING' ? 'Tidak ada laporan terlambat yang menunggu.' : 'Belum ada laporan di rentang ini.'}
          columns={[
            { key: 'number', header: 'Nomor', primary: true, render: (r) => <Link className="underline" href={`/gaji/bongkaran/${r.id}`}>{r.number}</Link> },
            { key: 'date', header: 'Tanggal kerja', render: (r) => longDate(r.workDate) },
            { key: 'supplier', header: 'Supplier', render: (r) => r.supplierName },
            { key: 'kg', header: 'Total kg', render: (r) => <span className="tabular-nums">{kgText(r.totalKg)}</span> },
            { key: 'people', header: 'Peserta', render: (r) => r.participants },
            { key: 'pay', header: 'Total upah', render: (r) => <span className="tabular-nums">{rupiah(r.totalPay)}</span> },
            {
              key: 'status', header: 'Status', render: (r) => (
                <span className="flex flex-wrap gap-1"><Badge tone={TONE[r.status]}>{r.statusLabel}</Badge>{r.flags.map((f) => <Badge key={f} tone="warn">{f}</Badge>)}</span>
              ),
            },
            { key: 'by', header: 'Pembuat', render: (r) => r.createdBy },
          ]}
        />
      )}
    </div>
  );
}

function OtherItems({ data, canLink }: { data: OtherData; canLink: boolean }) {
  const [target, setTarget] = useState<OtherData['rows'][number] | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm">{data.reports} laporan memuat Barang lain · {data.lines} baris · {kgText(data.kg)} kg ({data.percent}% dari seluruh kg).</p>
      {data.byCreator.length > 0 && <p className="text-sm text-ink-muted">Per pembuat: {data.byCreator.map((c) => `${c.name} ${c.lines} baris (${kgText(c.kg)} kg)`).join(', ')}</p>}
      <DataList
        rows={data.rows}
        rowKey={(r) => r.itemId}
        empty="Tidak ada Barang lain di rentang ini."
        columns={[
          { key: 'name', header: 'Nama diketik', primary: true, render: (r) => r.name },
          { key: 'report', header: 'Laporan', render: (r) => <Link className="underline" href={`/gaji/bongkaran/${r.reportId}`}>{r.number}</Link> },
          { key: 'date', header: 'Tanggal', render: (r) => longDate(r.workDate) },
          { key: 'kg', header: 'Kg', render: (r) => kgText(r.kg) },
          { key: 'reason', header: 'Alasan', render: (r) => r.reason },
          { key: 'by', header: 'Pembuat', render: (r) => r.createdBy },
          { key: 'link', header: 'Status', render: (r) => (r.linkedName ? `Dipasangkan ke ${r.linkedName}` : 'Belum dipasangkan') },
          { key: 'act', header: '', render: (r) => (canLink ? <Button size="sm" variant="ghost" onClick={() => setTarget(r)}>{r.linkedName ? 'Ubah pasangan' : 'Pasangkan ke produk'}</Button> : null) },
        ]}
      />
      {target && <LinkDialog row={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function LinkDialog({ row, onClose }: { row: OtherData['rows'][number]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(row.name);
  const [results, setResults] = useState<{ productId: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function search() {
    const res = await fetch(`/api/unloading/products?q=${encodeURIComponent(query)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const seen = new Map<number, string>();
    for (const u of res?.units ?? []) seen.set(u.productId, u.name);
    setResults([...seen].map(([productId, name]) => ({ productId, name })));
  }
  async function link(productId: number | null) {
    const result = await postJson('/api/unloading', { kind: 'other_link', itemId: row.itemId, productId });
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(productId ? 'Dipasangkan. Kg dan upah laporan itu tidak berubah.' : 'Pasangan dilepas.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title="Pasangkan Barang lain ke produk" footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}>
      <div className="space-y-3">
        <p>«{row.name}» di {row.number}. Memasangkan tidak mengubah kg dan upah laporan itu; nama ini menjadi saran pencarian berikutnya.</p>
        <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} /><Button variant="secondary" onClick={search}>Cari</Button></div>
        <ul className="space-y-1">{results.map((r) => <li key={r.productId}><Button size="sm" variant="ghost" onClick={() => link(r.productId)}>{r.name}</Button></li>)}</ul>
        {row.linkedName && <Button size="sm" variant="ghost" onClick={() => link(null)}>Lepas pasangan</Button>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

type Detail = {
  id: number; number: string; status: UnloadingStatus; statusLabel: string; workDate: string; supplierName: string; createdBy: string; createdAt: string;
  rate: number; totalKg: string; totalPay: number; version: number; requestId: number | null; lateReason: string | null; costBranch: string | null;
  flags: { label: string; explain: string }[];
  items: { id: number; name: string; uomName: string | null; quantity: string | null; weightKg: string | null; lineKg: string; other: boolean; otherReason: string | null; linkedName: string | null; weightFlagged: boolean }[];
  shares: { id: number; name: string; casual: boolean; amount: number; plusOne: boolean; status: string; look: { status: string | null; done: boolean } | null }[];
  photos: { id: number; kind: string }[];
  history: { at: string; text: string }[];
};

const timeText = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

/** DRV-L13 Rincian Laporan Bongkaran. Tombol bayar dan koreksi menyusul di L8b. */
export function UnloadingDetailScreen({ data }: { data: Detail }) {
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="flex flex-wrap items-center gap-2"><Badge tone={TONE[data.status]}>{data.statusLabel}</Badge>{data.version > 1 && <Badge tone="warn">Versi {data.version}</Badge>}</p>
        <p>{data.supplierName} · tanggal kerja <b>{longDate(data.workDate)}</b></p>
        <p className="text-sm text-ink-muted">Dibuat {data.createdBy}, {timeText(data.createdAt)}{data.costBranch ? ` · biaya dibebankan ke ${data.costBranch}` : ''}</p>
        {data.lateReason && <p className="text-sm">Alasan terlambat: {data.lateReason}</p>}
        {data.status === 'PENDING' && data.requestId && <Link className="text-sm underline" href={`/persetujuan/${data.requestId}`}>Lihat pengajuan persetujuan</Link>}
        {data.flags.length > 0 && (
          <ul className="space-y-1 text-sm">{data.flags.map((f) => <li key={f.label}><Badge tone="warn">{f.label}</Badge> <span className="text-ink-muted">{f.explain}</span></li>)}</ul>
        )}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Barang</h2>
        <DataList
          rows={data.items}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Barang', primary: true, render: (r) => <span>{r.name} {r.other && <Badge tone="warn">Barang lain</Badge>}{r.weightFlagged && <Badge tone="warn">Berat berubah</Badge>}</span> },
            { key: 'qty', header: 'Jumlah', render: (r) => (r.quantity ? `${kgText(r.quantity)} ${r.uomName}` : '-') },
            { key: 'weight', header: 'Berat per satuan', render: (r) => (r.weightKg ? `${kgText(r.weightKg)} kg` : '-') },
            { key: 'kg', header: 'Kg', render: (r) => <span className="tabular-nums">{kgText(r.lineKg)}</span> },
            { key: 'note', header: 'Keterangan', render: (r) => (r.other ? `${r.otherReason ?? ''}${r.linkedName ? ` · dipasangkan ke ${r.linkedName}` : ''}` : '') },
          ]}
        />
        <p className="text-sm">Total <b className="tabular-nums">{kgText(data.totalKg)} kg</b> × {rupiah(data.rate)} = <b className="tabular-nums">{rupiah(data.totalPay)}</b></p>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Peserta</h2>
        <DataList
          rows={data.shares}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (r) => <span>{r.name}{r.casual ? <span className="text-ink-muted"> · pekerja lepas</span> : null}</span> },
            { key: 'amount', header: 'Bagian', render: (r) => <span className="tabular-nums">{rupiah(r.amount)}{r.plusOne && <span className="text-xs text-ink-muted"> +Rp1</span>}</span> },
            { key: 'look', header: 'Catatan', render: (r) => (r.look ? <Badge tone={r.look.done ? 'info' : 'warn'}>Hari itu {r.look.status}{r.look.done ? ' · sudah dilihat HR' : ' · perlu dilihat HR'}</Badge> : r.status === 'PENDING' ? 'Belum berlaku' : '') },
          ]}
        />
      </Card>
      {data.photos.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">{data.photos[0].kind === 'GOODS' ? 'Foto barang (tanpa surat jalan)' : 'Foto surat jalan'}</h2>
          <div className="flex flex-wrap gap-2">
            {data.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={p.id} href={`/api/unloading/photos/${p.id}`} target="_blank" rel="noreferrer"><img src={`/api/unloading/photos/${p.id}`} alt="Foto laporan" className="h-32 w-32 rounded-card border border-line object-cover" /></a>
            ))}
          </div>
        </Card>
      )}
      <Card className="space-y-1">
        <h2 className="font-semibold">Riwayat</h2>
        <ul className="text-sm">{data.history.map((h, i) => <li key={i}>{timeText(h.at)} · {h.text}</li>)}</ul>
      </Card>
    </div>
  );
}

type Change = {
  id: number; productName: string; uomName: string; fromKg: string | null; toKg: string; percent: string | null; reason: string | null; by: string; at: string;
  report: { id: number; number: string } | null; flagged: boolean; reviewed: { by: string; note: string | null } | null;
};
type WeightRow = { productId: number; uomId: number; productName: string; uomName: string; kg: string; by: string; on: string; used: number; history: Change[] };

/** DRV-L14 Berat per Satuan: Semua berat (+ riwayat, Ubah berat) dan Berat berubah (Sudah dilihat). */
export function UnloadingWeightsScreen({ tab, canEdit, canReview, changedCount, weights, changed }: {
  tab: 'ALL' | 'CHANGED'; canEdit: boolean; canReview: boolean; changedCount: number; weights: WeightRow[]; changed: Change[];
}) {
  const [edit, setEdit] = useState<WeightRow | null>(null);
  const [review, setReview] = useState<Change | null>(null);
  const changeText = (c: Change) => `${c.fromKg ? `${kgText(c.fromKg)} → ` : 'diisi '}${kgText(c.toKg)} kg${c.percent ? ` (${c.percent}%)` : ''}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/gaji/bongkaran/berat" className={buttonClass({ variant: tab === 'ALL' ? 'primary' : 'secondary', size: 'sm' })}>Semua berat</Link>
        <Link href="/gaji/bongkaran/berat?tab=CHANGED" className={buttonClass({ variant: tab === 'CHANGED' ? 'primary' : 'secondary', size: 'sm' })}>Berat berubah ({changedCount})</Link>
      </div>
      {tab === 'ALL' ? (
        <DataList
          rows={weights}
          rowKey={(r) => `${r.productId}:${r.uomId}`}
          empty="Belum ada berat tersimpan. Berat diisi saat bongkaran pertama."
          columns={[
            { key: 'name', header: 'Produk', primary: true, render: (r) => `${r.productName} · ${r.uomName}` },
            { key: 'kg', header: 'Berat', render: (r) => `${kgText(r.kg)} kg` },
            { key: 'by', header: 'Diisi', render: (r) => `${r.by}, ${longDate(r.on)}` },
            { key: 'used', header: 'Dipakai', render: (r) => `${r.used} laporan` },
            {
              key: 'history', header: 'Riwayat', render: (r) => (
                <details className="text-sm"><summary className="cursor-pointer">{r.history.length} perubahan</summary>
                  <ul>{r.history.map((c) => <li key={c.id}>{timeText(c.at)} · {changeText(c)} · {c.by}{c.report ? ` · ${c.report.number}` : ''}{c.reason ? ` · ${c.reason}` : ''}</li>)}</ul>
                </details>
              ),
            },
            { key: 'act', header: '', render: (r) => (canEdit ? <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Ubah berat</Button> : null) },
          ]}
        />
      ) : (
        <DataList
          rows={changed}
          rowKey={(r) => r.id}
          empty="Tidak ada perubahan berat yang perlu dilihat."
          columns={[
            { key: 'name', header: 'Produk', primary: true, render: (r) => `${r.productName} · ${r.uomName}` },
            { key: 'change', header: 'Perubahan', render: changeText },
            { key: 'by', header: 'Oleh', render: (r) => `${r.by}, ${timeText(r.at)}` },
            { key: 'report', header: 'Laporan', render: (r) => (r.report ? <Link className="underline" href={`/gaji/bongkaran/${r.report.id}`}>{r.report.number}</Link> : 'Di luar laporan') },
            { key: 'reason', header: 'Alasan', render: (r) => r.reason ?? '-' },
            { key: 'act', header: '', render: (r) => (canReview ? <Button size="sm" variant="ghost" onClick={() => setReview(r)}>Sudah dilihat</Button> : null) },
          ]}
        />
      )}
      <p className="text-sm text-ink-muted">Berat baru hanya berlaku untuk laporan sesudahnya; laporan lama memakai salinan beratnya sendiri. Perubahan di atas ambang ditandai untuk Pemilik dan GM, tanpa menahan laporan atau pembayaran.</p>
      {edit && <WeightDialog row={edit} onClose={() => setEdit(null)} />}
      {review && <ReviewDialog title="Sudah dilihat" text={`${review.productName}: ${changeText(review)}`} body={{ kind: 'weight_review', id: review.id }} onClose={() => setReview(null)} />}
    </div>
  );
}

function WeightDialog({ row, onClose }: { row: WeightRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [kg, setKg] = useState(row.kg);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/unloading', { kind: 'weight_change', productId: row.productId, uomId: row.uomId, weightKg: kg, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Berat diubah; berlaku untuk laporan berikutnya.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={`Ubah berat ${row.productName}`}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></>}>
      <div className="space-y-3">
        <Field id="uw-kg" label={`Berat per ${row.uomName} (kg)`}><Input id="uw-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
        <Field id="uw-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="uw-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function ReviewDialog({ title, text, body, onClose }: { title: string; text: string; body: Record<string, unknown>; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/unloading', { ...body, note: note.trim() || null });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Ditandai sudah dilihat.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><HoldButton loading={busy} onClick={save}>Sudah dilihat</HoldButton></>}>
      <div className="space-y-3">
        <p>{text}</p>
        <Field id="rv-note" label="Catatan (pilihan)"><Textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

type LookRow = { id: number; name: string; workDate: string; number: string; status: string; done: { by: string; note: string | null } | null };

/** Peserta bongkaran yang hari itu tercatat izin, sakit, cuti, atau alpha (DRV-107): untuk HR, tanpa nominal. */
export function UnloadingLookScreen({ rows, canReview }: { rows: LookRow[]; canReview: boolean }) {
  const [target, setTarget] = useState<LookRow | null>(null);
  return (
    <div className="space-y-3">
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Tidak ada peserta bongkaran yang perlu dilihat."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (r) => r.name },
          { key: 'text', header: 'Keterangan', render: (r) => `Tercatat ${r.status} ${longDate(r.workDate)}, tetapi ikut bongkaran ${r.number}` },
          { key: 'done', header: 'Status', render: (r) => (r.done ? `Sudah dilihat ${r.done.by}${r.done.note ? ` · ${r.done.note}` : ''}` : <Badge tone="warn">Perlu dilihat</Badge>) },
          { key: 'act', header: '', render: (r) => (canReview && !r.done ? <Button size="sm" variant="ghost" onClick={() => setTarget(r)}>Sudah dilihat</Button> : null) },
        ]}
      />
      <p className="text-sm text-ink-muted">Bagian upahnya tetap dibayar (DRV-44). Bila status hari itu keliru, betulkan di Kehadiran.</p>
      {target && <ReviewDialog title="Sudah dilihat" text={`${target.name} tercatat ${target.status} ${longDate(target.workDate)} dan ikut bongkaran ${target.number}.`} body={{ kind: 'look_review', id: target.id }} onClose={() => setTarget(null)} />}
    </div>
  );
}
