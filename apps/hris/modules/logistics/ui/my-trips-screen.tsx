'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { CONDITION_LABELS, VISIT_REASONS, type Condition, type VisitOutcome } from '../rules/driver-trip';
import type { EndReportPending } from '../server/driver-trip';
import type { TripCard } from '../server/screens';
import type { TripPickupView, TripVisitView } from '../server/trip-notes';
import { TripNotesPanel, type PointAction, type VisitAction } from './trip-notes-panel';
import { LiveCamera, photoForm, readLocation } from './capture';

type Delivery = { visits: TripVisitView[]; pickups: TripPickupView[] };
type Step =
  | { kind: 'depart'; tripId: number }
  | { kind: 'shop'; tripId: number; shoppingId: number; name: string }
  | { kind: 'pickup'; tripId: number; pickupId: number; name: string }
  | { kind: 'visit'; tripId: number; visit: TripVisitView; outcome: 'DELIVERED' | VisitOutcome }
  | { kind: 'home'; tripId: number; early: boolean; left: string[]; back: TripVisitView[] }
  | { kind: 'arrive'; tripId: number }
  | { kind: 'point'; tripId: number; visit: TripVisitView; pointKind: PointAction }
  | null;

const OUTCOME_TITLES = { DELIVERED: 'Terkirim', TOMORROW: 'Kirim Besok', FAILED: 'Gagal' } as const;

function crewLine(card: TripCard) {
  return card.crew.filter((c) => !c.removed).map((c) => `${c.name} (${c.roleLabel.toLowerCase()})`).join(', ');
}

/** Yang belum beres sebelum Menuju Garasi (spec LT1 §13.3 butir 3). */
function leftovers(card: TripCard, delivery: Delivery | undefined): string[] {
  const visits = delivery?.visits.filter((v) => v.status === 'OPEN').length ?? 0;
  return [
    visits ? `${visits} kunjungan` : null,
    ...(delivery?.pickups.filter((p) => p.status === 'OPEN').map((p) => `ambil barang di ${p.origin}`) ?? []),
    ...card.shopping.filter((s) => s.status === 'OPEN').map((s) => `belanja ${s.name}`),
  ].filter((x): x is string => !!x);
}

/** Barang yang ikut pulang: kunjungan Kirim Besok / Gagal yang tidak dicoba lagi. */
function goingBack(delivery: Delivery | undefined): TripVisitView[] {
  const open = new Set(delivery?.visits.filter((v) => v.status === 'OPEN').map((v) => v.customerId ?? v.destination) ?? []);
  return delivery?.visits.filter((v) => (v.status === 'TOMORROW' || v.status === 'FAILED') && !open.has(v.customerId ?? v.destination)) ?? [];
}

/**
 * Trip Saya (spec L6 §4, LT1 §13.3): Berangkat (trip Siap Kirim) → kunjungan → Foto bak kosong (Menuju Garasi) → Sampai Garasi
 * dengan foto amper → Laporan Pulang driver.
 */
