'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { COMPARISON_CAUSE_LABELS, MAX_COMPUTE, type ComparisonCause, type ComparisonComponent } from '../rules/comparison';
import { longDate, rupiah } from '../rules/salary';
import type { comparisonScreen } from '../server/comparison';

type Data = NonNullable<Awaited<ReturnType<typeof comparisonScreen>>>;
type Row = Data['rows'][number];
type Filter = 'ALL' | 'DIFF' | 'OPEN' | 'FIX';

const money = (v: number | null) => (v == null ? <span className="text-ink-muted">—</span> : <span className="tabular-nums">{rupiah(v)}</span>);

function Diff({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-muted">—</span>;
  if (value === 0) return <Badge tone="ok">Sama</Badge>;
  return <span className={`tabular-nums font-medium ${value > 0 ? 'text-ok' : 'text-danger'}`}>{value > 0 ? '+' : '−'}{rupiah(Math.abs(value))}</span>;
}

function Components({ title, items, total }: { title: string; items: ComparisonComponent[]; total: number | null }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {items.length === 0 && <p className="text-ink-muted">Tanpa rincian.</p>}
      {items.map((c, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span>{c.side === 'DEDUCTION' ? '− ' : ''}{c.label}</span>
          <span className="tabular-nums">{rupiah(c.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 border-t border-line pt-1 font-medium">
        <span>Total diterima</span>{money(total)}
      </div>
    </div>
  );
}

/** Rincian satu baris + isian sebab selisih (beda disengaja dengan nomor aturan, atau perlu diperbaiki). */
function RowDialog({ row, open, onClose, locked }: { row: Row | null; open: boolean; onClose: () => void; locked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [cause, setCause] = useState<ComparisonCause | ''>(row?.cause ?? '');
  const [ruleRef, setRuleRef] = useState(row?.ruleRef ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!row) return null;

  async function save() {
    if (!row) return;
    setError(null);
    if (cause === 'INTENDED' && !ruleRef.trim()) return setError('Beda disengaja wajib menyebut nomor aturan (mis. GAJ-54).');
    setBusy(true);
    const result = await postJson('/api/payroll/comparison', { kind: 'cause', slipId: row.id, cause: cause || null, ruleRef: ruleRef || null, note: note || null });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Sebab selisih disimpan.', 'ok');
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open} onClose={onClose} title={`${row.name} · ${row.kindLabel}${row.slipKind === 'MONTHLY' ? '' : ` ${longDate(row.slipStart)}`}`}
      footer={locked ? <Button variant="secondary" onClick={onClose}>Tutup</Button> : (
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan sebab'}</Button>
        </>
      )}
    >
      <div className="space-y-4 text-sm">
        <p className="text-ink-muted">Kode HRIS {row.code} · kode lama {row.legacyCode}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Components title="Slip lama" items={row.oldComponents} total={row.oldTotal} />
          <Components title="Hitungan HRIS" items={row.hrisComponents} total={row.hris} />
        </div>
        <p>Selisih (HRIS − lama): <Diff value={row.diff} /></p>
        {row.firstTotal != null && row.secondTotal != null && (
          <p className="text-ink-muted">Hitungan 1: {rupiah(row.firstTotal)} · hitung ulang: {rupiah(row.secondTotal)}</p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field id="cmp-cause" label="Sebab selisih">
          <Select id="cmp-cause" value={cause} disabled={locked} onChange={(e) => setCause(e.target.value as ComparisonCause | '')}>
            <option value="">Belum dijelaskan</option>
            <option value="INTENDED">{COMPARISON_CAUSE_LABELS.INTENDED}</option>
            <option value="FIX">{COMPARISON_CAUSE_LABELS.FIX}</option>
          </Select>
        </Field>
        {cause === 'INTENDED' && (
          <Field id="cmp-rule" label="Nomor aturan" hint="Aturan baru yang membuat angkanya memang berbeda, mis. GAJ-54.">
            <Input id="cmp-rule" value={ruleRef} maxLength={40} disabled={locked} onChange={(e) => setRuleRef(e.target.value)} />
          </Field>
        )}
        <Field id="cmp-note" label="Catatan (boleh kosong)">
          <Textarea id="cmp-note" value={note} maxLength={500} rows={3} disabled={locked} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {row.decidedBy && <p className="text-ink-muted">Terakhir diisi {row.decidedBy}, {row.decidedAt}.</p>}
      </div>
    </Dialog>
  );
}

/** Lembar Banding (spec L9 §4 butir 4; SIS-15, 16): per orang angka HRIS, angka lama, selisih, dan sebabnya. Hanya Pemilik/GM. */
export function ComparisonScreen({ data }: { data: Data }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [open, setOpen] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data.run || !data.summary) {
    return (
      <EmptyState title="Belum ada data uji banding">
        Data salinan sistem lama dimuat lewat skrip <code>comparison-load</code> di staging (spec L9 §4). Sesudah dimuat, lembarnya muncul di sini.
      </EmptyState>
    );
  }
  const { run, summary } = data;
  const locked = run.status !== 'LOADED';
  const rows = data.rows.filter((r) => (filter === 'DIFF' ? r.diff != null && r.diff !== 0
    : filter === 'OPEN' ? r.diff != null && r.diff !== 0 && !r.cause
      : filter === 'FIX' ? r.cause === 'FIX' : true));

  async function compute() {
    setError(null);
    setBusy(true);
    const result = await postJson('/api/payroll/comparison', { kind: 'compute', runId: run.id });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menghitung.');
    toast(`${result.data?.computed ?? 0} slip dihitung HRIS.`, 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Periode {run.periodText}</p>
        <NewBadge feature="/gaji/uji-banding" />
        {locked && <Badge tone="warn">Data salinan sudah dihapus</Badge>}
      </div>
      {data.runs.length > 1 && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <Field id="cmp-run" label="Uji banding">
            <Select id="cmp-run" name="uji" defaultValue={String(run.id)}>
              {data.runs.map((r) => <option key={r.id} value={r.id}>#{r.id} {r.label}{r.status === 'PURGED' ? ' (dihapus)' : ''}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">Tampilkan</Button>
        </form>
      )}
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>{summary.total} slip</span>
          <span>{summary.same} sama</span>
          <span>{summary.differing} berbeda</span>
          <span className={summary.unexplained ? 'font-medium text-warn' : ''}>{summary.unexplained} belum dijelaskan</span>
          <span>{summary.toFix} perlu diperbaiki</span>
        </div>
        <p className="text-ink-muted">
          {run.computedCount === 0 && 'HRIS belum menghitung. Tekan Hitung untuk menyimpan hitungan pertama.'}
          {run.computedCount === 1 && 'Hitungan pertama tersimpan. Sesudah yang "perlu diperbaiki" dibetulkan, HRIS boleh menghitung ulang satu kali.'}
          {run.computedCount >= MAX_COMPUTE && 'Hitung ulang sudah dipakai. Keputusan selanjutnya di tangan Pemilik.'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {summary.canCompute && (
            <HoldButton onClick={compute} disabled={busy}>{busy ? 'Menghitung…' : run.computedCount === 0 ? 'Hitung' : 'Hitung ulang (sekali)'}</HoldButton>
          )}
          <a className={buttonClass({ variant: 'secondary' })} href={`/api/payroll/comparison/csv?uji=${run.id}`}>Unduh CSV</a>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {([['ALL', 'Semua'], ['DIFF', 'Berbeda'], ['OPEN', 'Belum dijelaskan'], ['FIX', 'Perlu diperbaiki']] as [Filter, string][]).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? 'primary' : 'secondary'} onClick={() => setFilter(key)}>{label}</Button>
        ))}
      </div>
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Tidak ada baris untuk saringan ini."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (r) => <button type="button" className="text-left underline" onClick={() => setOpen(r)}>{r.name}</button> },
          { key: 'kind', header: 'Slip', render: (r) => (r.slipKind === 'MONTHLY' ? r.kindLabel : `${r.kindLabel} ${longDate(r.slipStart)}`) },
          { key: 'old', header: 'Angka lama', render: (r) => money(r.oldTotal) },
          { key: 'hris', header: 'Angka HRIS', render: (r) => money(r.hris) },
          { key: 'diff', header: 'Selisih', render: (r) => <Diff value={r.diff} /> },
          {
            key: 'cause', header: 'Sebab', render: (r) => (r.cause
              ? <span>{COMPARISON_CAUSE_LABELS[r.cause]}{r.ruleRef ? ` (${r.ruleRef})` : ''}</span>
              : r.diff ? <span className="text-warn">Belum dijelaskan</span> : <span className="text-ink-muted">—</span>),
          },
        ]}
      />
      <RowDialog key={open?.id ?? 0} row={open} open={Boolean(open)} onClose={() => setOpen(null)} locked={locked} />
    </div>
  );
}
