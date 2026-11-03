'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/advance';
import type { ScheduleView } from './schedule-table';
import { ScheduleTable } from './schedule-table';

type CardData = ScheduleView & {
  id: number; number: string; stage: string; stageLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger';
  requestedAmount: number; requestedInstallments: number; finalAmount: number | null; finalInstallments: number | null; reason: string;
  decisionNote: string | null; rejectReason: string | null; cancelReason: string | null; filledBy: string | null; submittedAt: string;
  requestId: number | null; requestVersion: number | null;
  handover: { moneyDate: string; method: string; via: string | null } | null;
  remaining: number; handed: number;
  canWithdraw: boolean; canResubmit: boolean; canRequestCancel: boolean; cancelRequested: boolean; canReportNotReceived: boolean; notReceivedUntil: string | null;
  notReceived: { status: string; note: string | null }[];
  canPostpone: boolean; postponeBlocked: string | null; postponeRequested: boolean; postpones: { status: string; note: string | null }[];
  eventKind: string | null; kind: string;
};

type Action = { kind: 'withdraw' | 'request_cancel' | 'not_received'; card: CardData } | null;

const dateText = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const ymd = (d: string) => dateText(`${d}T00:00:00+07:00`);

/** DRV-L23 Kasbon Saya (HP): kartu per kasbon, terbaru di atas; tanpa angka batas, sisa dana, dan nama sumber uang (DRV-78). */
export function MyAdvancesScreen({ cards, blocked }: { cards: CardData[]; blocked: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(cards[0]?.id ?? null);
  const running = cards.filter((c) => !['PAID_OFF', 'TRANSFERRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'].includes(c.stage));
  const done = cards.filter((c) => !running.includes(c));

  async function submit() {
    if (!action) return;
    setBusy(true);
    setError(null);
    const result = action.kind === 'withdraw'
      ? await postJson('/api/requests', { kind: 'cancel', id: action.card.requestId, version: action.card.requestVersion, reason })
      : await postJson('/api/advances', { kind: action.kind, id: action.card.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    setAction(null);
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.refresh();
  }

  const renderCard = (c: CardData) => (
    <Card key={c.id} className="space-y-2">
      <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
        <div>
          <p className="text-xs text-ink-muted">{c.number} · diajukan {dateText(c.submittedAt)}{c.filledBy ? ` · diisi oleh ${c.filledBy}` : ''}</p>
          <p className="text-lg font-semibold tabular-nums">
            {c.finalAmount != null && c.finalAmount !== c.requestedAmount ? <><s className="text-ink-muted">{rupiah(c.requestedAmount)}</s> → {rupiah(c.finalAmount)}</> : rupiah(c.finalAmount ?? c.requestedAmount)}
          </p>
          <p className="text-sm">{c.finalInstallments ?? c.requestedInstallments} kali potong</p>
        </div>
        <Badge tone={c.tone}>{c.stageLabel}</Badge>
      </button>
      {(c.stage === 'WAITING_REVIEW' || c.stage === 'REVIEWED') && <p className="text-sm text-ink-muted">Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair.</p>}
      {c.handover && c.stage === 'RUNNING' && (
        <p className="text-sm">Sisa <b className="tabular-nums">{rupiah(c.remaining)}</b> · {rupiah(c.handed - c.remaining)} dari {rupiah(c.handed)} sudah berkurang</p>
      )}
      {open === c.id && (
        <div className="space-y-2 border-t border-line pt-2 text-sm">
          <p><span className="text-ink-muted">Alasan: </span>{c.reason}</p>
          {c.decisionNote && <p><span className="text-ink-muted">Catatan penyetuju: </span>{c.decisionNote}</p>}
          {c.rejectReason && <Alert tone="danger" title="Ditolak">{c.rejectReason}</Alert>}
          {c.cancelReason && <Alert title="Dibatalkan">{c.cancelReason}</Alert>}
          {c.cancelRequested && <Alert tone="warn">Anda meminta kasbon ini dibatalkan; menunggu Pemilik atau GM.</Alert>}
          {c.handover && (
            <p>Diberikan tanggal {ymd(c.handover.moneyDate)} lewat {c.handover.method}{c.handover.via ? `, dititipkan lewat ${c.handover.via}` : ', langsung ke Anda'}.</p>
          )}
          {c.kind === 'SPECIAL' && <p className="text-ink-muted">Kasbon Khusus{c.eventKind ? ` (${c.eventKind})` : ''}.</p>}
          {c.postponeRequested && <Alert tone="warn">Anda meminta cicilan ditunda; menunggu Pemilik atau GM. Bila slipnya ditutup lebih dulu, permintaan gugur.</Alert>}
          {c.postpones.map((p, i) => (
            <p key={`pp-${i}`} className="text-ink-muted">Permintaan tunda: {p.status === 'APPROVED' ? 'disetujui' : p.status === 'REJECTED' ? `ditolak — ${p.note ?? ''}` : p.status === 'EXPIRED' ? 'gugur (slip sudah ditutup lebih dulu)' : 'dibatalkan'}.</p>
          ))}
          {c.notReceived.map((n, i) => (
            <p key={i} className="text-ink-muted">Laporan uang belum diterima: {n.status === 'APPROVED' ? `sudah diselesaikan — ${n.note}` : n.status === 'REJECTED' ? `tidak terbukti — ${n.note}` : 'menunggu Pemilik atau GM'}.</p>
          ))}
          {c.handover && (
            <>
              <p className="font-medium"><NewBadge feature="fitur/cicilan-kasbon-di-slip" /> Jadwal cicilan</p>
              <ScheduleTable installments={c.installments} movements={c.movements} />
              <p className="text-ink-muted">Mau melunasi lebih cepat? Bayar tunai ke Finance.</p>
              {c.stage === 'RUNNING' && c.postponeBlocked && !c.postponeRequested && <p className="text-ink-muted">Tunda cicilan: {c.postponeBlocked}</p>}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {c.canWithdraw && c.requestId && <Button variant="danger" size="sm" onClick={() => { setReason(''); setError(null); setAction({ kind: 'withdraw', card: c }); }}>Batalkan</Button>}
            {c.canResubmit && c.requestId && <Link className={buttonClass({ size: 'sm' })} href={`/kasbon/ajukan?ulang=${c.requestId}`}>Ajukan ulang</Link>}
            {c.canRequestCancel && <Button variant="secondary" size="sm" onClick={() => { setReason(''); setError(null); setAction({ kind: 'request_cancel', card: c }); }}>Minta dibatalkan</Button>}
            {c.canReportNotReceived && <Button variant="secondary" size="sm" onClick={() => { setReason(''); setError(null); setAction({ kind: 'not_received', card: c }); }}>Uang belum saya terima</Button>}
            {c.canPostpone && <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={`/kasbon/${c.id}/tunda`}><NewBadge feature="fitur/kasbon-sesudah-diberikan" /> Minta tunda</Link>}
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      {blocked
        ? <Alert tone="warn">{blocked}</Alert>
        : <Link href="/kasbon/ajukan" className={buttonClass({ block: true })}>Ajukan Kasbon</Link>}
      {!cards.length && <EmptyState title="Belum ada kasbon">Kasbon dicicil 1 sampai 3 kali lewat slip gaji.</EmptyState>}
      {running.map((c) => renderCard(c))}
      {done.length > 0 && (
        <>
          <h2 className="pt-2 font-semibold">Selesai</h2>
          {done.map((c) => renderCard(c))}
        </>
      )}
      <Dialog
        open={action !== null} onClose={() => setAction(null)}
        title={action?.kind === 'withdraw' ? 'Batalkan pengajuan kasbon' : action?.kind === 'request_cancel' ? 'Minta kasbon dibatalkan' : 'Uang belum saya terima'}
      >
        <div className="space-y-3">
          {action?.kind === 'request_cancel' && <p className="text-sm text-ink-muted">Selama menunggu, uangnya tidak diserahkan. Pemilik atau GM memutuskan.</p>}
          {action?.kind === 'not_received' && <p className="text-sm text-ink-muted">Pemilik atau GM dan yang menyerahkan uang diberi tahu. Cicilan tidak tertahan sendiri.</p>}
          <Field id="adv-action-reason" label={action?.kind === 'not_received' ? 'Ceritakan singkat' : 'Alasan'} hint="Paling sedikit 15 huruf.">
            <Textarea id="adv-action-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAction(null)}>Kembali</Button>
            <HoldButton loading={busy} onClick={submit}>Kirim</HoldButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
