import Link from 'next/link';
import { Badge } from '@/components/ui/surface';
import { cn } from '@/lib/cn';
import { STATUS_LABELS, STATUS_TONES, type RequestStatus } from '../rules/status';
import type { RequestCard } from '../server/queries';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});
const dateOnly = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string) {
  return dateOnly.format(new Date(iso));
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

function waitingLabel(days: number) {
  return days < 1 ? 'kurang dari 1 hari' : `${days} hari`;
}

/** Satu kartu pengajuan (BER-L04 / BER-L20). `mode` menentukan baris keterangan. */
export function RequestCardLink({ card, href, mode }: { card: RequestCard; href: string; mode: 'mine' | 'approvals' }) {
  const toneBorder = card.waitingTone === 'danger' ? 'border-l-danger-fg' : card.waitingTone === 'warn' ? 'border-l-warn-fg' : 'border-l-transparent';
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-card border border-l-4 border-line bg-surface p-4 hover:bg-canvas',
        mode === 'approvals' && toneBorder,
        mode === 'approvals' && card.own && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{card.typeLabel} <span className="text-xs text-ink-muted">· {card.number}</span></p>
          <p className="text-sm">{card.summary}</p>
        </div>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {mode === 'approvals' ? (
          <>
            {card.submitterName}
            {card.filledByOther && <> untuk {card.subjectName}</>}
            {card.branchName && <> · {card.branchName}</>}
            {' · '}diajukan {formatDate(card.submittedAt)}
            {(card.status === 'PENDING' || card.status === 'REVIEWED') && <> · menunggu {waitingLabel(card.waitingDays)}</>}
          </>
        ) : (
          <>
            Diajukan {formatDate(card.submittedAt)}
            {card.filledByOther && <> · diisi oleh {card.submitterName}</>}
          </>
        )}
      </p>
      {mode === 'approvals' && card.subjectInactive && <p className="mt-1 text-xs text-danger-fg">Orangnya sudah nonaktif.</p>}
      {mode === 'approvals' && card.own && <p className="mt-1 text-xs text-ink-muted">Milik Anda — diputuskan penyetuju lain.</p>}
    </Link>
  );
}
