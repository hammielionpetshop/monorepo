'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { NewBadge } from '@/components/ui/new-badge';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { TripCard } from '../server/screens';
import type { TripPickupView, TripVisitView } from '../server/trip-notes';
import { TripNotesPanel } from './trip-notes-panel';
import { LiveCamera, photoForm } from './capture';
import { TripCardView } from './trip-card';

type Option = { id: number; name: string };
type Props = {
  card: TripCard;
  delivery: { visits: TripVisitView[]; pickups: TripPickupView[] };
  allCrew: { id: number; name: string; roleLabel: string; removed: boolean; removeReason: string | null; addedAfter: boolean; addedAt: string; removedAt: string | null }[];
  shopping: { id: number; name: string; status: string; doneAt: string | null; dropReason: string | null; receiptUrl: string | null }[];
  crewPhotoUrl: string | null;
  officeClose: { reason: string | null; photoUrl: string | null } | null;
  arrive: { by: string; distanceM: number | null; fenceOff: boolean } | null;
  departedBy: string | null;
  cancel: { reason: string } | null;
  wages: { id: number; name: string; roleLabel: string; kindLabel: string; route: string; withAssistant: boolean; cancelled: boolean; cancelReason: string | null }[];
  canManage: boolean; canCancelWage: boolean; canClose: boolean; isCrew: boolean;
  addOptions: { drivers: Option[]; assistants: Option[]; suppliers: Option[] } | null;
  emptyBedPhotoUrl: string | null; fuelGaugePhotoUrl: string | null;
  endReport: { by: string; at: string; conditionLabel: string; conditionNote: string | null; fuel: number | null; problemNote: string | null; photoUrl: string | null } | null;
};

type Ask =
  | { kind: 'cancel' } | { kind: 'close' } | { kind: 'remove_crew'; crewId: number; name: string } | { kind: 'drop_shopping'; shoppingId: number; name: string }
  | { kind: 'cancel_wage'; wageId: number; name: string } | { kind: 'add_crew' } | { kind: 'add_shopping' }
  | { kind: 'release_visit'; visitId: number; name: string } | { kind: 'ready' } | { kind: 'unready' } | null;

const SHOP_STATUS: Record<string, { label: string; tone: 'info' | 'ok' | 'danger' }> = {
  OPEN: { label: 'Belum', tone: 'info' }, DONE: { label: 'Selesai', tone: 'ok' }, DROPPED: { label: 'Tidak jadi', tone: 'danger' },
};

