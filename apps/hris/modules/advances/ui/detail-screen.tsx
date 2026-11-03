'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/advance';
import { ScheduleTable, type ScheduleView } from './schedule-table';

type Detail = ScheduleView & {
  id: number; number: string; kind: string; name: string; branchName: string; stage: string; stageLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger'; labels: string[];
  request: { id: number | null; amount: number; installments: number; reason: string; filledBy: string | null; submittedAt: string; open: boolean };
  review: { amount: number | null; installments: number | null; note: string | null; by: string; at: string } | null;
  decision: { amount: number | null; installments: number | null; note: string | null; by: string; at: string; withoutReview: boolean } | null;
  closed: { reason: string | null; at: string; by: string } | null;
  handover: { amount: number; moneyDate: string; by: string; method: string; source: string | null; via: string; dateReason: string | null; beforeApproval: boolean; recordedAt: string } | null;
  remaining: number;
  followups: { requestId: number; kind: string; status: string; note: string | null }[];
  canHandOver: boolean; canCancel: boolean; canCancelHandover: boolean; decideHref: string | null; cancelOpen: boolean;
  eventKind: string | null; canRepay: boolean; canManage: boolean; canPostponeFor: boolean; reversible: number[];
};

const when = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const FOLLOW_LABELS: Record<string, string> = { CANCEL: 'Minta dibatalkan', NOT_RECEIVED: 'Uang belum diterima', POSTPONE: 'Minta tunda' };

