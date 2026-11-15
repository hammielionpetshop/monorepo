import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui/surface';
import type { TripCard } from '../server/screens';

/** Satu kartu trip (daftar Trip dan Absen Trip Hari Ini). */
export function TripCardView({ card, href, extra }: { card: TripCard; href?: string | null; extra?: ReactNode }) {
  const title = <span className="font-semibold">{card.number} · {card.vehicle}</span>;
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {href ? <Link href={href} className="hover:underline">{title}</Link> : title}
          <p className="text-sm">
            {card.route ? `Kirim ${card.route}` : 'Belanja saja'}
            {card.shopping.length > 0 && ` · Belanja ${card.shopping.map((s) => `${s.name}${s.status === 'DONE' ? ' ✓' : ''}`).join(', ')}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={card.tone}>{card.statusLabel}</Badge>
          {card.hanging && <Badge tone="danger">Menggantung</Badge>}
          {card.officeClosed && <Badge tone="warn">Ditutup kantor</Badge>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {card.crew.map((m) => (
          <li key={m.id} className={m.removed ? 'text-ink-muted line-through' : ''}>
            {m.name} <span className="text-ink-muted">({m.roleLabel.toLowerCase()}{m.inAt ? `, masuk ${m.inAt}` : ''})</span>
            {m.addedAfter && <span className="ml-1"><Badge>ditambahkan kantor</Badge></span>}
            {m.removed && <span className="ml-1 no-underline"><Badge tone="warn">dicopot</Badge></span>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">
        {card.departedAt ? `Tanggal trip ${card.tripDate} · Berangkat ${card.departedAt}` : `Dibuat ${card.createdOn}, belum berangkat`}
        {card.finishedAt ? ` · Pulang ${card.finishedAt}` : card.status === 'RUNNING' ? ' · belum Sampai Garasi' : ''}
      </p>
      {extra}
    </Card>
  );
}
