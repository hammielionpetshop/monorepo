'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Tab = 'ALL' | 'LOOK' | 'REVALUED' | 'UNRATED';
type Row = {
  id: number; name: string; date: string; dateLabel: string; role: string; kind: string; vehicle: string; route: string; withAssistant: boolean;
  amount: number; rateAmount: number | null; note: string | null; dayStatus: string | null; payBasis: string; status: string; statusLabel: string;
  needsLook: boolean; looked: boolean; lookNote: string | null; cancelReason: string | null; replacedAmount: number | null;
  tripId: number | null; tripNumber: string | null; manual: boolean;
};

const rp = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;
const TABS: { key: Tab; label: string; count: 'all' | 'look' | 'revalued' | 'unrated' }[] = [
  { key: 'ALL', label: 'Semua', count: 'all' }, { key: 'LOOK', label: 'Perlu dilihat', count: 'look' },
  { key: 'REVALUED', label: 'Dinilai ulang', count: 'revalued' }, { key: 'UNRATED', label: 'Belum bertarif', count: 'unrated' },
];

/** Upah Ritase (DRV-L05) per minggu upah Jumat–Kamis. Tidak ada pengubah nominal (DRV-01). */
export function TripWagesScreen({ start, end, prev, next, today, tab, counts, total, people, rows, canReview, canRate }: {
  start: string; end: string; prev: string; next: string; today: string; tab: Tab;
  counts: Record<'all' | 'look' | 'revalued' | 'unrated', number>; total: number;
  people: { name: string; ritase: number; shopping: number; amount: number; unrated: number }[]; rows: Row[]; canReview: boolean; canRate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [look, setLook] = useState<Row | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = (week: string, t: Tab = tab) => `/gaji/upah-ritase?minggu=${week}${t === 'ALL' ? '' : `&tab=${t}`}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={href(prev)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>‹</Link>
          <span className="text-sm font-medium">Jumat {start} – Kamis {end}</span>
          {next <= today && <Link href={href(next)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>›</Link>}
        </div>
        <span className="text-sm">Jumlah minggu ini: <b className="tabular-nums">{rp(total)}</b></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={href(start, t.key)} className={buttonClass({ variant: t.key === tab ? 'primary' : 'secondary', size: 'sm' })}>
            {t.label}{counts[t.count] ? ` (${counts[t.count]})` : ''}
          </Link>
        ))}
      </div>
      {tab === 'UNRATED' && counts.unrated > 0 && canRate && (
        <Alert tone="warn">Upah ini Rp0 sampai tarif pasangannya diisi; sesudah diisi, upahnya dinilai ulang otomatis. <Link href="/pengaturan/tarif-ritase" className="underline">Buka Tarif Ritase</Link></Alert>
      )}
      {tab === 'ALL' && people.length > 0 && (
        <Card className="overflow-x-auto">
          <h2 className="mb-2 font-semibold">Per orang</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-muted">
              <th className="py-1 pr-3 font-medium">Nama</th><th className="py-1 pr-3 text-right font-medium">Ritase</th>
              <th className="py-1 pr-3 text-right font-medium">Belanja</th><th className="py-1 text-right font-medium">Upah</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => (
                <tr key={p.name}>
                  <td className="py-1.5 pr-3">{p.name}{p.unrated > 0 && <> <Badge tone="danger">{p.unrated} belum bertarif</Badge></>}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{p.ritase}</td><td className="py-1.5 pr-3 text-right tabular-nums">{p.shopping}</td>
                  <td className="py-1.5 text-right tabular-nums">{rp(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {!rows.length ? <EmptyState title="Tidak ada baris di sini" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-muted">
              <th className="py-1 pr-3 font-medium">Tanggal</th><th className="py-1 pr-3 font-medium">Nama</th><th className="py-1 pr-3 font-medium">Jenis</th>
              <th className="py-1 pr-3 font-medium">Rute · mobil</th><th className="py-1 pr-3 text-right font-medium">Upah</th><th className="py-1 pr-3 font-medium">Keterangan</th>
              <th className="py-1 font-medium">Trip</th><th />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={r.status === 'CANCELLED' ? 'text-ink-muted' : ''}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{r.dateLabel}</td>
                  <td className="py-1.5 pr-3">{r.name}<span className="block text-xs text-ink-muted">{r.payBasis}</span></td>
                  <td className="py-1.5 pr-3">{r.kind} · {r.role}{r.kind === 'Ritase' && r.role === 'Driver' ? (r.withAssistant ? ' berkenek' : ' tanpa kenek') : ''}</td>
                  <td className="py-1.5 pr-3">{r.route}<span className="block text-xs text-ink-muted">{r.vehicle}</span></td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {rp(r.amount)}
                    {r.status === 'CANCELLED' && r.replacedAmount != null && <span className="block text-xs">→ {rp(r.replacedAmount)}</span>}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.status !== 'ACTIVE' && <Badge tone={r.status === 'UNRATED' ? 'danger' : 'warn'}>{r.statusLabel}</Badge>}
                    {r.note && r.status !== 'UNRATED' && <span className="block text-xs">{r.note}{r.rateAmount ? ` (tarif ${rp(r.rateAmount)})` : ''}</span>}
                    {r.dayStatus && <span className="block text-xs text-ink-muted">Hari itu: {r.dayStatus}</span>}
                    {r.needsLook && (r.looked ? <span className="block text-xs text-ink-muted">Sudah dilihat{r.lookNote ? `: ${r.lookNote}` : ''}</span> : <Badge tone="warn">Perlu dilihat</Badge>)}
                    {r.cancelReason && <span className="block text-xs">{r.cancelReason}</span>}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.tripId ? <Link href={`/logistik/trip/${r.tripId}`} className="underline">{r.tripNumber}</Link> : r.manual ? <Badge tone="warn">Ritase tangan</Badge> : '-'}
                  </td>
                  <td className="py-1.5 text-right">
                    {canReview && r.needsLook && !r.looked && r.status !== 'CANCELLED' && (
                      <Button size="sm" variant="ghost" onClick={() => { setError(null); setNote(''); setLook(r); }}>Sudah dilihat</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!look} onClose={() => setLook(null)} title="Sudah dilihat"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setLook(null)}>Batal</Button>
          <Button loading={busy} onClick={async () => {
            if (!look) return;
            setBusy(true);
            const result = await postJson('/api/wages', { action: 'look', valueId: look.id, note: note || null });
            setBusy(false);
            if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
            toast('Ditandai sudah dilihat.', 'ok');
            setLook(null);
            router.refresh();
          }}>Tandai</Button></>}
      >
        {look && (
          <div className="space-y-3">
            <p>{look.name} ikut trip {look.dateLabel}, padahal hari itu tercatat {look.dayStatus?.toLowerCase() ?? 'bukan hari libur'}. Upahnya tetap Rp0; tanda ini tidak mengubah uang.</p>
            <p className="text-ink-muted">Kalau catatan harinya keliru, betulkan di Kehadiran (misalnya batalkan izin atau pindahkan libur); upahnya dinilai ulang sendiri.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field id="look-note" label="Catatan (pilihan)"><Textarea id="look-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