export function MyTripsScreen({ headline, trips, weekCount, weekStart, delivery, pendingReports, myId, pointAccuracyM }: {
  headline: string; trips: TripCard[]; weekCount: { ritase: number; shopping: number }; weekStart: string;
  delivery: Record<number, Delivery>; pendingReports: EndReportPending[]; myId: number; today?: string; pointAccuracyM: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(null);
  const [report, setReport] = useState<EndReportPending | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(next: Step) {
    setError(null);
    setPhoto(null);
    setReasonCode('');
    setNote('');
    setStep(next);
  }

  function onVisit(tripId: number, visit: TripVisitView, action: VisitAction) {
    if (action === 'RETRY') return void retry(tripId, visit);
    begin({ kind: 'visit', tripId, visit, outcome: action });
  }

  async function retry(tripId: number, visit: TripVisitView) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', { action: 'retry_visit', tripId, visitId: visit.id });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${visit.destination} masuk lagi ke daftar kunjungan.`, 'ok');
    router.refresh();
  }

  async function sendPhoto() {
    if (!step || !photo || step.kind === 'point') return;
    setBusy(true);
    setError(null);
    const needsPoint = step.kind === 'depart' || step.kind === 'visit' || step.kind === 'arrive';
    const point = needsPoint ? await readLocation() : null;
    const where = { latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy };
    const form = (() => {
      switch (step.kind) {
        case 'depart': return photoForm({ action: 'depart', tripId: step.tripId, ...where }, photo);
        case 'pickup': return photoForm({ action: 'pickup_done', tripId: step.tripId, pickupId: step.pickupId }, photo);
        case 'shop': return photoForm({ action: 'shopping_done', tripId: step.tripId, shoppingId: step.shoppingId }, photo);
        case 'visit': {
          const action = step.outcome === 'DELIVERED' ? 'deliver_visit' : step.outcome === 'TOMORROW' ? 'tomorrow_visit' : 'fail_visit';
          return photoForm({ action, tripId: step.tripId, visitId: step.visit.id, reasonCode, note, ...where }, photo);
        }
        case 'home': return photoForm({ action: 'head_home', tripId: step.tripId, earlyReason: step.early ? note : null }, photo);
        case 'arrive': return photoForm({ action: 'arrive', tripId: step.tripId, ...where }, photo);
      }
    })();
    const result = await postJson('/api/logistics/upload', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    const done = {
      depart: `Berangkat tercatat ${String(result.data?.at ?? '')}. Absen masuk seluruh awak sudah tercatat.`,
      pickup: 'Ambil barang tercatat.', shop: 'Belanja selesai tercatat.',
      visit: step.kind === 'visit' ? `${step.visit.destination}: ${OUTCOME_TITLES[step.outcome]} tercatat.` : '',
      home: 'Menuju Garasi tercatat.',
      arrive: `Sampai Garasi tercatat ${String(result.data?.at ?? '')}. Trip selesai.`,
    }[step.kind];
    toast(done, 'ok');
    const arrived = step.kind === 'arrive' ? trips.find((t) => t.id === step.tripId) : null;
    setStep(null);
    setPhoto(null);
    // Driver langsung diarahkan ke Laporan Pulang trip ini (§13.3 butir 5); kenek tidak mengisi.
    if (arrived && arrived.crew.some((c) => c.role === 'DRIVER' && !c.removed && c.employeeId === myId)) {
      setReport({ tripId: arrived.id, number: arrived.number, vehicle: arrived.vehicle, tripDate: arrived.tripDate ?? '' });
    }
    router.refresh();
  }

  if (report) return <EndReportFlow report={report} onDone={() => { setReport(null); router.refresh(); }} />;
  if (step?.kind === 'point') {
    return <PointFlow step={step} limitM={pointAccuracyM} onDone={(saved) => { setStep(null); if (saved) router.refresh(); }} />;
  }

  if (step) {
    const reasons = step.kind === 'visit' && step.outcome !== 'DELIVERED' ? VISIT_REASONS[step.outcome] : null;
    const early = step.kind === 'home' && step.early;
    const reasonReady = reasons ? !!reasonCode && (reasonCode !== 'OTHER' || note.trim().length >= 5) : early ? note.trim().length >= 5 : true;
    const title = {
      depart: 'Foto awak di dalam mobil', pickup: step.kind === 'pickup' ? `Foto barang dari ${step.name}` : '',
      shop: step.kind === 'shop' ? `Foto nota ${step.name}` : '',
      visit: step.kind === 'visit' ? `${OUTCOME_TITLES[step.outcome]}: ${step.visit.destination}` : '',
      home: early ? 'Selesai lebih awal' : 'Foto bak kosong',
      arrive: 'Foto amper bensin',
    }[step.kind];
    const hint = {
      depart: 'Semua awak terlihat di foto. Satu foto ini jadi absen masuk seluruh awak trip.',
      pickup: 'Satu foto barang yang sudah diterima dan dimuat ke mobil.', shop: 'Foto nota dari supplier, terbaca jelas.',
      visit: step.kind === 'visit' && step.outcome === 'DELIVERED' ? 'Foto barang yang sudah diterima toko.' : 'Pilih alasan, lalu foto keadaan di tempat (toko tutup, barang ditolak, dst.).',
      home: 'Foto bak mobil sebelum pulang: kosong, atau isinya barang yang ikut pulang / belanjaan.',
      arrive: 'Foto jarum atau angka bensin di dasbor. Lokasi HP harus menyala; Sampai Garasi hanya di titik garasi.',
    }[step.kind];
    const label = {
      depart: 'Berangkat', pickup: 'Simpan barang sudah diambil', shop: 'Simpan belanja selesai',
      visit: step.kind === 'visit' ? `Simpan ${OUTCOME_TITLES[step.outcome]}` : '', home: 'Menuju Garasi', arrive: 'Sampai Garasi',
    }[step.kind];
    return (
      <Card className="mx-auto max-w-md space-y-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-ink-muted">{hint}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        {step.kind === 'visit' && (
          <ul className="text-sm">{step.visit.notes.map((n) => <li key={n.key} className="tabular-nums">{n.number} <span className="text-ink-muted">dari {n.origin}</span></li>)}</ul>
        )}
        {early && (
          <Alert tone="warn" title="Masih ada yang belum beres">
            {step.left.join(', ')}. Sisa kunjungan menjadi Kirim Besok (surat jalan kembali ke antrean), ambil barang menjadi Belum siap, belanja tidak jadi.
          </Alert>
        )}
        {step.kind === 'home' && step.back.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Barang yang ikut pulang:</p>
            <ul className="pl-2">{step.back.map((v) => <li key={v.id}>{v.destination} ({v.statusLabel.toLowerCase()}): {v.notes.map((n) => n.number).join(', ')}</li>)}</ul>
          </div>
        )}
        {reasons && (
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1 text-sm font-medium">Alasan</legend>
            {reasons.map((r) => (
              <Button key={r.code} variant={reasonCode === r.code ? 'primary' : 'secondary'} className="min-h-11" onClick={() => setReasonCode(r.code)}>{r.label}</Button>
            ))}
          </fieldset>
        )}
        {(reasons || early) && (
          <Field id="step-note" label={early ? 'Alasan pulang lebih awal' : reasonCode === 'OTHER' ? 'Keterangan (wajib)' : 'Keterangan (boleh kosong)'}>
            <Textarea id="step-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={early ? 500 : 300} />
          </Field>
        )}
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(photo)} alt="Pratinjau foto" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button block loading={busy} disabled={!reasonReady} onClick={sendPhoto} className="min-h-12">{label}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setPhoto(null)} className="min-h-12">Ulangi</Button>
            </div>
            {!reasonReady && <p className="text-xs text-ink-muted">{reasons ? 'Pilih alasan dulu (Lainnya wajib keterangan).' : 'Tulis alasannya, paling sedikit 5 huruf.'}</p>}
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
      {pendingReports.map((r) => (
        <Alert key={r.tripId} tone="warn" title={`Laporan Pulang menunggu: ${r.number}`}>
          <span className="block">{r.vehicle}, tanggal {r.tripDate}. Isi keadaan mobil dan bensin.</span>
          <Button size="sm" className="mt-2" onClick={() => setReport(r)}>Isi Laporan Pulang</Button>
        </Alert>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
      {!trips.length ? (
        <EmptyState title="Belum ada trip hari ini">Trip muncul di sini setelah Kepala Gudang menandainya Siap Kirim. Hari ini tercatat Tidak jalan bila tidak ada trip sampai malam.</EmptyState>
      ) : trips.map((t) => {
        const d = delivery[t.id];
        const left = leftovers(t, d);
        return (
          <Card key={t.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.number} · {t.vehicle}</p>
                <p className="text-sm">{t.route ? `Kirim: ${t.route}` : 'Belanja saja'}</p>
              </div>
              <Badge tone={t.tone}>{t.statusLabel}</Badge>
            </div>
            <p className="text-sm text-ink-muted">Awak: {crewLine(t)}</p>
            {t.departedAt && (
              <p className="text-sm">
                Berangkat {t.departedAt}{t.headingHomeAt ? ` · Menuju Garasi ${t.headingHomeAt}` : ''}{t.finishedAt ? ` · Pulang ${t.finishedAt}` : ''}
                {t.officeClosed ? ' · ditutup kantor' : ''}
              </p>
            )}
            {t.earlyFinish && <p className="text-sm text-ink-muted">Selesai lebih awal: {t.earlyFinish}</p>}
            {t.shopping.length > 0 && (
              <ul className="space-y-2">
                {t.shopping.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                    <span>Belanja {s.name}</span>
                    {s.status === 'DONE' ? <Badge tone="ok">Selesai</Badge>
                      : t.phase === 'RUNNING' ? <Button size="sm" onClick={() => begin({ kind: 'shop', tripId: t.id, shoppingId: s.id, name: s.name })}>Belanja selesai</Button>
                        : <Badge>Belum</Badge>}
                  </li>
                ))}
              </ul>
            )}
            {d && (d.visits.length > 0 || d.pickups.length > 0) && (
              <TripNotesPanel
                compact visits={d.visits} pickups={d.pickups}
                onPickup={t.phase === 'RUNNING' ? (p) => begin({ kind: 'pickup', tripId: t.id, pickupId: p.id, name: p.origin }) : undefined}
                onVisit={t.phase === 'RUNNING' ? (v, action) => onVisit(t.id, v, action) : undefined}
                onPoint={t.phase === 'RUNNING' ? (v, pointKind) => begin({ kind: 'point', tripId: t.id, visit: v, pointKind }) : undefined}
              />
            )}
            {t.phase === 'READY' && <Button block className="min-h-12" onClick={() => begin({ kind: 'depart', tripId: t.id })}>Berangkat</Button>}
            {t.phase === 'RUNNING' && (left.length ? (
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">Sebelum pulang: {left.join(', ')}.</p>
                <Button block variant="secondary" className="min-h-12" disabled={busy} onClick={() => begin({ kind: 'home', tripId: t.id, early: true, left, back: goingBack(d) })}>
                  Selesai lebih awal
                </Button>
              </div>
            ) : (
              <>
                <Button block className="min-h-12" disabled={busy} onClick={() => begin({ kind: 'home', tripId: t.id, early: false, left: [], back: goingBack(d) })}>
                  Foto bak kosong
                </Button>
                <p className="flex items-center gap-1 text-xs text-ink-muted">Semua sudah beres. Foto bak lalu jalan pulang ke garasi. <NewBadge feature="fitur/trip-hp-driver" /></p>
              </>
            ))}
            {t.phase === 'HEADING_HOME' && (
              <>
                <Button block className="min-h-12" onClick={() => begin({ kind: 'arrive', tripId: t.id })}>Sampai Garasi</Button>
                <p className="text-xs text-ink-muted">Tekan saat mobil sudah di garasi gudang (lokasi HP harus menyala), lalu foto amper bensin.</p>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

type Located = { latitude: number; longitude: number; accuracy: number };

/**
 * Pasang titik toko / Laporkan titik salah (spec LT1 §13.4 butir 1, 3): baca lokasi HP dulu (akurasi ≤ batas), lalu foto
 * depan toko dengan kamera langsung. Server memeriksa ulang akurasinya.
 */
function PointFlow({ step, limitM, onDone }: { step: Extract<Step, { kind: 'point' }>; limitM: number; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [where, setWhere] = useState<Located | null>(null);
  const [reading, setReading] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const correction = step.pointKind === 'CORRECTION';

  async function locate() {
    setReading(true);
    setError(null);
    const found = await readLocation();
    setReading(false);
    if (!found) return setError('Lokasi HP tidak terbaca. Nyalakan lokasi (GPS) dan izinkan untuk HRIS, lalu coba lagi.');
    setWhere(found);
  }

  async function send() {
    if (!where || !photo) return;
    setBusy(true);
    setError(null);
    const form = photoForm({
      action: 'store_point', tripId: step.tripId, visitId: step.visit.id, kind: step.pointKind, reason: correction ? reason : null,
      latitude: where.latitude, longitude: where.longitude, accuracy: where.accuracy,
    }, photo);
    const result = await postJson('/api/logistics/upload', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(result.data?.status === 'APPROVED'
      ? `Titik ${step.visit.destination} tersimpan.`
      : `Titik ${step.visit.destination} terkirim, menunggu persetujuan Kepala Gudang.`, 'ok');
    onDone(true);
  }

  const accurate = !!where && where.accuracy <= limitM;
  const reasonReady = !correction || reason.trim().length >= 5;
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h2 className="font-semibold">{correction ? 'Laporkan titik salah' : 'Pasang titik toko'}: {step.visit.destination}</h2>
      <p className="text-sm text-ink-muted">
        Berdiri di depan pintu toko. 1) Baca lokasi HP (akurasi {limitM} m atau kurang). 2) Foto depan toko, papan nama terlihat.
        {correction ? ' Titik lama tetap dipakai sampai yang baru disetujui.' : ''}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="space-y-1">
        <Button block variant={where ? 'secondary' : 'primary'} className="min-h-12" loading={reading} onClick={locate}>
          {where ? 'Baca lokasi lagi' : 'Baca lokasi HP'}
        </Button>
        {where && (
          <p className={`text-sm ${accurate ? 'text-ink' : 'text-danger-fg'}`}>
            Akurasi {Math.round(where.accuracy)} m{accurate ? ' — cukup.' : ` — belum cukup (harus ≤ ${limitM} m). Tunggu sebentar di luar ruangan lalu baca lagi.`}
          </p>
        )}
      </div>
      {correction && (
        <Field id="point-reason" label="Kenapa titik lama salah? (wajib)">
          <Textarea id="point-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Contoh: titik lama di rumah sebelah, toko pindah" />
        </Field>
      )}
      {accurate && (photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={URL.createObjectURL(photo)} alt="Foto depan toko" className="w-full rounded-lg" />
          <div className="flex gap-2">
            <Button block loading={busy} disabled={!reasonReady} onClick={send} className="min-h-12">Simpan titik</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setPhoto(null)} className="min-h-12">Ulangi</Button>
          </div>
          {!reasonReady && <p className="text-xs text-ink-muted">Tulis alasannya, paling sedikit 5 huruf.</p>}
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto depan toko" />)}
      <Button variant="ghost" block disabled={busy} onClick={() => onDone(false)}>Batal</Button>
    </Card>
  );
}

/** Laporan Pulang trip (spec LT1 §13.3 butir 5): satu layar satu tugas. */
function EndReportFlow({ report, onDone }: { report: EndReportPending; onDone: () => void }) {
  const toast = useToast();
  const [page, setPage] = useState<'CONDITION' | 'FUEL' | 'PROBLEM'>('CONDITION');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [conditionNote, setConditionNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [camera, setCamera] = useState(false);
  const [needsFuel, setNeedsFuel] = useState<boolean | null>(null);
  const [fuel, setFuel] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fuelNumber = Number(fuel || 0);

  async function send() {
    setBusy(true);
    setError(null);
    const form = photoForm({
      action: 'end_report', tripId: report.tripId, condition, conditionNote, needsFuel: needsFuel ? 1 : 0,
      fuelEstimate: needsFuel ? fuelNumber : null, problemNote: problem,
    }, condition === 'ATTENTION' ? photo : null);
    const result = await postJson('/api/logistics/upload', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast('Laporan Pulang terkirim.', 'ok');
    onDone();
  }

  const conditionReady = condition === 'GOOD' || (condition === 'ATTENTION' && conditionNote.trim().length >= 5);
  const fuelReady = needsFuel === false || (needsFuel === true && fuelNumber >= 1000 && fuelNumber % 1000 === 0);
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <div>
        <p className="text-sm text-ink-muted">Laporan Pulang · {report.number} · {report.vehicle}</p>
        <h2 className="font-semibold">{page === 'CONDITION' ? '1. Keadaan mobil' : page === 'FUEL' ? '2. Perlu isi bensin besok?' : '3. Ada masalah?'}</h2>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {page === 'CONDITION' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(['GOOD', 'ATTENTION'] as const).map((c) => (
              <Button key={c} className="min-h-12" variant={condition === c ? 'primary' : 'secondary'} onClick={() => setCondition(c)}>{CONDITION_LABELS[c]}</Button>
            ))}
          </div>
          {condition === 'ATTENTION' && (
            <>
              <Field id="eod-condition" label="Apa masalahnya?" hint="Contoh: rem bunyi, ban depan kiri kempes, lampu sein mati.">
                <Textarea id="eod-condition" value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} maxLength={500} />
              </Field>
              {photo ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(photo)} alt="Foto mobil" className="max-h-48 rounded-lg" />
                  <Button size="sm" variant="secondary" onClick={() => setPhoto(null)}>Hapus foto</Button>
                </div>
              ) : camera ? <LiveCamera onPhoto={(p) => { setPhoto(p); setCamera(false); }} onError={setError} label="Ambil foto masalah" />
                : <Button size="sm" variant="secondary" onClick={() => setCamera(true)}>Tambah foto (boleh)</Button>}
            </>
          )}
          <Button block className="min-h-12" disabled={!conditionReady} onClick={() => setPage('FUEL')}>Lanjut</Button>
        </>
      )}
      {page === 'FUEL' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-12" variant={needsFuel === true ? 'primary' : 'secondary'} onClick={() => setNeedsFuel(true)}>Ya</Button>
            <Button className="min-h-12" variant={needsFuel === false ? 'primary' : 'secondary'} onClick={() => setNeedsFuel(false)}>Tidak</Button>
          </div>
          {needsFuel && (
            <Field id="eod-fuel" label="Perkiraan uang bensin (Rp)" hint="Kelipatan Rp 1.000. Admin menyiapkan uangnya dari pagi.">
              <Input id="eod-fuel" inputMode="numeric" value={fuel} onChange={(e) => setFuel(e.target.value.replace(/\D/g, ''))} />
            </Field>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-12" onClick={() => setPage('CONDITION')}>Kembali</Button>
            <Button block className="min-h-12" disabled={!fuelReady} onClick={() => setPage('PROBLEM')}>Lanjut</Button>
          </div>
        </>
      )}
      {page === 'PROBLEM' && (
        <>
          <Field id="eod-problem" label="Ceritakan bila ada (boleh dilewati)" hint="Contoh: toko minta kirim pagi, jalan ditutup, barang kurang di gudang.">
            <Textarea id="eod-problem" value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={1000} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPage('FUEL')}>Kembali</Button>
            <Button block className="min-h-12" loading={busy} onClick={send}>{problem.trim() ? 'Kirim' : 'Lewati dan kirim'}</Button>
          </div>
        </>
      )}
      <Button variant="ghost" block disabled={busy} onClick={onDone}>Nanti</Button>
    </Card>
  );
}
