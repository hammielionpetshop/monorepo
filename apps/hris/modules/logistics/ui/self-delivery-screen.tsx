'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { OTHER, type VisitOutcome } from '../rules/driver-trip';
import { rupiah } from '../rules/rates';
import { SELF_MAX_STOPS, SELF_STOP_TONES, gapMinutes } from '../rules/self-delivery';
import {
  CHOSEN_METHODS, PAYMENT_HINTS, PAYMENT_LABELS, cleanPayment, cleanPromise, leftToCollect, needsPromise, type ChosenMethod,
} from '../rules/store-payments';
import { wibDate } from '../rules/trip';
import type { SelfDeliveryScreenData, SelfStopView, SelfTask, SelfTripView } from '../server/self-delivery';
import { LiveCamera, photoForm, readLocation } from './capture';
import { PromiseField, defaultPromise } from './payment-correct';

const API = '/api/logistics/self-delivery';
type Step =
  | { kind: 'start'; tasks: SelfTask[] }
  | { kind: 'deliver'; stop: SelfStopView }
  | { kind: 'outcome'; stop: SelfStopView; outcome: VisitOutcome }
  | { kind: 'finish' }
  | { kind: 'point'; stop: SelfStopView; pointKind: 'NEW' | 'CORRECTION' }
  | null;

