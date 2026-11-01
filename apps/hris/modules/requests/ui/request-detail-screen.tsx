'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { STATUS_LABELS } from '../rules/status';
import type { RequestDetail } from '../server/queries';
import { StatusBadge, formatDateTime } from './shared';

type Mode = 'mine' | 'decide';
type Action = 'cancel' | 'approve' | 'reject' | null;

function waitingText(days: number) {
  return days < 1 ? 'kurang dari 1 hari' : `${days} hari`;
}

/**
 * BER-L07 Rincian pengajuan saya (mode `mine`) dan BER-L21 Putuskan pengajuan (mode `decide`).
 * Tombol mengikuti status dan hak yang dihitung server; server tetap memeriksa ulang.
 */
export function RequestDetailScreen({ detail, mode, nextId, resubmitHref }: {
  detail: RequestDetail; mode: Mode; nextId: number | null; resubmitHref: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { card } = detail;
  const backHref = mode === 'decide' ? '/persetujuan' : '/pengajuan';

  function open(next: Action) {
    setError(null);
    setReason('');
    setAction(next);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const body = action === 'cancel'
      ? { kind: 'cancel', id: card.id, version: detail.version, reason }
      : { kind: 'decide', id: card.id, version: detail.version, decision: action === 'approve' ? 'APPROVE' : 'REJECT', reason };
    const result = await postJson('/api/requests', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    const message = (result.data?.message as string | undefined) ?? 'Tersimpan.';
    setAction(null);
    toast(message, 'ok');
    if (mode === 'decide') setDone(message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {done && (
        <Alert tone="ok" title="Keputusan tersimpan">
          <p>{done}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextId && <Link className="font-medium text-brand-700" href={`/persetujuan/${nextId}`}>Berikutnya →</Link>}
            <Link className="font-medium text-brand-700" href="/persetujuan">Kembali ke Persetujuan</Link>
          </div>
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-ink-muted">{card.number}</p>
            <h2 className="text-lg font-semibold">{detail.type.label}</h2>
            <p className="text-sm">{card.summary}</p>
          </div>
          <StatusBadge status={card.status} />
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-ink-muted">Pengaju: </dt><dd className="inline">{card.submitterName}</dd></div>
          {card.filledByOther && <div><dt className="inline text-ink-muted">Untuk: </dt><dd className="inline">{card.subjectName}</dd></div>}
          {card.branchName && <div><dt className="inline text-ink-muted">Cabang: </dt><dd className="inline">{card.branchName}</dd></div>}
          <div><dt className="inline text-ink-muted">Diajukan: </dt><dd className="inline">{formatDateTime(card.submittedAt)}</dd></div>
          {(card.status === 'PENDING' || card.status === 'REVIEWED') && (
            <div><dt className="inline text-ink-muted">Menunggu: </dt><dd className="inline">{waitingText(card.waitingDays)}</dd></div>
          )}
        </dl>
        {mode === 'decide' && card.subjectInactive && <p className="mt-2 text-sm text-danger-fg">Orangnya sudah nonaktif; pengajuan tetap diputuskan.</p>}
      </Card>

      {card.status === 'REJECTED' && detail.decisionReason && (
        <Alert tone="danger" title={`Ditolak${detail.decidedByName ? ` oleh ${detail.decidedByName}` : ''}`}>
          <p className="text-base">{detail.decisionReason}</p>
        </Alert>
      )}
      {card.status === 'APPROVED' && (
        <Alert tone="ok">Disetujui{detail.decidedByName ? ` oleh ${detail.decidedByName}` : ''}{detail.decidedAt ? `, ${formatDateTime(detail.decidedAt)}` : ''}.</Alert>
      )}

      <Card>
        <h3 className="mb-2 font-semibold">Isi pengajuan</h3>
        {detail.changes.length === 0 ? <p className="text-sm text-ink-muted">—</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-1 pr-3 font-medium">Data</th>
                  <th className="py-1 pr-3 font-medium">Sekarang / sebelumnya</th>
                  <th className="py-1 font-medium">Diminta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.changes.map((row) => (
                  <tr key={row.label}>
                    <td className="py-1.5 pr-3 text-ink-muted">{row.label}</td>
                    <td className="py-1.5 pr-3">{row.before ?? '—'}</td>
                    <td className="py-1.5 font-medium">{row.after ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Lampiran</h3>
        {detail.attachments === null ? (
          <p className="text-sm text-ink-muted">Lampiran tertutup; hanya untuk pengaju, penyetuju, dan Pemilik/GM.</p>
        ) : detail.attachments.length === 0 ? (
          <p className="text-sm text-ink-muted">Tidak ada lampiran.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {detail.attachments.map((a) => {
              const src = `/api/requests/${card.id}/attachments/${a.fileId}`;
              return (
                <a key={a.fileId} href={src} target="_blank" rel="noreferrer" className="block w-48">
                  {/* eslint-disable-next-line @next/next/no-img-element -- berkas terlindungi, bukan aset statis */}
                  <img src={src} alt={a.label} className="h-36 w-48 rounded-lg border border-line object-cover" />
                  <span className="mt-1 block text-xs text-ink-muted">{a.label}</span>
                </a>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Riwayat</h3>
        <ol className="divide-y divide-line text-sm">
          {detail.events.map((e, index) => (
            <li key={index} className="py-2">
              <p><span className="font-medium">{e.from ? STATUS_LABELS[e.status] : 'Diajukan'}</span> · {e.actorName}</p>
              <p className="text-xs text-ink-muted">{formatDateTime(e.at)}</p>
              {e.reason && <p className="mt-0.5">Alasan: {e.reason}</p>}
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={backHref} className={buttonClass({ variant: 'secondary' })}>Kembali</Link>
        {mode === 'mine' && detail.canCancel && <Button variant="danger" onClick={() => open('cancel')}>Batalkan</Button>}
        {mode === 'mine' && detail.canResubmit && resubmitHref && <Link href={resubmitHref} className={buttonClass()}>Ajukan ulang</Link>}
        {mode === 'decide' && detail.canDecide && !done && (
          <>
            <Button variant="danger" onClick={() => open('reject')}>Tolak</Button>
            <Button onClick={() => open('approve')}>Setujui</Button>
          </>
        )}
      </div>
      {mode === 'decide' && !detail.canDecide && detail.own && (card.status === 'PENDING' || card.status === 'REVIEWED') && (
        <Alert>Pengajuan ini milik Anda; diputuskan penyetuju lain.</Alert>
      )}

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'approve' ? 'Setujui pengajuan' : action === 'reject' ? 'Tolak pengajuan' : 'Batalkan pengajuan'}
      >
        <div className="space-y-3">
          {action === 'approve' && <p>{detail.effectPreview || 'Pengajuan ini akan disetujui.'}</p>}
          {action === 'reject' && <p className="text-sm text-ink-muted">Alasan akan dibaca pengaju. Pengaju bisa memakai &quot;Ajukan ulang&quot;.</p>}
          {action === 'cancel' && <p className="text-sm text-ink-muted">Pengajuan yang dibatalkan tidak bisa dibuka lagi; ajukan baru bila perlu.</p>}
          {action !== 'approve' && (
            <Field id="decision-reason" label="Alasan">
              <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAction(null)}>Kembali</Button>
            {action === 'approve'
              ? <HoldButton loading={busy} onClick={submit}>Setujui</HoldButton>
              : <Button variant="danger" loading={busy} onClick={submit}>{action === 'reject' ? 'Tolak' : 'Batalkan pengajuan'}</Button>}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
