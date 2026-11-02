'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { OvertimeCard, OvertimeTab } from '../server/overtime';
import { TabNav } from './tab-nav';

const TONES = { normal: 'info', warn: 'warn', danger: 'danger', over: 'info' } as const;

/** KEH-L41 Lembur Saya: semua lembur, batas, dan statusnya. Hanya jam; nominal ada di slip. */
export function MyOvertimeScreen({ tab, all, counts, cards }: { tab: OvertimeTab; all: boolean; counts: Record<OvertimeTab, number>; cards: OvertimeCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabs = [
    { key: 'open', label: `Belum diklaim (${counts.open})`, href: '/lembur' },
    { key: 'waiting', label: `Menunggu keputusan (${counts.waiting})`, href: '/lembur?tab=waiting' },
    { key: 'done', label: `Selesai (${counts.done})`, href: '/lembur?tab=done' },
  ];
  async function markNot(id: number) {
    setBusy(id);
    setError(null);
    const result = await postJson('/api/attendance/overtime', { id, choice: 'NOT_OVERTIME' });
    setBusy(null);
    if (!result.ok) return setError(result.error ?? 'Belum tersimpan. Coba lagi.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <TabNav label="Lembur Saya" tabs={tabs} active={tab} />
      {tab === 'open' && <p className="text-sm text-ink-muted">Klaim paling lambat 3 hari sesudah tanggalnya, pukul 23.59. Lewat itu hangus.</p>}
      {error && <Alert tone="danger">{error}</Alert>}
      {!cards.length && (
        <EmptyState title={tab === 'open' ? 'Tidak ada lembur yang belum diklaim' : tab === 'waiting' ? 'Tidak ada klaim yang menunggu' : 'Belum ada'}>
          {tab === 'open' ? 'Lembur muncul di sini sesudah Laporan Pulang terkirim, bila Anda pulang lewat jam jadwal.' : null}
        </EmptyState>
      )}
      <div className="grid gap-3">
        {cards.map((card) => (
          <Card key={card.id}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Lembur {card.hours} jam · {card.dateLabel}</p>
                {card.left ? <Badge tone={TONES[card.urgency]}>{card.left}</Badge> : <Badge>{card.stateLabel}</Badge>}
              </div>
              <p className="text-sm text-ink-muted">Jadwal pulang {card.scheduledEnd}, pulang {card.outClock}.{card.left ? ` ${card.stateLabel}.` : ''}</p>
              {tab === 'open' && <p className="text-xs text-ink-muted">Batas {card.deadline}</p>}
              {card.state === 'APPROVED' && card.approvedHours != null && (
                <p className="text-sm">Disahkan {card.approvedHours} jam.{card.reductionReason ? ` Diturunkan dari ${card.claimedHours} jam: ${card.reductionReason}` : ''}</p>
              )}
              {card.rejection && card.action === 'resubmit' && (
                <Alert tone="warn">Ditolak{card.rejection.reason ? `: ${card.rejection.reason}` : ''}. Masih bisa diajukan ulang sebelum batas.</Alert>
              )}
              {card.note && <p className="text-sm text-ink-muted">{card.note}</p>}
              <div className="flex flex-wrap gap-2">
                {card.action === 'claim' && <Link className={buttonClass()} href={`/lembur/${card.id}`}>Klaim</Link>}
                {card.action === 'resubmit' && card.requestId && <Link className={buttonClass()} href={`/lembur/${card.id}?dari=${card.requestId}`}>Ajukan ulang</Link>}
                {card.action && card.choice !== 'NOT_OVERTIME' && (
                  <Button variant="ghost" loading={busy === card.id} onClick={() => void markNot(card.id)}>Bukan lembur</Button>
                )}
                {card.requestId && tab !== 'open' && <Link className={buttonClass({ variant: 'ghost' })} href={`/pengajuan/${card.requestId}`}>Lihat pengajuan</Link>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {tab === 'done' && !all && <Link className="text-sm underline" href="/lembur?tab=done&semua=1">Muat periode lama</Link>}
    </div>
  );
}