/** DRV-L28 Rincian Kasbon, dengan DRV-L30 Batalkan dan DRV-L31 Batal serah uang (Pemilik/GM). */
export function AdvanceDetailScreen({ detail }: { detail: Detail }) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<'cancel' | 'cancel_hand_over' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = detail;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/advances', { kind: action, id: d.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    setAction(null);
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-ink-muted">{d.number}{d.kind === 'SPECIAL' ? ` · Kasbon Khusus${d.eventKind ? ` (${d.eventKind})` : ''}` : ''}</p>
            <h2 className="text-lg font-semibold">{d.name}</h2>
            <p className="text-sm text-ink-muted">{d.branchName}</p>
          </div>
          <div className="flex flex-wrap gap-1"><Badge tone={d.tone}>{d.stageLabel}</Badge>{d.labels.map((l) => <Badge key={l} tone="warn">{l}</Badge>)}</div>
        </div>
        {d.handover && <p className="mt-2 text-lg font-semibold tabular-nums">Sisa {rupiah(d.remaining)}</p>}
      </Card>

      <Card className="space-y-1 text-sm">
        <h3 className="font-semibold">Pengajuan</h3>
        <p>{rupiah(d.request.amount)}, {d.request.installments} kali potong · {when(d.request.submittedAt)}{d.request.filledBy ? ` · diisi oleh ${d.request.filledBy}` : ''}</p>
        <p className="text-ink-muted">Alasan: {d.request.reason}</p>
      </Card>

      {d.review && (
        <Card className="space-y-1 text-sm">
          <h3 className="font-semibold">Pemeriksaan Finance</h3>
          <p>Usulan {rupiah(d.review.amount ?? 0)}, {d.review.installments} kali · {d.review.by}, {when(d.review.at)}</p>
          {d.review.note && <p className="text-ink-muted">Catatan: {d.review.note}</p>}
        </Card>
      )}

      {d.decision && (
        <Card className="space-y-1 text-sm">
          <h3 className="font-semibold">Keputusan</h3>
          <p>Disetujui {rupiah(d.decision.amount ?? 0)}, {d.decision.installments} kali potong · {d.decision.by}, {when(d.decision.at)}</p>
          {d.decision.withoutReview && <p className="text-ink-muted">Diputuskan tanpa pemeriksaan Finance.</p>}
          {d.decision.note && <p className="text-ink-muted">Catatan: {d.decision.note}</p>}
        </Card>
      )}
      {d.closed && d.stage !== 'APPROVED' && !d.handover && (
        <Alert tone={d.stage === 'REJECTED' ? 'danger' : 'info'} title={d.stageLabel}>{d.closed.reason ?? '—'} · {d.closed.by}, {when(d.closed.at)}</Alert>
      )}

      {d.handover && (
        <Card className="space-y-1 text-sm">
          <h3 className="font-semibold">Penyerahan</h3>
          <p>{rupiah(d.handover.amount)} · tanggal uang {d.handover.moneyDate} · {d.handover.method}{d.handover.source ? ` dari ${d.handover.source}` : ''}</p>
          <p>Diserahkan {d.handover.by} · {d.handover.via} · dicatat {when(d.handover.recordedAt)}</p>
          {d.handover.dateReason && <p className="text-ink-muted">Alasan tanggal: {d.handover.dateReason}</p>}
          {d.handover.beforeApproval && <p className="text-danger-fg">Uang keluar sebelum disetujui.</p>}
        </Card>
      )}

      {d.installments.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold">Cicilan</h3>
          <ScheduleTable installments={d.installments} movements={d.movements} reverseHref={(m) => (d.reversible.includes(m) ? `/gaji/kasbon/${d.id}/batal-catatan/${m}` : null)} />
        </Card>
      )}

      {d.followups.length > 0 && (
        <Card className="space-y-1 text-sm">
          <h3 className="font-semibold">Permintaan</h3>
          {d.followups.map((f) => (
            <p key={f.requestId}>
              <Link className="text-brand-700" href={`/persetujuan/${f.requestId}`}>{FOLLOW_LABELS[f.kind] ?? f.kind}</Link> · {f.status === 'PENDING' ? 'menunggu' : f.status.toLowerCase()}{f.note ? ` — ${f.note}` : ''}
            </p>
          ))}
        </Card>
      )}

      {d.cancelOpen && <Alert tone="warn">Pengaju meminta kasbon ini dibatalkan. Serah uang ditahan sampai Pemilik atau GM memutuskan.</Alert>}

      <div className="flex flex-wrap gap-2">
        <Link href="/gaji/kasbon" className={buttonClass({ variant: 'secondary' })}>Kembali</Link>
        {d.decideHref && <Link href={d.decideHref} className={buttonClass()}>Periksa / Putuskan</Link>}
        {d.canHandOver && <Link href={`/gaji/kasbon/${d.id}/serahkan`} className={buttonClass()}>Serahkan uang</Link>}
        {d.canRepay && <Link href={`/gaji/kasbon/${d.id}/lunasi`} className={buttonClass()}><NewBadge feature="fitur/kasbon-sesudah-diberikan" /> Terima pelunasan</Link>}
        {d.canManage && <Link href={`/gaji/kasbon/${d.id}/ubah-jadwal`} className={buttonClass({ variant: 'secondary' })}>Ubah jadwal</Link>}
        {d.canManage && <Link href={`/gaji/kasbon/${d.id}/hapus-utang`} className={buttonClass({ variant: 'secondary' })}>Hapus utang</Link>}
        {d.canPostponeFor && <Link href={`/kasbon/${d.id}/tunda`} className={buttonClass({ variant: 'secondary' })}>Minta tunda atas nama</Link>}
        {d.canCancel && <Button variant="danger" onClick={() => { setReason(''); setError(null); setAction('cancel'); }}>Batalkan kasbon</Button>}
        {d.canCancelHandover && <Button variant="danger" onClick={() => { setReason(''); setError(null); setAction('cancel_hand_over'); }}>Batal serah uang</Button>}
      </div>

      <Dialog open={action !== null} onClose={() => setAction(null)} title={action === 'cancel' ? 'Batalkan kasbon' : 'Batal serah uang'}>
        <div className="space-y-3 text-sm">
          {action === 'cancel' && (
            <p>Kasbon {d.number} {rupiah(d.decision?.amount ?? 0)} milik {d.name} dibatalkan. Uangnya belum diberikan, jadi tidak ada uang yang bergerak. Dana Kasbon bertambah {rupiah(d.decision?.amount ?? 0)}. Kasbon batal tidak bisa dihidupkan lagi.</p>
          )}
          {action === 'cancel_hand_over' && d.handover && (
            <p>Catatan penyerahan {rupiah(d.handover.amount)} tanggal {d.handover.moneyDate} dibatalkan, jadwal cicilan dilepas, dan kasbon kembali menunggu diberikan. Pakai ini hanya untuk catatan yang salah (salah sumber uang, salah tanggal, atau uangnya ternyata belum diberikan).</p>
          )}
          <Field id="adv-detail-reason" label="Alasan" hint="Paling sedikit 15 huruf.">
            <Textarea id="adv-detail-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAction(null)}>Kembali</Button>
            <HoldButton loading={busy} onClick={submit}>{action === 'cancel' ? 'Batalkan kasbon' : 'Batal serah uang'}</HoldButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
