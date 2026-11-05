'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { BONUS_STATUS_LABELS, type BonusStatus } from '../rules/bonus';
import { longDate, rupiah } from '../rules/salary';

type Entry = {
  id: number; kind: 'GROOMING' | 'DELIVERY' | 'TYPED'; kindLabel: string; fund: string; requestId: number | null; employeeId: number; name: string; occurredOn: string; periodStart: string; branchName: string;
  baseAmount: number; percent: number | null; amount: number; status: BonusStatus; flag: string | null; trxNumber: string | null;
  serviceName: string | null; note: string | null; reason: string | null; decidedBy: string | null;
};
type GroomerGroup = { employeeId: number; name: string; pending: Entry[]; approvedTotal: number; approvedCount: number };
type Change = { id: number; entry: Entry; afterText: string; createdAt: string };
type Unpaired = { posGroomerId: number; name: string; grooming: number; delivery: number; estimate: number };
type Tab = 'grooming' | 'delivery' | 'free' | 'changes' | 'held' | 'unpaired';

const FLAG_TEXT: Record<string, string> = { GROOMER_CHANGED: '⚠ ganti groomer', CHANGED_FROM_POS: 'berubah dari kasir', CORRECTION: 'koreksi', SELF_PHOTO: '⚠ foto antar belum lengkap' };

export function FlagBadge({ flag }: { flag: string | null }) {
  if (!flag) return null;
  return <Badge tone={flag === 'GROOMER_CHANGED' || flag === 'SELF_PHOTO' ? 'warn' : 'info'}>{FLAG_TEXT[flag] ?? flag}</Badge>;
}