function Photo({ blob, alt }: { blob: Blob; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={URL.createObjectURL(blob)} alt={alt} className="w-full rounded-lg" />;
}

/** Halaman Antar Sendiri (spec LT1 §15.2): satu layar satu tugas, seperti Trip Saya. */
export function SelfDeliveryScreen({ data }: { data: SelfDeliveryScreenData }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const done = (saved: boolean) => { setStep(null); if (saved) { setPicked([]); router.refresh(); } };
  const trip = data.running;

  if (step?.kind === 'start') return <StartFlow tasks={step.tasks} onDone={done} />;
  if (step?.kind === 'deliver') return <DeliverFlow tripId={trip!.id} stop={step.stop} onDone={done} />;
  if (step?.kind === 'outcome') return <OutcomeFlow tripId={trip!.id} stop={step.stop} outcome={step.outcome} reasons={data.reasons[step.outcome]} onDone={done} />;
  if (step?.kind === 'finish') return <FinishFlow data={data} onDone={done} />;
  if (step?.kind === 'point') return <PointFlow tripId={trip!.id} stop={step.stop} pointKind={step.pointKind} limitM={data.pointAccuracyM} onDone={done} />;

  const all = [...data.tasks.mine, ...data.tasks.others];
  const toggle = (id: number) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const wait = data.lastStageAt ? new Date(new Date(data.lastStageAt).getTime() + data.minMinutes * 60_000) : null;

  return (
    <div className="space-y-4">
      {trip && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Sedang antar · {trip.number}</h2>
            <Badge tone="warn">Berjalan sejak {trip.startedAt.slice(11)}</Badge>
          </div>
          {wait && wait > new Date() && (
            <p className="text-xs text-ink-muted">Tiap tahap paling sedikit {data.minMinutes} menit. Foto berikutnya bisa mulai {wait.toTimeString().slice(0, 5).replace(':', '.')}.</p>
          )}
          <ul className="space-y-2">
            {trip.stops.map((s) => (
              <li key={s.id} className="space-y-2 rounded-lg border border-line p-3">
                <StopHead stop={s} />
                {s.status === 'OPEN' && (
                  <>
                    <p className="text-sm">Tagihan: <b className="tabular-nums">{s.bill > 0 ? rupiah(s.bill) : 'tidak ada (lunas di kasir / nota Umum)'}</b></p>
                    {s.voided && <Alert tone="danger">Nota ini dibatalkan di kasir. Tidak bisa Terkirim; pilih Gagal.</Alert>}
                    <div className="grid grid-cols-3 gap-2">
                      <Button className="min-h-12" disabled={s.voided} onClick={() => setStep({ kind: 'deliver', stop: s })}>Terkirim</Button>
                      <Button className="min-h-12" variant="secondary" onClick={() => setStep({ kind: 'outcome', stop: s, outcome: 'TOMORROW' })}>Kirim Besok</Button>
                      <Button className="min-h-12" variant="danger" onClick={() => setStep({ kind: 'outcome', stop: s, outcome: 'FAILED' })}>Gagal</Button>
                    </div>
                  </>
                )}
                {s.customerId != null && (
                  <div className="flex flex-wrap gap-2 text-sm">
                    {s.mapUrl && <a className="text-brand underline" href={s.mapUrl} target="_blank" rel="noreferrer">Buka peta</a>}
                    {s.pointPending ? <span className="text-ink-muted">Titik menunggu persetujuan</span> : (
                      <Button size="sm" variant="ghost" onClick={() => setStep({ kind: 'point', stop: s, pointKind: s.hasPoint ? 'CORRECTION' : 'NEW' })}>
                        {s.hasPoint ? 'Laporkan titik salah' : 'Pasang titik toko'}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Button block className="min-h-12" disabled={trip.stops.some((s) => s.status === 'OPEN')} onClick={() => setStep({ kind: 'finish' })}>
            Kembali di cabang (Foto 3)
          </Button>
          {trip.stops.some((s) => s.status === 'OPEN') && <p className="text-xs text-ink-muted">Proses semua tujuan dulu (Terkirim / Kirim Besok / Gagal).</p>}
        </Card>
      )}

      {data.canRun && !trip && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Nota kurir yang perlu diantar{data.branch ? ` · ${data.branch}` : ''}</h2>
          {!data.onDuty && <Alert tone="warn">Absen masuk dulu. Mulai antar hanya bisa sesudah absen masuk dan sebelum absen pulang.</Alert>}
          {!all.length ? <EmptyState title="Tidak ada nota kurir yang menunggu diantar." /> : (
            <>
              <TaskList title="Untuk Anda" tasks={data.tasks.mine} picked={picked} toggle={toggle} />
              <TaskList title="Nota kurir lain di cabang ini" hint="Pengantar di kasir orang lain atau belum dipasangkan. Bila Anda yang mengantar, nota ditandai pengantar beda dengan kasir; bonus ongkir tetap mengikuti kasir."
                tasks={data.tasks.others} picked={picked} toggle={toggle} />
              <Button block className="min-h-12" disabled={!picked.length || !data.onDuty || picked.length > SELF_MAX_STOPS}
                onClick={() => setStep({ kind: 'start', tasks: all.filter((t) => picked.includes(t.transactionId)) })}>
                Mulai antar ({picked.length} nota) · Foto 1
              </Button>
            </>
          )}
        </Card>
      )}

      {data.canCash && (data.cashWaiting.length > 0 || data.cashMine.length > 0) && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Tunai antar sendiri untuk laci</h2>
          <p className="text-sm text-ink-muted">Hitung uangnya, masukkan ke laci, lalu tekan Sudah diterima. Uang yang Anda bawa sendiri diterima rekan cabang.</p>
          {data.cashWaiting.map((t) => <CashRow key={t.id} trip={t} />)}
          {data.cashMine.map((t) => (
            <p key={t.id} className="text-sm">{t.number}: {rupiah(t.cash)} dari Anda — menunggu diterima rekan cabang.</p>
          ))}
        </Card>
      )}

      {data.recent.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Perjalanan saya (2 hari)</h2>
          {data.recent.map((t) => <TripSummary key={t.id} trip={t} />)}
        </Card>
      )}

      {data.canView && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Perjalanan antar sendiri cabang (7 hari)</h2>
          {!data.branchTrips.length ? <p className="text-sm text-ink-muted">Belum ada.</p> : data.branchTrips.map((t) => <TripSummary key={t.id} trip={t} showPj />)}
        </Card>
      )}
    </div>
  );
}

function StopHead({ stop }: { stop: SelfStopView }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{stop.destination}</p>
        <Badge tone={SELF_STOP_TONES[stop.status]}>{stop.statusLabel}</Badge>
      </div>
      <p className="text-xs text-ink-muted tabular-nums">
        {stop.trxNumber} · {rupiah(stop.amount)}{stop.phone ? ` · ${stop.phone}` : ''}{stop.courierMismatch ? ' · pengantar beda dengan kasir' : ''}
      </p>
      {stop.address && <p className="text-xs text-ink-muted">{stop.address}</p>}
      {stop.reason && <p className="text-xs">{stop.reason}</p>}
      {stop.payment && (
        <p className="text-xs">
          {stop.payment.label}{stop.payment.received ? ` · diterima ${rupiah(stop.payment.received)}` : ''}{stop.payment.left ? ` · sisa ${rupiah(stop.payment.left)}` : ''}
          {stop.distanceM != null ? ` · ${stop.distanceM} m dari titik` : ''}
        </p>
      )}
    </div>
  );
}

function TaskList({ title, hint, tasks, picked, toggle }: { title: string; hint?: string; tasks: SelfTask[]; picked: number[]; toggle: (id: number) => void }) {
  if (!tasks.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.transactionId}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2">
              <input type="checkbox" className="mt-1 size-4" checked={picked.includes(t.transactionId)} onChange={() => toggle(t.transactionId)} />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{t.destination}</span>
                <span className="block text-xs text-ink-muted tabular-nums">
                  {t.trxNumber} · {t.trxOn} {t.at} · {rupiah(t.amount)} · kasir: {t.courier}{t.tomorrowCount ? ` · pernah Kirim Besok ×${t.tomorrowCount}` : ''}
                </span>
                {t.address && <span className="block text-xs text-ink-muted">{t.address}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TripSummary({ trip, showPj = false }: { trip: SelfTripView; showPj?: boolean }) {
  return (
    <details className="rounded-lg border border-line p-2 text-sm">
      <summary className="cursor-pointer">
        {trip.number}{showPj ? ` · ${trip.pj}` : ''} · {trip.statusLabel} · {trip.startedAt}{trip.returnedAt ? ` → ${trip.returnedAt.slice(11)}` : ''}
        {trip.cash > 0 && ` · tunai ${rupiah(trip.cash)}${trip.cashReceived ? ' diterima' : ''}`}
        {trip.cashLate && <Badge tone="danger">tunai belum diterima</Badge>}
      </summary>
      <div className="mt-2 space-y-2">
        {trip.gapReason && <p className="text-xs">Selisih {trip.gapMinutes} menit: {trip.gapReason}</p>}
        {trip.cashReceived && <p className="text-xs">Tunai diterima {trip.cashReceived.by}, {trip.cashReceived.at}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          <a className="text-brand underline" href={trip.pickupUrl} target="_blank" rel="noreferrer">Foto 1</a>
          {trip.returnUrl && <a className="text-brand underline" href={trip.returnUrl} target="_blank" rel="noreferrer">Foto 3</a>}
        </div>
        {trip.stops.map((s) => (
          <div key={s.id} className="rounded border border-line p-2">
            <StopHead stop={s} />
            <div className="flex gap-2 text-xs">
              {s.photoUrl && <a className="text-brand underline" href={s.photoUrl} target="_blank" rel="noreferrer">Foto 2</a>}
              {s.proofUrl && <a className="text-brand underline" href={s.proofUrl} target="_blank" rel="noreferrer">Bukti transfer</a>}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function CashRow({ trip }: { trip: SelfTripView }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function receive() {
    if (!window.confirm(`Uang tunai ${rupiah(trip.cash)} dari ${trip.pj} sudah dihitung dan masuk laci?`)) return;
    setBusy(true);
    const result = await postJson(API, photoForm({ action: 'cash', tripId: trip.id }, null));
    setBusy(false);
    if (!result.ok) return toast(result.error ?? 'Gagal menyimpan.', 'danger');
    toast('Tunai tercatat diterima.', 'ok');
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
      <span>
        {trip.number} · {trip.pj} · kembali {trip.returnedAt} · <b className="tabular-nums">{rupiah(trip.cash)}</b>
        {trip.cashLate && <> <Badge tone="danger">lewat hari</Badge></>}
      </span>
      <Button size="sm" loading={busy} onClick={receive}>Sudah diterima</Button>
    </div>
  );
}

function FlowCard({ title, sub, error, children, busy, onCancel }: { title: string; sub?: string; error: string | null; children: React.ReactNode; busy: boolean; onCancel: () => void }) {
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <div>
        {sub && <p className="text-sm text-ink-muted">{sub}</p>}
        <h2 className="font-semibold">{title}</h2>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {children}
      <Button variant="ghost" block disabled={busy} onClick={onCancel}>Batal</Button>
    </Card>
  );
}

/** Foto 1 ambil barang (LOG-43): kamera langsung, lalu perjalanan dimulai. */
function StartFlow({ tasks, onDone }: { tasks: SelfTask[]; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const result = await postJson(API, photoForm({
      action: 'start', transactionIds: tasks.map((t) => t.transactionId).join(','), latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Perjalanan antar dimulai.', 'ok');
    onDone(true);
  }
  return (
    <FlowCard title="Foto 1: barang yang dibawa" sub={`Mulai antar · ${tasks.length} nota`} error={error} busy={busy} onCancel={() => onDone(false)}>
      <ul className="text-sm">{tasks.map((t) => <li key={t.transactionId}>{t.destination} <span className="text-ink-muted tabular-nums">{t.trxNumber}</span></li>)}</ul>
      {photo ? (
        <>
          <Photo blob={photo} alt="Foto barang dibawa" />
          <div className="flex gap-2">
            <Button block className="min-h-12" loading={busy} onClick={send}>Mulai antar</Button>
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto barang" />}
    </FlowCard>
  );
}

/** Foto 2 + Terkirim + cara bayar (LOG-117): sama dengan layar Kirim truk. */
function DeliverFlow({ tripId, stop, onDone }: { tripId: number; stop: SelfStopView; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const bill = stop.bill;
  const [page, setPage] = useState<'PHOTO' | 'PAY' | 'PROOF' | 'SUMMARY'>('PHOTO');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [proof, setProof] = useState<Blob | null>(null);
  const [method, setMethod] = useState<ChosenMethod | null>(null);
  const [partial, setPartial] = useState('');
  const [promise, setPromise] = useState(defaultPromise);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = cleanPayment(bill, method, partial ? Number(partial) : null);
  const promiseCheck = clean.ok ? cleanPromise(clean.method, promise, wibDate(new Date())) : null;

  async function send() {
    if (!photo || !clean.ok) return;
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const form = photoForm({
      action: 'deliver', tripId, stopId: stop.id, payMethod: clean.method === 'NONE' ? null : clean.method,
      partialAmount: clean.method === 'PARTIAL' ? clean.received : null, promiseDate: needsPromise(clean.method) ? promise : null,
      latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy,
    }, photo);
    if (clean.method === 'TRANSFER' && proof) form.append('proof', proof, 'bukti.jpg');
    const result = await postJson(API, form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${stop.destination}: Terkirim tercatat.`, 'ok');
    onDone(true);
  }

  const title = page === 'PHOTO' ? 'Foto 2: barang diterima' : page === 'PAY' ? 'Cara bayar' : page === 'PROOF' ? 'Foto bukti transfer' : 'Periksa lalu simpan';
  return (
    <FlowCard title={title} sub={`Terkirim · ${stop.destination} · ${stop.trxNumber}`} error={error} busy={busy} onCancel={() => onDone(false)}>
      <p className="text-sm">Tagihan: <b className="tabular-nums">{bill > 0 ? rupiah(bill) : 'tidak ada (lunas di kasir / nota Umum)'}</b></p>
      {page === 'PHOTO' && (photo ? (
        <>
          <Photo blob={photo} alt="Foto barang diterima" />
          <div className="flex gap-2">
            <Button block className="min-h-12" onClick={() => setPage(bill > 0 ? 'PAY' : 'SUMMARY')}>Lanjut</Button>
            <Button variant="secondary" className="min-h-12" onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} />)}
      {page === 'PAY' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {CHOSEN_METHODS.map((m) => (
              <Button key={m} className="min-h-12" variant={method === m ? 'primary' : 'secondary'} onClick={() => { setMethod(m); setError(null); }}>{PAYMENT_LABELS[m]}</Button>
            ))}
          </div>
          {method && <p className="text-sm text-ink-muted">{PAYMENT_HINTS[method]}</p>}
          {method === 'PARTIAL' && (
            <Field id="self-partial" label="Uang cash yang diterima (Rp)" hint={`Kurang dari tagihan ${rupiah(bill)}.`}>
              <Input id="self-partial" inputMode="numeric" value={partial} onChange={(e) => setPartial(e.target.value.replace(/\D/g, '').slice(0, 12))} />
            </Field>
          )}
          {method === 'PARTIAL' && partial && !clean.ok && <p className="text-xs text-danger-fg">{clean.error}</p>}
          {method && needsPromise(method) && <PromiseField value={promise} onChange={setPromise} />}
          {promiseCheck && !promiseCheck.ok && <p className="text-xs text-danger-fg">{promiseCheck.error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-12" onClick={() => setPage('PHOTO')}>Kembali</Button>
            <Button block className="min-h-12" disabled={!clean.ok || !promiseCheck?.ok} onClick={() => setPage(method === 'TRANSFER' ? 'PROOF' : 'SUMMARY')}>Lanjut</Button>
          </div>
        </>
      )}
      {page === 'PROOF' && (proof ? (
        <>
          <Photo blob={proof} alt="Foto bukti transfer" />
          <div className="flex gap-2">
            <Button block className="min-h-12" onClick={() => setPage('SUMMARY')}>Lanjut</Button>
            <Button variant="secondary" className="min-h-12" onClick={() => setProof(null)}>Ulangi</Button>
          </div>
        </>
      ) : (
        <>
          <LiveCamera onPhoto={setProof} onError={setError} label="Foto bukti transfer" />
          <Button variant="secondary" block onClick={() => setPage('PAY')}>Kembali</Button>
        </>
      ))}
      {page === 'SUMMARY' && clean.ok && (
        <>
          <dl className="space-y-1 rounded-lg border border-line p-2 text-sm">
            <div className="flex justify-between gap-2"><dt>Cara bayar</dt><dd className="font-medium">{PAYMENT_LABELS[clean.method]}</dd></div>
            <div className="flex justify-between gap-2"><dt>Uang diterima</dt><dd className="font-medium tabular-nums">{rupiah(clean.received)}</dd></div>
            {leftToCollect(clean.method, bill, clean.received) > 0 && (
              <div className="flex justify-between gap-2"><dt>Sisa ditagih kantor</dt><dd className="font-medium tabular-nums">{rupiah(leftToCollect(clean.method, bill, clean.received))}</dd></div>
            )}
          </dl>
          <p className="text-xs text-ink-muted">Uang tunai diserahkan ke laci cabang saat kembali (Foto 3).</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPage(bill > 0 ? (method === 'TRANSFER' ? 'PROOF' : 'PAY') : 'PHOTO')}>Kembali</Button>
            <Button block className="min-h-12" loading={busy} onClick={send}>Simpan Terkirim</Button>
          </div>
        </>
      )}
    </FlowCard>
  );
}

/** Kirim Besok / Gagal (LOG-56): alasan baku + foto di tujuan (Foto 2). */
function OutcomeFlow({ tripId, stop, outcome, reasons, onDone }: {
  tripId: number; stop: SelfStopView; outcome: VisitOutcome; reasons: { code: string; label: string }[]; onDone: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!code && (code !== OTHER || note.trim().length >= 5);
  const label = outcome === 'TOMORROW' ? 'Kirim Besok' : 'Gagal';
  async function send() {
    if (!photo || !code) return;
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const result = await postJson(API, photoForm({
      action: outcome === 'TOMORROW' ? 'tomorrow' : 'fail', tripId, stopId: stop.id, reasonCode: code, note,
      latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${stop.destination}: ${label} tercatat.`, 'ok');
    onDone(true);
  }
  return (
    <FlowCard title={`${label}: ${stop.destination}`} sub={outcome === 'TOMORROW' ? 'Nota kembali ke daftar tugas.' : 'Barang dibawa kembali; cabang memutuskan kirim ulang atau batal.'}
      error={error} busy={busy} onCancel={() => onDone(false)}>
      <div className="grid grid-cols-2 gap-2">
        {reasons.map((r) => <Button key={r.code} className="min-h-11" variant={code === r.code ? 'primary' : 'secondary'} onClick={() => setCode(r.code)}>{r.label}</Button>)}
      </div>
      <Field id="self-outcome-note" label={code === OTHER ? 'Keterangan (wajib)' : 'Keterangan (boleh kosong)'}>
        <Textarea id="self-outcome-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Field>
      {photo ? (
        <>
          <Photo blob={photo} alt="Foto di tujuan" />
          <div className="flex gap-2">
            <Button block className="min-h-12" loading={busy} disabled={!ready} onClick={send}>Simpan {label}</Button>
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto 2 di tujuan" />}
    </FlowCard>
  );
}

/** Foto 3 kembali di cabang (LOG-43, 128): alasan bila selisih lama ≥ batas; tunai diserahkan ke laci. */
function FinishFlow({ data, onDone }: { data: SelfDeliveryScreenData; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const trip = data.running!;
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const times = trip.stops.map((s) => s.doneAt).filter((t): t is string => !!t).sort();
  const toDate = (stamp: string) => new Date(`${stamp.replace(' ', 'T').replace('.', ':')}:00+07:00`);
  const gap = data.startedAtIso && times.length
    ? gapMinutes(new Date(data.startedAtIso), toDate(times[0]), toDate(times[times.length - 1]), new Date()) : 0;
  const needReason = gap >= data.gapLimit;
  const cash = trip.stops.reduce((sum, s) => sum + (s.payment && (s.payment.method === 'CASH' || s.payment.method === 'PARTIAL') ? s.payment.received : 0), 0);
  const ready = !needReason || (!!code && (code !== OTHER || note.trim().length >= 5));
  async function send() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const result = await postJson(API, photoForm({
      action: 'finish', tripId: trip.id, gapReason: needReason ? code : null, gapNote: needReason ? note : null,
      latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(cash > 0 ? `Kembali tercatat. Serahkan tunai ${rupiah(cash)} ke laci; rekan cabang menekan Sudah diterima.` : 'Kembali tercatat.', 'ok');
    onDone(true);
  }
  return (
    <FlowCard title="Foto 3: kembali di cabang" sub={trip.number} error={error} busy={busy} onCancel={() => onDone(false)}>
      {cash > 0 && <Alert tone="info">Tunai yang dibawa: <b>{rupiah(cash)}</b>. Serahkan ke laci cabang; rekan yang bertugas menekan Sudah diterima.</Alert>}
      {trip.stops.some((s) => s.status === 'TOMORROW' || s.status === 'FAILED') && (
        <p className="text-sm">Barang yang tidak terkirim dibawa kembali ke cabang dan ikut difoto.</p>
      )}
      {needReason && (
        <>
          <p className="text-sm">Lama berangkat dan lama kembali berselisih ± {gap} menit. Pilih alasannya.</p>
          <div className="grid grid-cols-2 gap-2">
            {data.gapReasons.map((r) => <Button key={r.code} className="min-h-11" variant={code === r.code ? 'primary' : 'secondary'} onClick={() => setCode(r.code)}>{r.label}</Button>)}
          </div>
          <Field id="self-gap-note" label={code === OTHER ? 'Keterangan (wajib)' : 'Keterangan (boleh kosong)'}>
            <Textarea id="self-gap-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        </>
      )}
      {photo ? (
        <>
          <Photo blob={photo} alt="Foto kembali di cabang" />
          <div className="flex gap-2">
            <Button block className="min-h-12" loading={busy} disabled={!ready} onClick={send}>Simpan kembali</Button>
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto 3 di cabang" />}
    </FlowCard>
  );
}

type Located = { latitude: number; longitude: number; accuracy: number };

/** Pasang titik toko / Laporkan titik salah dari tujuan antar sendiri (aturan sama dengan kunjungan trip, spec LT1 §13.4). */
function PointFlow({ tripId, stop, pointKind, limitM, onDone }: { tripId: number; stop: SelfStopView; pointKind: 'NEW' | 'CORRECTION'; limitM: number; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [where, setWhere] = useState<Located | null>(null);
  const [reading, setReading] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const correction = pointKind === 'CORRECTION';
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
    const result = await postJson(API, photoForm({
      action: 'store_point', tripId, stopId: stop.id, kind: pointKind, reason: correction ? reason : null,
      latitude: where.latitude, longitude: where.longitude, accuracy: where.accuracy,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(result.data?.status === 'APPROVED' ? `Titik ${stop.destination} tersimpan.` : `Titik ${stop.destination} terkirim, menunggu persetujuan.`, 'ok');
    onDone(true);
  }
  const accurate = !!where && where.accuracy <= limitM;
  const reasonReady = !correction || reason.trim().length >= 5;
  return (
    <FlowCard title={`${correction ? 'Laporkan titik salah' : 'Pasang titik toko'}: ${stop.destination}`} error={error} busy={busy} onCancel={() => onDone(false)}>
      <p className="text-sm text-ink-muted">Berdiri di depan pintu toko. 1) Baca lokasi HP (akurasi {limitM} m atau kurang). 2) Foto depan toko.</p>
      <Button block variant={where ? 'secondary' : 'primary'} className="min-h-12" loading={reading} onClick={locate}>{where ? 'Baca lokasi lagi' : 'Baca lokasi HP'}</Button>
      {where && <p className={`text-sm ${accurate ? 'text-ink' : 'text-danger-fg'}`}>Akurasi {Math.round(where.accuracy)} m{accurate ? ' — cukup.' : ` — belum cukup (harus ≤ ${limitM} m).`}</p>}
      {correction && (
        <Field id="self-point-reason" label="Kenapa titik lama salah? (wajib)">
          <Textarea id="self-point-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
      )}
      {accurate && (photo ? (
        <>
          <Photo blob={photo} alt="Foto depan toko" />
          <div className="flex gap-2">
            <Button block loading={busy} disabled={!reasonReady} onClick={send} className="min-h-12">Simpan titik</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setPhoto(null)} className="min-h-12">Ulangi</Button>
          </div>
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto depan toko" />)}
    </FlowCard>
  );
}
