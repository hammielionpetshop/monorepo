import Link from 'next/link';
import { EmptyState, Card, Badge } from '@/components/ui/surface';
import { cn } from '@/lib/cn';
import { RULE_STATUS_LABELS } from '../rules/rule';
import type { BoardView } from '../server/rules';
import { dateText, whenWib } from './shared';

/** Papan Perubahan Aturan (BER-L08): tab Berlaku (belum dibaca di atas, darurat yang masih tayang) dan Riwayat. */
export function RuleBoardScreen({ view, tab }: { view: BoardView; tab: 'current' | 'history' }) {
  const tabs = [{ id: 'current', label: 'Berlaku' }, { id: 'history', label: 'Riwayat' }] as const;
  const empty = !view.rules.length && !view.emergencies.length;
  return (
    <div className="space-y-4">
      <nav className="flex gap-2" aria-label="Tab papan">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.id === 'current' ? '/rule-board' : '/rule-board?tab=history'}
            className={cn('rounded-full border px-3 py-1.5 text-sm', item.id === tab ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink')}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {empty && <Card><EmptyState title={tab === 'current' ? 'Tidak ada perubahan aturan untuk Anda' : 'Belum ada riwayat'} /></Card>}
      <div className="space-y-2">
        {view.emergencies.map((item) => (
          <Card key={`e${item.id}`} className="space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone="danger">Darurat</Badge>
              {!item.readAt && tab === 'current' && <Badge tone="warn">Belum dibaca</Badge>}
              <span className="font-medium">{item.title}</span>
            </p>
            <p className="whitespace-pre-line text-sm">{item.message}</p>
            <p className="text-xs text-ink-muted">{whenWib(item.createdAt)}{item.senderName ? ` · ${item.senderName}` : ''}</p>
          </Card>
        ))}
        {view.rules.map((rule) => (
          <Link key={rule.id} href={`/rule-board/${rule.id}`} className={cn('block rounded-card border border-l-4 border-line bg-surface p-4 hover:bg-canvas', !rule.myReadAt && tab === 'current' ? 'border-l-danger-fg' : 'border-l-brand-600')}>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {rule.title}
              {!rule.myReadAt && tab === 'current' && <Badge tone="warn">Belum dibaca</Badge>}
              {tab === 'history' && <Badge tone="info">{RULE_STATUS_LABELS[rule.status]}</Badge>}
            </p>
            <p className="text-sm text-ink-muted">
              {rule.status === 'EFFECTIVE' || tab === 'history' ? 'Berlaku sejak' : 'Mulai berlaku'} {dateText(rule.effectiveOn)}
              {rule.supersededFrom ? ` · digantikan mulai ${dateText(rule.supersededFrom)}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