/** GAJ-L20 Persetujuan Bonus (spec L4d §3.3, §4): Grooming per groomer per periode, Ongkir, Perubahan dari kasir, Ditahan, Belum dipasangkan. */
export function BonusApprovalScreen(props: {
  period: { start: string; end: string; label: string }; periods: { start: string; label: string }[]; me: number | null;
  grooming: GroomerGroup[]; delivery: Entry[]; free: Entry[]; changes: Change[]; held: Entry[]; unpaired: Unpaired[];
  can: { approve: boolean; sync: boolean; link: boolean; recordFree: boolean; cancelFree: boolean }; locked: boolean; initialTab: Tab;
}) {
  const { period, periods, grooming, delivery, free, changes, held, unpaired, can, me } = props;
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const [rejecting, setRejecting] = useState<{ entry: Entry; cancel: boolean } | null>(null);
  const [deciding, setDeciding] = useState<{ change: Change; accept: boolean } | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function act(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    const result = await postJson('/api/payroll', body);
    setBusy(null);
    if (!result.ok) return toast(result.error ?? 'Gagal.', 'danger');
    toast(done, 'ok');
    router.refresh();
  }

  const pendingCount = grooming.reduce((s, g) => s + g.pending.length, 0);
  const tabs: [Tab, string, number][] = [
    ['grooming', 'Grooming', pendingCount], ['delivery', 'Ongkir', 0], ['free', 'Bonus Bebas', free.filter((e) => e.status === 'PENDING').length],
    ['changes', 'Perubahan dari kasir', changes.length],
    ['held', 'Ditahan', held.length], ['unpaired', 'Belum dipasangkan', unpaired.length],
  ];
  const shownDelivery = onlyFlagged ? delivery.filter((d) => d.flag) : delivery;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Field id="bp-period" label="Periode">
            <Select id="bp-period" name="periode" defaultValue={period.start}>{periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}</Select>
          </Field>
          <input type="hidden" name="tab" value={tab} />
          <Button type="submit" variant="secondary">Tampilkan</Button>
        </form>
        {can.sync && (
          <Button variant="ghost" loading={busy === 'sync'} onClick={() => act('sync', { kind: 'bonus_sync' }, 'Data kasir sudah ditarik.')}>Tarik sekarang dari kasir</Button>
        )}
        <Link className={buttonClass({ variant: 'ghost' })} href={`/bonus/buku?periode=${period.start}`}>Buku Bonus</Link>
      </div>
      {props.locked && <Alert tone="warn">Slip periode ini sudah ditutup. Bonus yang disahkan sekarang masuk slip periode berikutnya.</Alert>}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label, count]) => (
          <Button key={key} size="sm" variant={tab === key ? 'primary' : 'secondary'} onClick={() => setTab(key)}>{label}{count ? ` (${count})` : ''}</Button>
        ))}
      </div>

      {tab === 'grooming' && (
        <div className="space-y-3">
          <Alert tone="info">
            Tiap jasa grooming yang sudah diambil di kasir menjadi satu baris bonus untuk groomernya. Baris bertanda ⚠ ganti groomer diputuskan satu per satu dulu,
            lalu sisanya disahkan sekaligus per groomer. Jasa yang masuk sesudah layar dibuka menunggu di kelompok berikutnya.
          </Alert>
          {!grooming.length && <Card><p className="text-sm text-ink-muted">Belum ada bonus grooming di periode ini.</p></Card>}
          {grooming.map((g) => {
            const flagged = g.pending.filter((e) => e.flag === 'GROOMER_CHANGED');
            const rest = g.pending.filter((e) => e.flag !== 'GROOMER_CHANGED');
            const total = rest.reduce((s, e) => s + e.amount, 0);
            const self = g.employeeId === me;
            return (
              <Card key={g.employeeId} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{g.name}</b>
                  {g.pending.length > 0 && <Badge tone="warn">{g.pending.length} menunggu</Badge>}
                  {g.approvedCount > 0 && <Badge tone="ok">Disahkan {g.approvedCount} jasa, {rupiah(g.approvedTotal)}</Badge>}
                </div>
                {g.pending.length > 0 && <EntryTable rows={g.pending} actions={(e) => (can.approve && !self ? (
                  <div className="flex gap-1">
                    {e.flag === 'GROOMER_CHANGED' && (
                      <Button size="sm" variant="secondary" loading={busy === `a${e.id}`} onClick={() => act(`a${e.id}`, { kind: 'bonus_approve', ids: [e.id] }, 'Bonus disahkan.')}>Sahkan</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setRejecting({ entry: e, cancel: false })}>Tolak</Button>
                  </div>
                ) : null)} />}
                {can.approve && !self && rest.length > 0 && (
                  flagged.length
                    ? <p className="text-sm text-ink-muted">Putuskan dulu {flagged.length} baris bertanda ⚠, lalu sahkan sisanya.</p>
                    : <HoldButton loading={busy === `g${g.employeeId}`} onClick={() => act(`g${g.employeeId}`, { kind: 'bonus_approve', ids: rest.map((e) => e.id) }, `Bonus grooming ${g.name} disahkan: ${rupiah(total)}.`)}>
                        Sahkan bonus grooming {g.name}, periode {longDate(period.start)}: {rest.length} jasa, {rupiah(total)}
                      </HoldButton>
                )}
                {self && g.pending.length > 0 && <p className="text-sm text-ink-muted">Bonus Anda sendiri disahkan orang lain.</p>}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'delivery' && (
        <div className="space-y-3">
          <Alert tone="info">Bonus ongkir tercatat otomatis tanpa pengesahan. Yang salah bisa dibatalkan dengan alasan sebelum slip periodenya ditutup. Gratis ongkir tidak berbonus.</Alert>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Hanya yang bertanda <NewBadge feature="fitur/antar-sendiri-bonus" /></label>
          <EntryTable rows={shownDelivery} showPerson actions={(e) => (can.approve && e.employeeId !== me && e.status === 'APPROVED' && !props.locked
            ? <Button size="sm" variant="ghost" onClick={() => setRejecting({ entry: e, cancel: true })}>Batalkan</Button> : null)} />
        </div>
      )}

      {tab === 'free' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <NewBadge feature="fitur/bonus-bebas" />
            {can.recordFree && <Link className={buttonClass({ size: 'sm' })} href="/bonus/catat">Catat Bonus Bebas</Link>}
          </div>
          <Alert tone="info">
            Bonus beralasan di luar grooming dan ongkir. Usulan HR menunggu di menu <Link className="underline" href="/persetujuan">Persetujuan</Link> dan hanya
            Pemilik atau GM yang mengesahkan. Bonus bersumber Dana Disiplin hanya bisa disahkan bila saldo tersedia cukup.
          </Alert>
          <EntryTable rows={free} showPerson actions={(e) => {
            if (e.status === 'PENDING' && e.requestId) return <Link className={buttonClass({ size: 'sm', variant: 'secondary' })} href={`/persetujuan/${e.requestId}`}>Buka usulan</Link>;
            return can.cancelFree && e.employeeId !== me && e.status === 'APPROVED' && !props.locked
              ? <Button size="sm" variant="ghost" onClick={() => setRejecting({ entry: e, cancel: true })}>Batalkan</Button> : null;
          }} />
        </div>
      )}

      {tab === 'changes' && (
        <div className="space-y-3">
          <Alert tone="info">Bonus yang sudah disahkan lalu berubah di kasir (ganti groomer, ubah harga, batal, retur). Terima perubahan = baris koreksi (tambah atau kurang) di slip periode berjalan; Biarkan = bonus tetap.</Alert>
          <DataList
            rows={changes}
            rowKey={(c) => String(c.id)}
            empty="Tidak ada perubahan dari kasir yang menunggu."
            columns={[
              { key: 'who', header: 'Bonus', primary: true, render: (c) => `${c.entry.name} · ${c.entry.trxNumber ?? '-'} · ${c.entry.serviceName ?? ''}` },
              { key: 'before', header: 'Sebelum', render: (c) => <span className="tabular-nums">{rupiah(c.entry.amount)} ({longDate(c.entry.occurredOn)})</span> },
              { key: 'after', header: 'Di kasir sekarang', render: (c) => c.afterText },
              {
                key: 'act', header: '', render: (c) => (can.approve && c.entry.employeeId !== me ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setDeciding({ change: c, accept: true })}>Terima perubahan</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeciding({ change: c, accept: false })}>Biarkan</Button>
                  </div>
                ) : null),
              },
            ]}
          />
        </div>
      )}

      {tab === 'held' && (
        <div className="space-y-3">
          <Alert tone="info">
            Penerimanya di luar jabatan penerima jenis bonus itu (mis. kasir dipasangkan sebagai groomer). Uang tidak keluar diam-diam: ubah jabatan penerima di
            {' '}<Link className="underline" href="/pengaturan/jenis-bonus">Jenis Bonus</Link>, atau tolak dengan alasan.
          </Alert>
          <EntryTable rows={held} showPerson actions={(e) => (can.approve && e.employeeId !== me ? <Button size="sm" variant="ghost" onClick={() => setRejecting({ entry: e, cancel: false })}>Tolak</Button> : null)} />
        </div>
      )}

      {tab === 'unpaired' && (
        <div className="space-y-3">
          <Alert tone="info">Nama groomer atau pengantar di kasir yang belum dipasangkan ke karyawan. Bonusnya menunggu dan tidak hilang; begitu dipasangkan, bonusnya tercatat.</Alert>
          <DataList
            rows={unpaired}
            rowKey={(u) => String(u.posGroomerId)}
            empty="Semua nama di kasir sudah dipasangkan."
            columns={[
              { key: 'name', header: 'Nama di kasir', primary: true, render: (u) => u.name },
              { key: 'count', header: 'Menunggu', render: (u) => `${u.grooming} grooming · ${u.delivery} ongkir` },
              { key: 'est', header: 'Perkiraan bonus', render: (u) => <span className="tabular-nums">{rupiah(u.estimate)}</span> },
            ]}
          />
          <Link className={buttonClass({ size: 'sm' })} href="/bonus/pasangkan">Pasangkan Groomer & Pengantar</Link>
        </div>
      )}

      {rejecting && <ReasonDialog
        title={`${rejecting.cancel ? 'Batalkan' : 'Tolak'} bonus ${rejecting.entry.name} ${rupiah(rejecting.entry.amount)}`}
        confirm={rejecting.cancel ? 'Batalkan' : 'Tolak'}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => postJson('/api/payroll', { kind: 'bonus_reject', id: rejecting.entry.id, reason })}
        done={() => { toast(rejecting.cancel ? 'Bonus dibatalkan.' : 'Bonus ditolak.', 'ok'); setRejecting(null); router.refresh(); }}
      />}
      {deciding && <ReasonDialog
        title={deciding.accept ? `Terima perubahan: ${deciding.change.afterText}` : 'Biarkan bonus tetap'}
        confirm={deciding.accept ? 'Terima perubahan' : 'Biarkan'}
        onClose={() => setDeciding(null)}
        onSubmit={(reason) => postJson('/api/payroll', { kind: 'bonus_change_decide', id: deciding.change.id, accept: deciding.accept, reason })}
        done={() => { toast('Perubahan diputuskan.', 'ok'); setDeciding(null); router.refresh(); }}
      />}
    </div>
  );
}

