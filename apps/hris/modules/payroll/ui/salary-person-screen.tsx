'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';
import type { HistoryCard } from '../server/screens';

type Line = { name: string; amount: number };

const STATE_BADGE: Record<HistoryCard['state'], { tone: 'ok' | 'info' | 'warn'; label: string } | null> = {
  ACTIVE: { tone: 'ok', label: 'Berlaku' }, SCHEDULED: { tone: 'info', label: 'Terjadwal' }, PAST: null, CANCELLED: { tone: 'warn', label: 'Dibatalkan' },
};

function Lines({ lines, total }: { lines: Line[]; total: number }) {
  return (
    <dl className="space-y-1 text-sm">
      {lines.map((line) => (
        <div key={line.name} className="flex justify-between gap-3"><dt className="text-ink-muted">{line.name}</dt><dd className="tabular-nums">{rupiah(line.amount)}</dd></div>
      ))}
      <div className="flex justify-between gap-3 border-t border-line pt-1 font-medium"><dt>Gaji tetap sebulan</dt><dd className="tabular-nums">{rupiah(total)}</dd></div>
    </dl>
  );
}

/** GAJ-L02 Gaji Seseorang: tab Gaji sekarang dan Riwayat. */
export function SalaryPersonScreen({ person, current, scheduled, history, proposals, canChange, canPropose, divisor, tab }: {
  person: { id: number; name: string; code: string; positionName: string; branchName: string; workStatus: 'TRAINING' | 'EMPLOYEE' };
  current: { from: string; total: number; daily: string; lines: Line[] } | null;
  scheduled: HistoryCard[]; history: HistoryCard[];
  proposals: { requestId: number; from: string; mine: boolean }[];
  canChange: boolean; canPropose: boolean; divisor: number; tab: 'now' | 'history';
}) {
  const router = useRouter();
  const toast = useToast();
  const [cancelling, setCancelling] = useState<HistoryCard | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!cancelling) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'cancel_change', id: cancelling.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast(`Perubahan gaji mulai ${longDate(cancelling.effectiveFrom)} dibatalkan. ${person.name} diberi tahu.`, 'ok');
    setCancelling(null);
    router.refresh();
  }

  const editHref = `/gaji/${person.id}/ubah`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>{person.code}</span><span>·</span><span>{person.positionName}</span><span>·</span><span>{person.branchName}</span><span>·</span>
        <span>{person.workStatus === 'TRAINING' ? 'Training' : 'Karyawan'}</span>
      </div>
      {proposals.map((p) => (
        <Alert key={p.requestId} tone="warn" title={`Usulan dari HR mulai ${p.from}, menunggu Pemilik atau GM`}>
          <Link className="underline" href={p.mine ? `/pengajuan/${p.requestId}` : `/persetujuan/${p.requestId}`}>
            {p.mine ? 'Buka usulan (bisa ditarik)' : 'Buka dan putuskan'}
          </Link>
        </Alert>
      ))}
      {(canChange || canPropose) && (
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClass()} href={editHref}>{canChange ? 'Ubah Gaji' : 'Usulkan Ubah Gaji'}</Link>
          <Link className={buttonClass({ variant: 'secondary' })} href={`${editHref}?standar=1`}>Terapkan Gaji Standar</Link>
          {canChange && (
            <span className="inline-flex items-center gap-1">
              <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/${person.id}/pembetulan`}>Pembetulan gaji periode lalu</Link>
              <NewBadge feature="fitur/pembetulan-gaji" />
            </span>
          )}
        </div>
      )}
      <nav aria-label="Bagian gaji" className="flex gap-1 border-b border-line">
        {([['now', 'Gaji sekarang'], ['history', 'Riwayat']] as const).map(([key, label]) => (
          <Link key={key} href={key === 'now' ? `/gaji/${person.id}` : `/gaji/${person.id}?tab=riwayat`} aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </Link>
        ))}
        <Link href={`/gaji/${person.id}/hitungan`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
          Hitungan <NewBadge feature="fitur/hitungan-kehadiran" />
        </Link>
        <Link href={`/gaji/${person.id}/potongan`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
          Potongan <NewBadge feature="fitur/tab-potongan" />
        </Link>
        <Link href={`/gaji/${person.id}/bonus`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
          Bonus <NewBadge feature="fitur/tab-bonus" />
        </Link>
        <Link href={`/gaji/${person.id}/slip`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
          Slip <NewBadge feature="fitur/tab-slip" />
        </Link>
      </nav>

      {tab === 'now' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-2 font-semibold">Gaji sekarang</h2>
            {current ? (
              <>
                <Lines lines={current.lines} total={current.total} />
                <p className="mt-2 text-sm text-ink-muted">Berlaku sejak {longDate(current.from)}. Gaji harian {current.daily} (÷ {divisor}, keterangan).</p>
              </>
            ) : <Alert tone="warn" title="Belum ada gaji">Slip orang ini belum bisa dihitung. Isi gajinya, bisa dari Gaji Standar.</Alert>}
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Perubahan terjadwal</h2>
            {scheduled.length === 0 && <p className="text-sm text-ink-muted">Tidak ada.</p>}
            <div className="space-y-3">
              {scheduled.map((card) => (
                <div key={card.id} className="space-y-2">
                  <p className="text-sm">Mulai <b>{longDate(card.effectiveFrom)}</b> · {card.origin}</p>
                  <Lines lines={card.lines} total={card.total} />
                  {card.canCancel && (
                    <Button size="sm" variant="ghost" onClick={() => { setCancelling(card); setReason(''); setError(null); }}>Batalkan perubahan</Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 && <p className="text-sm text-ink-muted">Belum ada riwayat gaji.</p>}
          {history.map((card) => {
            const badge = STATE_BADGE[card.state];
            return (
              <Card key={card.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Mulai {longDate(card.effectiveFrom)}</h3>
                  {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                  <span className="text-sm text-ink-muted">{card.origin}</span>
                </div>
                <Lines lines={card.lines} total={card.total} />
                <p className="mt-2 text-sm">Alasan: {card.reason}</p>
                <p className="text-sm text-ink-muted">
                  {card.proposedBy ? `Diusulkan ${card.proposedBy}, disetujui ${card.by}` : `Oleh ${card.by}`} · {card.at}
                </p>
                {card.cancelled && <p className="text-sm text-ink-muted">Dibatalkan{card.cancelledBy ? ` oleh ${card.cancelledBy}` : ''}: {card.cancelReason}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={cancelling != null}
        onClose={() => setCancelling(null)}
        title="Batalkan perubahan gaji"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Kembali</Button>
            <Button variant="danger" loading={busy} onClick={cancel}>Batalkan perubahan</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm">Perubahan mulai <b>{cancelling ? longDate(cancelling.effectiveFrom) : ''}</b> batal. Gaji yang berlaku sebelumnya tetap dipakai. {person.name} diberi tahu tanpa nominal.</p>
          <Field id="sp-reason" label="Alasan"><Textarea id="sp-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