/** Rincian trip (spec L6 §4): isi trip, foto, ritase yang lahir, dan tindakan kantor sesuai status. */
export function TripDetailScreen(props: Props) {
  const { card } = props;
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState('');
  const [pick, setPick] = useState('');
  const [role, setRole] = useState<'DRIVER' | 'ASSISTANT'>('ASSISTANT');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Ask) {
    setAsk(next);
    setReason('');
    setPick('');
    setPhoto(null);
    setError(null);
  }

  async function run() {
    if (!ask) return;
    setBusy(true);
    setError(null);
    const tripId = card.id;
    const result = ask.kind === 'close'
      ? await postJson('/api/logistics/upload', photoForm({ action: 'office_close', tripId, reason }, photo))
      : await postJson('/api/logistics', (() => {
        switch (ask.kind) {
          case 'cancel': return { action: 'cancel', tripId, reason };
          case 'remove_crew': return { action: 'remove_crew', tripId, crewId: ask.crewId, reason };
          case 'drop_shopping': return { action: 'drop_shopping', tripId, shoppingId: ask.shoppingId, reason };
          case 'cancel_wage': return { action: 'cancel_wage', wageId: ask.wageId, reason };
          case 'add_crew': return { action: 'add_crew', tripId, employeeId: Number(pick), role };
          case 'add_shopping': return { action: 'add_shopping', tripId, routeId: Number(pick) };
          case 'release_visit': return { action: 'release_visit', tripId, visitId: ask.visitId, reason };
          case 'ready': return { action: 'ready', tripId };
          case 'unready': return { action: 'unready', tripId };
        }
      })());
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Tersimpan.', 'ok');
    setAsk(null);
    router.refresh();
  }

  const needsReason = ask && ['cancel', 'close', 'remove_crew', 'drop_shopping', 'cancel_wage', 'release_visit'].includes(ask.kind);
  const titles: Record<string, string> = {
    cancel: 'Batalkan trip', close: 'Tutup atas nama driver', remove_crew: 'Copot awak', drop_shopping: 'Supplier tidak jadi',
    cancel_wage: 'Batalkan ritase', add_crew: 'Tambah awak', add_shopping: 'Tambah supplier belanja', release_visit: 'Lepas dari trip',
    ready: 'Siap Kirim', unready: 'Kembali ke Draft',
  };
  const addList = ask?.kind === 'add_crew' ? (role === 'DRIVER' ? props.addOptions?.drivers : props.addOptions?.assistants) ?? [] : props.addOptions?.suppliers ?? [];

  return (
    <div className="space-y-4">
      <TripCardView card={card} />
      <div className="flex flex-wrap gap-2">
        {props.canManage && card.phase === 'DRAFT' && (
          <>
            <Button size="sm" onClick={() => open({ kind: 'ready' })}>Siap Kirim <NewBadge feature="fitur/trip-hp-driver" /></Button>
            <Link href={`/logistik/trip/${card.id}/ubah`} className={buttonClass({ size: 'sm', variant: 'secondary' })}>Ubah trip</Link>
          </>
        )}
        {props.canManage && card.phase === 'READY' && <Button size="sm" variant="secondary" onClick={() => open({ kind: 'unready' })}>Kembali ke Draft</Button>}
        {props.canManage && card.status === 'DRAFT' && <Button size="sm" variant="danger" onClick={() => open({ kind: 'cancel' })}>Batalkan trip</Button>}
        {props.addOptions && (
          <>
            <Button size="sm" variant="secondary" onClick={() => open({ kind: 'add_crew' })}>Tambah awak</Button>
            <Button size="sm" variant="secondary" onClick={() => open({ kind: 'add_shopping' })}>Tambah supplier</Button>
          </>
        )}
        {props.canClose && card.status === 'RUNNING' && <Button size="sm" variant="danger" onClick={() => open({ kind: 'close' })}>Tutup atas nama driver</Button>}
        {props.isCrew && card.status !== 'DONE' && card.status !== 'CANCELLED' && <Link href="/trip-saya" className={buttonClass({ size: 'sm', variant: 'secondary' })}>Buka Trip Saya</Link>}
      </div>

      {props.cancel && <Alert tone="danger" title="Trip dibatalkan">{props.cancel.reason}</Alert>}
      {props.officeClose && (
        <Alert tone="warn" title="Ditutup kantor">
          {props.officeClose.reason}{props.officeClose.photoUrl && <> · <a href={props.officeClose.photoUrl} target="_blank" rel="noreferrer" className="underline">Lihat foto</a></>}
        </Alert>
      )}

      {(props.delivery.visits.length > 0 || props.delivery.pickups.length > 0 || (props.canManage && card.status === 'DRAFT')) && (
        <TripNotesPanel
          visits={props.delivery.visits} pickups={props.delivery.pickups} storeLinks
          onRelease={props.canManage && (card.status === 'RUNNING' || card.status === 'DRAFT') ? (v) => open({ kind: 'release_visit', visitId: v.id, name: v.destination }) : undefined}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-semibold">Berangkat & Sampai Garasi</h2>
          {card.departedAt ? (
            <p className="text-sm">Berangkat {card.departedAt} (ditekan {props.departedBy}).</p>
          ) : <p className="text-sm text-ink-muted">Belum berangkat.</p>}
          {props.crewPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={props.crewPhotoUrl} target="_blank" rel="noreferrer"><img src={props.crewPhotoUrl} alt="Foto awak saat berangkat" className="max-h-64 rounded-lg" /></a>
          )}
          {card.readyAt && <p className="text-sm">Siap Kirim {card.readyAt}.</p>}
          {card.headingHomeAt && (
            <p className="text-sm">
              Menuju Garasi {card.headingHomeAt}{card.earlyFinish ? ` · Selesai lebih awal: ${card.earlyFinish}` : ''}
              {props.emptyBedPhotoUrl && <> · <a href={props.emptyBedPhotoUrl} target="_blank" rel="noreferrer" className="underline">Foto bak</a></>}
            </p>
          )}
          {props.arrive && (
            <p className="text-sm">
              Sampai Garasi {card.finishedAt} (ditekan {props.arrive.by}){props.arrive.distanceM != null ? `, ${props.arrive.distanceM} m dari titik garasi` : ''}
              {props.arrive.fenceOff && <span className="ml-1"><Badge tone="warn">pagar uji mati</Badge></span>}
              {props.fuelGaugePhotoUrl && <> · <a href={props.fuelGaugePhotoUrl} target="_blank" rel="noreferrer" className="underline">Foto amper</a></>}
            </p>
          )}
          {card.status === 'DONE' && (props.endReport ? (
            <div className="rounded-lg border border-line p-2 text-sm">
              <p className="font-medium">Laporan Pulang ({props.endReport.by}, {props.endReport.at})</p>
              <p>Mobil: {props.endReport.conditionLabel}{props.endReport.conditionNote ? ` — ${props.endReport.conditionNote}` : ''}
                {props.endReport.photoUrl && <> · <a href={props.endReport.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto</a></>}</p>
              <p>Bensin besok: {props.endReport.fuel ? `perlu, ± Rp${new Intl.NumberFormat('id-ID').format(props.endReport.fuel)}` : 'tidak perlu'}</p>
              {props.endReport.problemNote && <p>Masalah: {props.endReport.problemNote}</p>}
            </div>
          ) : <p className="text-sm text-ink-muted">Laporan Pulang driver belum terkirim.</p>)}
        </Card>
        <Card className="space-y-2">
          <h2 className="font-semibold">Awak</h2>
          <ul className="space-y-1 text-sm">
            {props.allCrew.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className={c.removed ? 'text-ink-muted' : ''}>
                  {c.name} ({c.roleLabel.toLowerCase()}){c.addedAfter ? ` · ditambahkan ${c.addedAt}` : ''}
                  {c.removed ? ` · dilepas ${c.removedAt}: ${c.removeReason ?? ''}` : ''}
                </span>
                {props.canManage && card.status === 'RUNNING' && !c.removed && (
                  <Button size="sm" variant="ghost" onClick={() => open({ kind: 'remove_crew', crewId: c.id, name: c.name })}>Copot</Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-semibold">Belanja ke supplier</h2>
          {!props.shopping.length ? <p className="text-sm text-ink-muted">Trip ini tanpa belanja.</p> : (
            <ul className="space-y-1 text-sm">
              {props.shopping.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {s.name} <Badge tone={SHOP_STATUS[s.status].tone}>{SHOP_STATUS[s.status].label}</Badge>
                    {s.doneAt ? ` ${s.doneAt}` : ''}{s.dropReason ? ` · ${s.dropReason}` : ''}
                    {s.receiptUrl && <> · <a href={s.receiptUrl} target="_blank" rel="noreferrer" className="underline">Foto nota</a></>}
                  </span>
                  {props.canManage && card.status === 'RUNNING' && s.status === 'OPEN' && (
                    <Button size="sm" variant="ghost" onClick={() => open({ kind: 'drop_shopping', shoppingId: s.id, name: s.name })}>Tidak jadi</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-2">
          <h2 className="font-semibold">Ritase & belanja tercatat</h2>
          {!props.wages.length ? (
            <p className="text-sm text-ink-muted">{card.status === 'DONE' ? 'Tidak ada.' : 'Dicatat otomatis saat trip Selesai.'}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {props.wages.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className={w.cancelled ? 'text-ink-muted line-through' : ''}>
                    {w.name} · {w.kindLabel} {w.route} · {w.roleLabel.toLowerCase()}{w.kindLabel === 'Ritase' ? (w.withAssistant ? ', berkenek' : ', tanpa kenek') : ''}
                  </span>
                  {w.cancelled ? <Badge tone="danger">Dibatalkan: {w.cancelReason}</Badge>
                    : props.canCancelWage && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'cancel_wage', wageId: w.id, name: `${w.name} ${w.kindLabel} ${w.route}` })}>Batalkan</Button>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">Nominal upah dihitung di Gaji Driver (menyusul).</p>
        </Card>
      </div>

      <Dialog
        open={!!ask} onClose={() => setAsk(null)} title={ask ? titles[ask.kind] : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAsk(null)}>Batal</Button><Button loading={busy} onClick={run} disabled={ask?.kind === 'close' && !photo}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {ask && 'name' in ask && <p>{ask.name}</p>}
          {ask?.kind === 'close' && <p>Untuk HP atau GPS driver yang bermasalah. Absen pulang awak = jam penutupan ini, ritase tetap dicatat sekali.</p>}
          {ask?.kind === 'remove_crew' && <p>Orang yang dicopot tidak mendapat ritase otomatis dari trip ini.</p>}
          {ask?.kind === 'release_visit' && <p>Semua surat jalan untuk tujuan ini kembali ke Menunggu dikirim dan bisa dimasukkan ke trip berikutnya.</p>}
          {ask?.kind === 'ready' && <p>Trip muncul di Trip Saya driver dan kenek, dan baru bisa Berangkat sesudah ini. Untuk mengubah trip lagi, tekan Kembali ke Draft.</p>}
          {ask?.kind === 'unready' && <p>Trip hilang dari Trip Saya awak sampai ditandai Siap Kirim lagi.</p>}
          {ask?.kind === 'add_crew' && (
            <Field id="add-role" label="Peran">
              <Select id="add-role" value={role} onChange={(e) => { setRole(e.target.value as 'DRIVER' | 'ASSISTANT'); setPick(''); }}>
                <option value="ASSISTANT">Kenek</option>
                <option value="DRIVER">Driver</option>
              </Select>
            </Field>
          )}
          {(ask?.kind === 'add_crew' || ask?.kind === 'add_shopping') && (
            <Field id="add-pick" label={ask.kind === 'add_crew' ? 'Orang' : 'Supplier'} hint={ask.kind === 'add_crew' ? 'Absen masuknya tercatat saat ini, bertanda "ditambahkan kantor".' : undefined}>
              <Select id="add-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Pilih</option>
                {addList.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
          )}
          {needsReason && (
            <Field id="ask-reason" label="Alasan">
              <Textarea id="ask-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          {ask?.kind === 'close' && (photo ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(photo)} alt="Pratinjau foto" className="max-h-48 rounded-lg" />
              <Button size="sm" variant="secondary" onClick={() => setPhoto(null)}>Ulangi foto</Button>
            </div>
          ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Ambil foto bukti" />)}
        </div>
      </Dialog>
    </div>
  );
}
