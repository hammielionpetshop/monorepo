'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { TripCard } from '../server/screens';
import type { TripPickupView, TripVisitView } from '../server/trip-notes';
import { TripNotesPanel } from './trip-notes-panel';
import { LiveCamera, photoForm, readLocation } from './capture';

type Step = { kind: 'depart'; tripId: number } | { kind: 'shop'; tripId: number; shoppingId: number; name: string }
  | { kind: 'pickup'; tripId: number; pickupId: number; name: string } | null;

function crewLine(card: TripCard) {
  return card.crew.filter((c) => !c.removed).map((c) => `${c.name} (${c.roleLabel.toLowerCase()})`).join(', ');
}

/** Trip Saya (spec L6 §4, KEH-L18): Berangkat dengan foto awak, Belanja selesai dengan foto nota, Sampai Garasi di titik garasi. */
export function MyTripsScreen({ headline, trips, weekCount, weekStart, delivery }: {
  headline: string; trips: TripCard[]; weekCount: { ritase: number; shopping: number }; weekStart: string;
  delivery: Record<number, { visits: TripVisitView[]; pickups: TripPickupView[] }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(next: Step) {
    setError(null);
    setPhoto(null);
    setStep(next);
  }

  async function sendPhoto() {
    if (!step || !photo) return;
    setBusy(true);
    setError(null);
    const point = step.kind === 'depart' ? await readLocation() : null;
    const form = step.kind === 'depart'
      ? photoForm({ action: 'depart', tripId: step.tripId, latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy }, photo)
      : step.kind === 'pickup'
        ? photoForm({ action: 'pickup_done', tripId: step.tripId, pickupId: step.pickupId }, photo)
        : photoForm({ action: 'shopping_done', tripId: step.tripId, shoppingId: step.shoppingId }, photo);
    const result = await postJson('/api/logistics/upload', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(step.kind === 'depart' ? `Berangkat tercatat ${String(result.data?.at ?? '')}. Absen masuk seluruh awak sudah tercatat.`
      : step.kind === 'pickup' ? 'Ambil barang tercatat.' : 'Belanja selesai tercatat.', 'ok');
    setStep(null);
    setPhoto(null);
    router.refresh();
  }

  async function arrive(tripId: number) {
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const result = await postJson('/api/logistics', { action: 'arrive', tripId, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null, accuracy: point?.accuracy ?? null });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Sampai Garasi tercatat ${String(result.data?.at ?? '')}. Trip selesai.`, 'ok');
    router.refresh();
  }

  if (step) {
    const title = step.kind === 'depart' ? 'Foto awak di dalam mobil' : step.kind === 'pickup' ? `Foto barang dari ${step.name}` : `Foto nota ${step.name}`;
    return (
      <Card className="mx-auto max-w-md space-y-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-ink-muted">
          {step.kind === 'depart' ? 'Semua awak terlihat di foto. Satu foto ini jadi absen masuk seluruh awak trip.'
            : step.kind === 'pickup' ? 'Satu foto barang yang sudah diterima dan dimuat ke mobil.' : 'Foto nota dari supplier, terbaca jelas.'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(photo)} alt="Pratinjau foto" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button block loading={busy} onClick={sendPhoto} className="min-h-12">
                {step.kind === 'depart' ? 'Berangkat' : step.kind === 'pickup' ? 'Simpan barang sudah diambil' : 'Simpan belanja selesai'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setPhoto(null)} className="min-h-12">Ulangi</Button>
            </div>
          </>
        ) : <LiveCamera onPhoto={setPhoto} onError={setError} />}
        <Button variant="ghost" block disabled={busy} onClick={() => setStep(null)}>Batal</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <p className="text-sm text-ink-muted">Hari ini</p>
        <p className="text-lg font-semibold">{headline}</p>
        <p className="mt-1 text-sm text-ink-muted">Minggu ini (mulai Jumat {weekStart}): {weekCount.ritase} ritase, {weekCount.shopping} belanja.</p>
      </Card>
      {error && <Alert tone="danger">{error}</Alert>}
      {!trips.length ? (
        <EmptyState title="Belum ada trip hari ini">Hari ini tercatat Tidak jalan bila tidak ada trip sampai malam.</EmptyState>
      ) : trips.map((t) => (
        <Card key={t.id} className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{t.number} · {t.vehicle}</p>
              <p className="text-sm">{t.route ? `Kirim: ${t.route}` : 'Belanja saja'}</p>
            </div>
            <Badge tone={t.tone}>{t.statusLabel}</Badge>
          </div>
          <p className="text-sm text-ink-muted">Awak: {crewLine(t)}</p>
          {t.departedAt && <p className="text-sm">Berangkat {t.departedAt}{t.finishedAt ? ` · Pulang ${t.finishedAt}` : ''}{t.officeClosed ? ' · ditutup kantor' : ''}</p>}
          {t.shopping.length > 0 && (
            <ul className="space-y-2">
              {t.shopping.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                  <span>Belanja {s.name}</span>
                  {s.status === 'DONE' ? <Badge tone="ok">Selesai</Badge>
                    : t.status === 'RUNNING' ? <Button size="sm" onClick={() => begin({ kind: 'shop', tripId: t.id, shoppingId: s.id, name: s.name })}>Belanja selesai</Button>
                      : <Badge>Belum</Badge>}
                </li>
              ))}
            </ul>
          )}
          {delivery[t.id] && (delivery[t.id].visits.length > 0 || delivery[t.id].pickups.length > 0) && (
            <TripNotesPanel
              compact visits={delivery[t.id].visits} pickups={delivery[t.id].pickups}
              onPickup={t.status === 'RUNNING' ? (p) => begin({ kind: 'pickup', tripId: t.id, pickupId: p.id, name: p.origin }) : undefined}
            />
          )}
          {t.status === 'DRAFT' && <Button block className="min-h-12" onClick={() => begin({ kind: 'depart', tripId: t.id })}>Berangkat</Button>}
          {t.status === 'RUNNING' && (
            <>
              <Button block className="min-h-12" loading={busy} onClick={() => arrive(t.id)}>Sampai Garasi</Button>
              <p className="text-xs text-ink-muted">Tekan saat mobil sudah di garasi gudang (lokasi HP harus menyala). Belanja yang belum ditandai selesai tidak dihitung.</p>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
