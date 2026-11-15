import Link from 'next/link';
import { Badge } from '@/components/ui/surface';
import { RULE_STATUS_LABELS } from '../rules/rule';
import type { RuleRow } from '../server/rules';
import { dateText, whenWib } from './shared';

/** Isi satu perubahan aturan: judul, Sebelumnya → Sekarang, mulai berlaku, tanya ke siapa (BER-L09). */
export function RuleContent({ rule, linkBase }: { rule: RuleRow; linkBase: string }) {
  const until = rule.supersededFrom ? addDays(rule.supersededFrom, -1) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Perubahan aturan</Badge>
        <Badge tone={rule.status === 'EFFECTIVE' ? 'ok' : rule.status === 'WITHDRAWN' ? 'danger' : rule.status === 'PUBLISHED' || rule.status === 'SCHEDULED' ? 'warn' : 'info'}>
          {RULE_STATUS_LABELS[rule.status]}
        </Badge>
        {rule.affectsMoney && <Badge tone="info">Menyangkut uang</Badge>}
      </div>
      <h2 className="text-lg font-semibold">{rule.title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-canvas p-3 text-sm">
          <p className="text-xs font-medium text-ink-muted">Sebelumnya</p>
          <p className="whitespace-pre-line">{rule.beforeText}</p>
        </div>
        <div className="rounded-lg border border-brand-600 p-3 text-sm">
          <p className="text-xs font-medium text-brand-700">Sekarang</p>
          <p className="whitespace-pre-line font-medium">{rule.afterText}</p>
        </div>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-ink-muted">Mulai berlaku: </dt><dd className="inline font-medium">{dateText(rule.effectiveOn)}{until ? ` s.d. ${dateText(until)}` : ''}</dd></div>
        <div><dt className="inline text-ink-muted">Kalau ada pertanyaan, tanya ke: </dt><dd className="inline">{rule.askWhom}</dd></div>
        <div><dt className="inline text-ink-muted">Terbit: </dt><dd className="inline">{whenWib(rule.publishesAt)}{rule.authorName ? ` oleh ${rule.authorName}` : ''}</dd></div>
        {rule.endedAt && <div className="sm:col-span-2"><dt className="inline text-ink-muted">Ditarik: </dt><dd className="inline">{whenWib(rule.endedAt)} — {rule.endReason}</dd></div>}
      </dl>
      {rule.correctedById && (
        <p className="text-sm"><Badge tone="warn">Diralat</Badge> <Link href={`${linkBase}/${rule.correctedById}`} className="text-brand-700 hover:underline">Lihat yang baru</Link></p>
      )}
      {rule.correctsId && <p className="text-xs text-ink-muted">Ralat dari <Link href={`${linkBase}/${rule.correctsId}`} className="hover:underline">pengumuman sebelumnya</Link>.</p>}
    </div>
  );
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
