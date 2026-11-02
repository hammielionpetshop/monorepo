'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';

type ShiftRow = {
  id: number; posShiftId: number; shiftNumber: number; branchName: string; closedOn: string; category: 'MINUS' | 'PLUS' | 'ANOMALY' | 'TOLERATED';
  shiftVariance: number | null; cash: number; sharePct: number; amount: number; posUser: string; waiveReason: string | null; posChangedNote: string | null;
};
type Approval = { id: number; sequence: number; status: 'OPEN' | 'REVIEWED' | 'APPROVED'; rowIds: number[]; reviewedBy: string | null; approvedBy: string | null };
type Group = { employeeId: number; name: string; rows: ShiftRow[]; approvals: Approval[]; pendingRowCount: number; net: number; minus: number; plus: number; approvedNet: number };
type Manual = {
  id: number; branchName: string; occurredOn: string; amount: number; reason: string; named: string | null; status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED';
  requestId: number | null; recordedBy: string; shares: { name: string; amount: number }[];
};

const MANUAL_STATUS = { PENDING: 'Menunggu pengesahan', ACTIVE: 'Berlaku', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' } as const;
const signed = (amount: number) => (amount < 0 ? `−${rupiah(-amount)}` : amount > 0 ? `+${rupiah(amount)}` : rupiah(0));

/** GAJ-L15 Minus Kas: dari shift POS (angka laporan Minus Kasir) dan catat tangan. */
export function CashShortageScreen(props: {
  period: { start: string; end: string; label: string }; periods: { start: string; label: string }[]; today: string; periodEnded: boolean;
  groups: Group[]; unlinked: ShiftRow[]; anomalies: ShiftRow[]; manual: Manual[];
  can: { review: boolean; approve: boolean; record: boolean }; me: number | null;
  labels: { category: Record<string, string>; approval: Record<string, string> };
  initialTab: 'pos' | 'manual' | 'check';
}) {
  const { period, periods, groups, unlinked, anomalies, manual, can, labels } = props;
  const [tab, setTab] = useState(props.initialTab);
  const [approving, setApproving] = useState<{ group: Group; approval: Approval } | null>(null);
  const [cancelling, setCancelling] = useState<Manual | null>(null);
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(key: string, body: Record<string, unknown>, done: string) {
    setBusyId(key);
    const result = await postJson('/api/payroll', body);
    setBusyId(null);
    if (!result.ok) return toast(result.error ?? 'Gagal.', 'danger');
    toast(done, 'ok');
    router.refresh();
  }

  const checkCount = unlinked.length + anomalies.length;
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="cs-period" label="Periode">
          <Select id="cs-period" name="periode" defaultValue={period.start}>{periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}</Select>
        </Field>
        <input type="hidden" name="tab" value={tab} />
        <Button type="submit" variant="secondary">Tampilkan</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'pos' ? 'primary' : 'secondary'} onClick={() => setTab('pos')}>Dari POS</Button>
        <Button size="sm" variant={tab === 'manual' ? 'primary' : 'secondary'} onClick={() => setTab('manual')}>Catat tangan</Button>
        <Button size="sm" variant={tab === 'check' ? 'primary' : 'secondary'} onClick={() => setTab('check')}>Perlu diperiksa{checkCount ? ` (${checkCount})` : ''}</Button>
        <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} href="/potongan/minus-kas/tautan">Tautan Akun Kasir</Link>
      </div>

      {tab === 'pos' && (
        <div className="space-y-3">
          <Alert tone="info">
            Angka per kasir sama dengan laporan POS Laporan Shift › Minus Kasir: selisih shift yang sudah diverifikasi Finance, dibagi menurut porsi kas tunai.
            Minus tidak langsung dipotong: sesudah periode berakhir (tanggal 26) sistem membuat usulan per orang, HR meninjau, lalu Pemilik atau GM mengesahkan.
            Yang dipotong = minus dikurangi lebih di periode yang sama, paling kecil Rp0.
          </Alert>
          {!groups.length && <Card><p className="text-sm text-ink-muted">Belum ada minus atau lebih kas yang tertaut ke karyawan di periode ini.</p></Card>}
          {groups.map((g) => (
            <Card key={g.employeeId} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <b>{g.name}</b>
                <span className="text-sm">minus {rupiah(g.minus)} · lebih {rupiah(g.plus)} · bersih <b className="tabular-nums">{rupiah(g.net)}</b></span>
                {g.approvedNet > 0 && <Badge tone="ok">Disahkan {rupiah(g.approvedNet)}</Badge>}
                {g.pendingRowCount > 0 && <Badge tone="info">{g.pendingRowCount} shift belum diusulkan</Badge>}
              </div>
              <ShiftTable rows={g.rows} labels={labels} />
              {g.approvals.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Usulan {a.sequence === 1 ? '' : `susulan ${a.sequence - 1} `}({a.rowIds.length} shift):</span>
                  <Badge tone={a.status === 'APPROVED' ? 'ok' : a.status === 'REVIEWED' ? 'info' : 'warn'}>{labels.approval[a.status]}</Badge>
                  {a.reviewedBy && <span className="text-ink-muted">ditinjau {a.reviewedBy}</span>}
                  {a.approvedBy && <span className="text-ink-muted">disahkan {a.approvedBy}</span>}
                  {a.status === 'OPEN' && can.review && g.employeeId !== props.me && (
                    <Button size="sm" variant="secondary" loading={busyId === `r${a.id}`} onClick={() => act(`r${a.id}`, { kind: 'shortage_review', id: a.id }, 'Ditinjau. Menunggu Pemilik atau GM.')}>Tandai ditinjau</Button>
                  )}
                  {a.status !== 'APPROVED' && can.approve && g.employeeId !== props.me && (
                    <Button size="sm" onClick={() => setApproving({ group: g, approval: a })}>Sahkan…</Button>
                  )}
                </div>
              ))}
              {g.pendingRowCount > 0 && can.review && !props.periodEnded && (
                <Button size="sm" variant="ghost" loading={busyId === `p${g.employeeId}`} onClick={() => act(`p${g.employeeId}`, { kind: 'shortage_propose_now', employeeId: g.employeeId }, 'Usulan dibuat.')}>
                  Usulkan sekarang (periode berjalan, mis. orangnya berhenti)
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-ink-muted">Hanya untuk kejadian di luar shift POS, dengan alasan yang menjelaskan kenapa tidak lewat POS.</p>
            {can.record && <Link className={buttonClass({ size: 'sm' })} href="/potongan/minus-kas/catat">Catat Minus Kas</Link>}
          </div>
          <DataList
            rows={manual}
            rowKey={(m) => String(m.id)}
            empty="Belum ada minus kas catat tangan di periode ini."
            columns={[
              { key: 'date', header: 'Tanggal', primary: true, render: (m) => `${longDate(m.occurredOn)} · ${m.branchName}` },
              { key: 'amount', header: 'Nilai', render: (m) => <span className="tabular-nums">{rupiah(m.amount)}</span> },
              { key: 'who', header: 'Penanggung', render: (m) => (m.shares.length ? m.shares.map((s) => `${s.name} ${rupiah(s.amount)}`).join(', ') : m.named ?? 'Tanpa nama') },
              { key: 'reason', header: 'Alasan', render: (m) => m.reason },
              { key: 'status', header: 'Status', render: (m) => <Badge tone={m.status === 'ACTIVE' ? 'ok' : m.status === 'PENDING' ? 'warn' : 'danger'}>{MANUAL_STATUS[m.status]}</Badge> },
              {
                key: 'act', header: '', render: (m) => (m.status === 'PENDING' && m.requestId
                  ? <Link className="underline text-sm" href={`/persetujuan/${m.requestId}`}>Lihat usulan</Link>
                  : m.status === 'ACTIVE' && can.approve ? <Button size="sm" variant="ghost" onClick={() => setCancelling(m)}>Batalkan</Button> : null),
              },
            ]}
          />
        </div>
      )}

      {tab === 'check' && (
        <div className="space-y-3">
          <Card className="space-y-2">
            <h2 className="font-medium">Akun kasir belum ditautkan ke karyawan</h2>
            <p className="text-sm text-ink-muted">Minusnya menunggu dan tidak hilang. Tautkan di <Link className="underline" href="/potongan/minus-kas/tautan">Tautan Akun Kasir</Link>.</p>
            <ShiftTable rows={unlinked} labels={labels} showUser />
          </Card>
          <Card className="space-y-2">
            <h2 className="font-medium">Shift tak wajar — periksa dulu</h2>
            <p className="text-sm text-ink-muted">Selisih sebesar batas tak wajar laporan Minus Kasir atau lebih (kemungkinan salah input). Tidak pernah menjadi potongan; betulkan angkanya di POS, lalu terbaca ulang malam berikutnya.</p>
            <ShiftTable rows={anomalies} labels={labels} showUser />
          </Card>
        </div>
      )}

      <ApproveDialog target={approving} onClose={() => setApproving(null)} />
      <CancelManualDialog target={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

function ShiftTable({ rows, labels, showUser }: { rows: ShiftRow[]; labels: { category: Record<string, string> }; showUser?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">Tidak ada.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-ink-muted"><th>Tutup</th><th>Cabang · shift</th>{showUser && <th>Akun kasir</th>}<th className="text-right">Selisih shift</th><th className="text-right">Porsi kas</th><th className="text-right">Bagian</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.waiveReason ? 'text-ink-muted line-through' : undefined}>
              <td>{longDate(r.closedOn)}</td>
              <td>{r.branchName} · #{r.shiftNumber}</td>
              {showUser && <td>{r.posUser}</td>}
              <td className="text-right tabular-nums">{r.shiftVariance == null ? '—' : signed(r.shiftVariance)}</td>
              <td className="text-right tabular-nums">{r.sharePct}%</td>
              <td className="text-right tabular-nums">{r.category === 'ANOMALY' ? labels.category.ANOMALY : signed(r.amount)}</td>
              <td className="text-xs">{r.waiveReason ? `Ditiadakan: ${r.waiveReason}` : r.posChangedNote ?? (r.category === 'TOLERATED' ? labels.category.TOLERATED : '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApproveDialog({ target, onClose }: { target: { group: Group; approval: Approval } | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [waived, setWaived] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const rows = target.group.rows.filter((r) => target.approval.rowIds.includes(r.id));
  let minus = 0;
  let plus = 0;
  for (const r of rows) {
    if (r.id in waived) continue;
    if (r.amount < 0) minus -= r.amount; else plus += r.amount;
  }
  const net = Math.max(0, minus - plus);
  function close() { setWaived({}); setError(null); onClose(); }
  async function save() {
    if (!target) return;
    if (Object.values(waived).some((reason) => !reason.trim())) return setError('Isi alasan untuk tiap shift yang ditiadakan.');
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'shortage_approve', id: target.approval.id, waivers: Object.entries(waived).map(([rowId, reason]) => ({ rowId: Number(rowId), reason })) });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengesahkan.');
    toast(`Minus kas ${target.group.name} disahkan ${rupiah(net)}. ${target.group.name} diberi tahu.`, 'ok');
    close();
    router.refresh();
  }
  return (
    <Dialog open onClose={close} title={`Sahkan minus kas ${target.group.name}`}
      footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton loading={busy} onClick={save}>Sahkan {rupiah(net)}</HoldButton></>}>
      <div className="space-y-3 text-sm">
        <p>Centang shift yang <b>ditiadakan</b> (mis. salah input) dan isi alasannya. Sisanya disahkan.</p>
        {rows.map((r) => (
          <div key={r.id} className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={r.id in waived} onChange={(e) => {
                const next = { ...waived };
                if (e.target.checked) next[r.id] = ''; else delete next[r.id];
                setWaived(next);
              }} />
              {longDate(r.closedOn)} · {r.branchName} #{r.shiftNumber} · {signed(r.amount)}
            </label>
            {r.id in waived && <Input aria-label="Alasan meniadakan" placeholder="Alasan meniadakan shift ini" value={waived[r.id]} onChange={(e) => setWaived({ ...waived, [r.id]: e.target.value })} />}
          </div>
        ))}
        <p>Minus {rupiah(minus)} − lebih {rupiah(plus)} = dipotong <b className="tabular-nums">{rupiah(net)}</b></p>
        <p className="text-ink-muted">Orangnya diberi tahu nominal dan bisa mengajukan keberatan (menyusul di L4c-2). Pemilik lain diberi tahu.</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function CancelManualDialog({ target, onClose }: { target: Manual | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  function close() { setReason(''); setError(null); onClose(); }
  async function save() {
    if (!target) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'manual_cancel', id: target.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast('Minus kas dibatalkan. Penanggung diberi tahu.', 'ok');
    close();
    router.refresh();
  }
  return (
    <Dialog open onClose={close} title="Batalkan minus kas"
      footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton variant="danger" loading={busy} disabled={!reason.trim()} onClick={save}>Batalkan</HoldButton></>}>
      <div className="space-y-3">
        <p>Minus kas {rupiah(target.amount)} ({longDate(target.occurredOn)}, {target.branchName}) tidak jadi dipotong.</p>
        <Field id="cm-reason" label="Alasan membatalkan"><Textarea id="cm-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