export function EntryTable({ rows, actions, showPerson }: { rows: Entry[]; actions?: (e: Entry) => React.ReactNode; showPerson?: boolean }) {
  return (
    <DataList
      rows={rows}
      rowKey={(e) => String(e.id)}
      empty="Tidak ada baris."
      columns={[
        { key: 'date', header: 'Tanggal', primary: true, render: (e) => `${longDate(e.occurredOn)} · ${e.branchName}` },
        ...(showPerson ? [{ key: 'person', header: 'Orang', render: (e: Entry) => e.name }] : []),
        {
          key: 'trx', header: 'Nota / jenis', render: (e) => (e.kind === 'TYPED'
            ? <span>{e.kindLabel} <span className="text-ink-muted">· {e.fund === 'DISCIPLINE_FUND' ? 'Dana Disiplin' : 'Uang kantor'}</span></span>
            : <span>{e.trxNumber ?? '-'} <span className="text-ink-muted">{e.serviceName}</span></span>),
        },
        { key: 'base', header: 'Dasar', render: (e) => (e.kind === 'TYPED' ? <span className="text-xs text-ink-muted">diketik</span> : <span className="tabular-nums">{rupiah(e.baseAmount)}{e.percent != null ? ` × ${e.percent}%` : ''}</span>) },
        { key: 'amount', header: 'Bonus', render: (e) => <b className="tabular-nums">{e.amount < 0 ? `−${rupiah(-e.amount)}` : rupiah(e.amount)}</b> },
        {
          key: 'status', header: 'Status', render: (e) => (
            <span className="flex flex-wrap items-center gap-1">
              <Badge tone={e.status === 'APPROVED' ? 'ok' : e.status === 'PENDING' || e.status === 'HELD' ? 'warn' : 'danger'}>{BONUS_STATUS_LABELS[e.status]}</Badge>
              <FlagBadge flag={e.flag} />
              {e.note && <span className="text-xs text-ink-muted">{e.note}</span>}
              {e.reason && (e.status === 'REJECTED' || e.status === 'CANCELLED') && <span className="text-xs text-ink-muted">Alasan: {e.reason}</span>}
            </span>
          ),
        },
        ...(actions ? [{ key: 'act', header: '', render: actions }] : []),
      ]}
    />
  );
}

export function ReasonDialog({ title, confirm, onClose, onSubmit, done }: {
  title: string; confirm: string; onClose: () => void; onSubmit: (reason: string) => Promise<{ ok: boolean; error?: string }>; done: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await onSubmit(reason);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    done();
  }
  return (
    <Dialog open onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><HoldButton loading={busy} disabled={!reason.trim()} onClick={save}>{confirm}</HoldButton></>}>
      <div className="space-y-3">
        <Field id="bonus-reason" label="Alasan"><Textarea id="bonus-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
