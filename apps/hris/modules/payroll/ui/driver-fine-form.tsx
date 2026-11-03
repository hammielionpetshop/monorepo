'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';

type Person = { id: number; name: string; branchName: string; weekly: boolean; trips: { id: number; number: string; role: string }[] };
type Kind = { id: number; name: string; example: string; amount: number };

const ROLE: Record<string, string> = { DRIVER: 'Driver', ASSISTANT: 'Kenek' };

/**
 * Ajukan Denda (4 langkah, HP & PC; spec L7 §3.6): tanggal + orang, jenis (nominal dari jenis), uraian + foto, periksa.
 * Kepala Gudang = usulan; Pemilik/GM langsung berlaku. Ganti tanggal memuat ulang daftar orang dan jenis tanggal itu.
 */
export function DriverFineForm({ today, date, minDate, direct, note, minDescription, people, kinds }: {
  today: string; date: string; minDate: string; backdateDays: number; direct: boolean; note: string; minDescription: number; people: Person[]; kinds: Kind[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [tripId, setTripId] = useState('');
  const [kindId, setKindId] = useState(kinds.length === 1 ? String(kinds[0].id) : '');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people.find((p) => String(p.id) === employeeId);
  const kind = kinds.find((k) => String(k.id) === kindId);

  function next() {
    setError(null);
    if (step === 1 && !employeeId) return setError('Pilih orangnya.');
    if (step === 2 && !kindId) return setError('Pilih jenis denda.');
    if (step === 3 && description.trim().length < minDescription) return setError(`Uraian paling sedikit ${minDescription} huruf.`);
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    let photoId: string | null = null;
    if (photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      photoId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/payroll/fines', {
      kind: 'fine_record', employeeId: Number(employeeId), kindId: Number(kindId), occurredOn: date, tripId: tripId ? Number(tripId) : null,
      description: description.trim(), photoId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(direct ? 'Denda berlaku. Orangnya diberi tahu.' : String(result.data?.message ?? 'Usulan terkirim.'), 'ok');
    router.push('/gaji/denda-driver');
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 4 · {direct ? 'langsung berlaku' : 'usulan ke Pemilik atau GM'}</p>
      <Alert tone="info">{note}</Alert>
      {step === 1 && (
        <div className="space-y-3">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Field id="df-date" label="Tanggal kejadian" hint={`Hari ini sampai ${longDate(minDate)}.`}>
              <Input id="df-date" type="date" name="tanggal" min={minDate} max={today} defaultValue={date} />
            </Field>
            <Button type="submit" variant="secondary">Ganti tanggal</Button>
          </form>
          <Field id="df-person" label="Orang" hint="Orang bergaji Mingguan atau awak trip pada tanggal itu. Pemilik, GM, dan diri sendiri tidak bisa dipilih.">
            <Select id="df-person" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setTripId(''); }}>
              <option value="">Pilih orang</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.branchName}{p.trips.length ? ` · ${p.trips.length} trip` : ''}</option>)}
            </Select>
          </Field>
          {people.length === 0 && <Alert tone="warn">Tidak ada orang Mingguan atau awak trip pada tanggal ini.</Alert>}
          {person && person.trips.length > 0 && (
            <Field id="df-trip" label="Trip (bila kejadiannya di trip)">
              <Select id="df-trip" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">Tidak terkait trip</option>
                {person.trips.map((t) => <option key={t.id} value={t.id}>{t.number} · {ROLE[t.role] ?? t.role}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field id="df-kind" label="Jenis denda" hint="Nominal mengikuti Jenis Denda pada tanggal kejadian; tidak diketik.">
            <Select id="df-kind" value={kindId} onChange={(e) => setKindId(e.target.value)}>
              <option value="">Pilih jenis</option>{kinds.map((k) => <option key={k.id} value={k.id}>{k.name} · {rupiah(k.amount)}</option>)}
            </Select>
          </Field>
          {kind?.example && <p className="text-sm text-ink-muted">Contoh: {kind.example}</p>}
          {kinds.length === 0 && <Alert tone="warn">Belum ada jenis denda yang aktif pada tanggal ini.</Alert>}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <Field id="df-desc" label="Uraian kejadian" hint={`Paling sedikit ${minDescription} huruf.`}>
            <Textarea id="df-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field id="df-photo" label="Foto (bila ada)"><Input id="df-photo" type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2 text-sm">
          <p><b>{kind?.name}</b> untuk <b>{person?.name}</b>: <b className="tabular-nums">{rupiah(kind?.amount ?? 0)}</b></p>
          <p>Tanggal kejadian {longDate(date)}{tripId ? ` · trip ${person?.trips.find((t) => String(t.id) === tripId)?.number}` : ''}.</p>
          <p className="text-ink-muted">Uraian: {description}</p>
          <p className="text-ink-muted">
            {direct ? 'Langsung berlaku.' : 'Terkirim sebagai usulan; belum dipotong sampai Pemilik atau GM mengesahkan.'} Dipotong di slip utama periode tanggal kejadian
            (atau slip berikutnya bila sudah ditutup). Orangnya diberi tahu dan boleh mengajukan keberatan paling lambat 3 hari.
          </p>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/gaji/denda-driver">Batal</Link>}
        {step < 4 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={save}>{direct ? 'Simpan' : 'Kirim usulan'}</HoldButton>}
      </div>
    </Card>
  );
}
