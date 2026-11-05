'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import type { OfficeTab, SelfDecision } from '../rules/self-delivery-office';
import type { SelfStopView } from '../server/self-delivery';
import type { OfficeTripView, SelfDeliveryOfficeData } from '../server/self-delivery-office';
import { photoForm } from './capture';
import { PaymentCorrectButton } from './payment-correct';
import { CashRow, TripSummary } from './self-delivery-screen';

/** Peringatan koreksi sesudah Foto 3 (spec LT1 §15.4 butir 2): tunai yang berubah diterima ulang laci. */
export function correctionCashNote(trip: { cash: number; cashReceived: { by: string; at: string } | null }): string {
  return trip.cashReceived
    ? `Tunai ${rupiah(trip.cash)} sudah diterima ${trip.cashReceived.by}. Bila koreksi mengubah jumlah tunai, penerimaan dibuka lagi dan laci harus menekan Sudah diterima ulang.`
    : 'Bila koreksi mengubah jumlah tunai, tunai yang menunggu diterima laci ikut berubah.';
}

const API = '/api/logistics/self-delivery';
const selectClass = 'min-h-9 rounded-lg border border-line bg-surface px-3 text-sm';

const HINTS: Record<OfficeTab, string> = {
  RUNNING: 'Perjalanan hari ini yang belum Foto 3. Tutup atau Alihkan PJ bila pengantar berhalangan; perjalanan yang Anda PJ-kan sendiri diurus rekan atau atasan.',
  LATE: 'Belum kembali sampai lewat 23.59 hari mulainya. Selama berjalan, PJ tidak bisa absen Pulang.',
  FAILED: 'Kiriman Gagal menunggu keputusan: Kirim ulang (nota kembali ke daftar tugas) atau Batal kirim (ubah cara kirim / batalkan nota di kasir BO).',
  CASH: 'Tunai yang belum diterima laci cabang. Yang lewat hari ditandai merah.',
  DONE: 'Perjalanan 7 hari terakhir yang sudah kembali atau ditutup kantor.',
};

type Ask =
  | { kind: 'close'; trip: OfficeTripView }
  | { kind: 'handover'; trip: OfficeTripView }
  | { kind: 'decide'; stop: SelfStopView; decision: SelfDecision }
  | null;

/** Layar kantor Antar Sendiri (spec LT1 §15.3). */
export function SelfDeliveryOfficeScreen({ data }: { data: SelfDeliveryOfficeData }) {
  const [ask, setAsk] = useState<Ask>(null);
  const tabHref = (tab: OfficeTab) => `/logistik/antar-sendiri/kantor?tab=${tab}${data.branchId ? `&cabang=${data.branchId}` : ''}`;
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        {data.tabs.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} className={buttonClass({ variant: t.key === data.tab ? 'primary' : 'secondary', size: 'sm' })}>
            {t.label} <span className={`ml-1 tabular-nums ${t.count && (t.key === 'LATE' || t.key === 'FAILED') ? 'font-bold' : 'opacity-80'}`}>{t.count}</span>
          </Link>
        ))}
      </nav>
      {data.branches.length > 1 && (
        <form action="/logistik/antar-sendiri/kantor" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={data.tab} />
          <select name="cabang" defaultValue={data.branchId ?? ''} className={selectClass} aria-label="Cabang">
            <option value="">Semua cabang</option>
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
        </form>
      )}
      <p className="text-sm text-ink-muted">{HINTS[data.tab]}</p>

      {data.unpaired.length > 0 && (
        <Alert tone="warn">
          <p className="font-medium">Pengantar di kasir belum dipasangkan ke karyawan</p>
          <ul className="mt-1 text-sm">
            {data.unpaired.map((u) => <li key={`${u.branch}-${u.name}`}>{u.name} · {u.branch} · {u.notes} nota menunggu diantar</li>)}
          </ul>
          <p className="mt-1 text-sm">
            Nota mereka tetap bisa dibawa siapa pun di cabang (bertanda pengantar beda dengan kasir), tapi bonus ongkirnya tertahan.
            {data.canPair && <> <Link href="/bonus/pasangkan" className="text-brand underline">Pasangkan sekarang</Link></>}
          </p>
        </Alert>
      )}

      {!data.trips.length ? <EmptyState title="Tidak ada perjalanan di bagian ini." /> : (
        <Card className="space-y-2">
          {data.trips.map((trip) => (
            <div key={trip.id} className="space-y-2">
              <TripSummary trip={trip} showPj open={data.tab !== 'DONE'} stopExtra={(s) => (
                <>
                  {s.status === 'FAILED' && !s.decision && trip.canDecide && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button size="sm" onClick={() => setAsk({ kind: 'decide', stop: s, decision: 'RESEND' })}>Kirim ulang</Button>
                      <Button size="sm" variant="danger" onClick={() => setAsk({ kind: 'decide', stop: s, decision: 'DROP' })}>Batal kirim</Button>
                      {s.backofficeUrl && <a href={s.backofficeUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Buka nota di BO</a>}
                    </div>
                  )}
                  {s.payment && s.payment.bill > 0 && trip.canCorrect && (
                    <div className="mt-1">
                      <PaymentCorrectButton target={{
                        visitId: null, selfStopId: s.id, tripId: trip.id, store: s.destination, bill: s.payment.bill, method: s.payment.method,
                        received: s.payment.received, promiseDate: s.payment.promiseDate, hasProof: !!s.proofUrl, cashNote: correctionCashNote(trip),
                      }} />
                    </div>
                  )}
                </>
              )} />
              {trip.status === 'RUNNING' && trip.canManage && (
                <div className="flex flex-wrap gap-2 pl-2">
                  <Button size="sm" variant="secondary" onClick={() => setAsk({ kind: 'handover', trip })}>Alihkan PJ</Button>
                  <Button size="sm" variant="danger" onClick={() => setAsk({ kind: 'close', trip })}>Tutup perjalanan</Button>
                </div>
              )}
              {trip.cash > 0 && !trip.cashReceived && trip.status !== 'RUNNING' && trip.canCash && <CashRow trip={trip} />}
            </div>
          ))}
        </Card>
      )}
      <AskDialog ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

function AskDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setReason(''); setTo(''); setError(null); onClose(); };
  if (!ask) return <Dialog open={false} onClose={close} title="">{null}</Dialog>;

  const title = ask.kind === 'close' ? `Tutup perjalanan ${ask.trip.number}`
    : ask.kind === 'handover' ? `Alihkan PJ ${ask.trip.number}`
      : `${ask.decision === 'RESEND' ? 'Kirim ulang' : 'Batal kirim'} ${ask.stop.trxNumber}`;
  const reasonRequired = !(ask.kind === 'decide' && ask.decision === 'RESEND');
  const ready = (!reasonRequired || reason.trim().length >= 5) && (ask.kind !== 'handover' || !!to);

  async function run() {
    if (!ask) return;
    setBusy(true);
    setError(null);
    const fields = ask.kind === 'decide'
      ? { action: 'decide', tripId: 0, stopId: ask.stop.id, decision: ask.decision, reason }
      : ask.kind === 'handover' ? { action: 'handover', tripId: ask.trip.id, toEmployeeId: to, reason }
        : { action: 'close', tripId: ask.trip.id, reason };
    const result = await postJson(API, photoForm(fields, null));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(ask.kind === 'close' ? 'Perjalanan ditutup. Tujuan yang belum selesai kembali ke daftar tugas.'
      : ask.kind === 'handover' ? 'PJ dialihkan.' : ask.decision === 'RESEND' ? 'Nota kembali ke daftar tugas antar.' : 'Kiriman dibatalkan.', 'ok');
    close();
    router.refresh();
  }

  return (
    <Dialog
      open onClose={close} title={title}
      footer={<><Button variant="secondary" disabled={busy} onClick={close}>Batal</Button><Button loading={busy} disabled={!ready} onClick={run}>Simpan</Button></>}
    >
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        {ask.kind === 'close' && (
          <p>Tujuan yang belum Terkirim / Kirim Besok / Gagal menjadi <b>Kirim Besok</b> dan kembali ke daftar tugas. PJ bisa absen Pulang lagi. Tunai yang sudah dicatat tetap harus diterima laci. Bonus ongkir notanya tetap bertanda foto antar belum lengkap.</p>
        )}
        {ask.kind === 'handover' && (
          ask.trip.candidates.length ? (
            <Field id="self-handover-to" label="PJ baru" hint="Karyawan cabang ini yang berhak antar, sudah absen masuk, dan tidak sedang antar.">
              <Select id="self-handover-to" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Pilih karyawan</option>
                {ask.trip.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          ) : <Alert tone="warn">Belum ada karyawan cabang ini yang sudah absen masuk dan sedang tidak antar.</Alert>
        )}
        {ask.kind === 'decide' && (
          <p>
            {ask.stop.destination} · {ask.stop.reason}.{' '}
            {ask.decision === 'RESEND' ? 'Nota kembali ke daftar tugas dan bisa dibawa di perjalanan berikutnya.'
              : 'Nota tidak diantar lagi. Bila pelanggan mengambil sendiri atau batal, ubah cara kirim / batalkan nota di kasir BO.'}
          </p>
        )}
        <Field id="self-office-reason" label={reasonRequired ? 'Alasan (wajib)' : 'Catatan (boleh kosong)'}>
          <Textarea id="self-office-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
      </div>
    </Dialog>
  );
}
