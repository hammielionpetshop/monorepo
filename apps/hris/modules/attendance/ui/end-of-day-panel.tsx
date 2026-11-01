'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import { END_OF_DAY_STEPS, cleanText, nextStep, previousStep, type EndOfDayStep } from '../rules/end-of-day';

type Pending = {
  dayId: number; workDate: string; branchName: string; until: string; minLength: number;
  team: string[]; people: { id: number; name: string }[];
};
type Handover = { id: number; from: string; branch: string; sentAt: string; text: string; hasPhoto: boolean; notes: { text: string; at: string }[] };
type Relocation = { workDate: string; branchName: string; homeName: string; workdays: number };

type Draft = { handover: string; mode: 'TEAM' | 'PEOPLE'; people: number[]; hasProblem: boolean; problem: string; concernsGm: boolean };
const EMPTY: Draft = { handover: '', mode: 'TEAM', people: [], hasProblem: false, problem: '', concernsGm: false };

const draftKey = (dayId: number) => `hris.laporan-pulang.${dayId}`;

function loadDraft(dayId: number): Draft {
  try {
    const raw = window.localStorage.getItem(draftKey(dayId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveDraft(dayId: number, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(draftKey(dayId), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(dayId));
  } catch {
    // Penyimpanan HP tidak tersedia: isian hanya hilang bila halaman ditutup.
  }
}

const STEP_TITLES: Record<EndOfDayStep, string> = { HANDOVER: 'Serah terima', PROBLEM: 'Ada masalah?', SEND: 'Periksa lalu kirim' };

/** Foto dari kamera atau galeri (TAM-08). Fotonya dipilih ulang bila halaman dibuka lagi (spec §9 butir 4). */
function PhotoPicker({ id, label, file, onChange }: { id: string; label: string; file: File | null; onChange: (file: File | null) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <Field id={id} label={label} hint="Boleh kosong. Dari kamera atau galeri.">
      <div className="space-y-2">
        <Input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={label} className="max-h-48 rounded-lg" />}
        {file && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Hapus foto</Button>}
      </div>
    </Field>
  );
}

/** Laporan Pulang berurutan (KEH-L20, KEH-125). */
function EndOfDayFlow({ pending, onClose, onSent }: { pending: Pending; onClose: () => void; onSent: (message: string, relocation: Relocation | null) => void }) {
  const [step, setStep] = useState<EndOfDayStep>('HANDOVER');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [handoverPhoto, setHandoverPhoto] = useState<File | null>(null);
  const [problemPhoto, setProblemPhoto] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(loadDraft(pending.dayId)), [pending.dayId]);
  const update = (patch: Partial<Draft>) => setDraft((current) => {
    const next = { ...current, ...patch };
    saveDraft(pending.dayId, next);
    return next;
  });

  const length = cleanText(draft.handover).length;
  const handoverOk = length >= pending.minLength && (draft.mode === 'TEAM' || draft.people.length > 0);
  const problemOk = !draft.hasProblem || cleanText(draft.problem).length >= 10;
  const chosen = pending.people.filter((person) => draft.people.includes(person.id));
  const matches = search.trim()
    ? pending.people.filter((person) => person.name.toLowerCase().includes(search.trim().toLowerCase()) && !draft.people.includes(person.id)).slice(0, 8)
    : [];

  async function send() {
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.set('dayId', String(pending.dayId));
    form.set('handover', draft.handover);
    form.set('recipientMode', draft.mode);
    form.set('recipientIds', JSON.stringify(draft.mode === 'PEOPLE' ? draft.people : []));
    if (handoverPhoto) form.set('handoverPhoto', handoverPhoto);
    if (draft.hasProblem) {
      form.set('problem', draft.problem);
      form.set('concernsGm', String(draft.concernsGm));
      if (problemPhoto) form.set('problemPhoto', problemPhoto);
    }
    const result = await postJson('/api/attendance/end-of-day', form);
    setBusy(false);
    if (!result.ok) {
      const text = result.error ?? '';
      return setError(text.includes('jaringan') ? 'Belum terkirim. Isian tersimpan di HP ini; coba lagi saat sinyal ada.' : text);
    }
    saveDraft(pending.dayId, null);
    onSent(String(result.data?.message ?? 'Laporan Pulang terkirim.'), (result.data?.relocation as Relocation | null) ?? null);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <p className="text-sm text-ink-muted">Laporan Pulang · Langkah {END_OF_DAY_STEPS.indexOf(step) + 1} dari 3 · {pending.branchName}</p>
      {error && <Alert tone="danger">{error}</Alert>}

      {step === 'HANDOVER' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">{STEP_TITLES.HANDOVER}</h2>
          <Field id="handover-text" label="Apa yang perlu diketahui tim berikutnya?" hint={`Paling sedikit ${pending.minLength} huruf · sekarang ${length}`}>
            <Textarea
              id="handover-text" rows={5} value={draft.handover} maxLength={2000}
              placeholder="Contoh: Stok pasir kucing 10 L tinggal 2, sudah dicatat. Pelanggan Bu Rina akan ambil pesanan besok pagi."
              onChange={(event) => update({ handover: event.target.value })}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Penerima</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="handover-mode" checked={draft.mode === 'TEAM'} onChange={() => update({ mode: 'TEAM' })} />
              Tim saya
            </label>
            {draft.mode === 'TEAM' && (
              <p className="pl-6 text-sm text-ink-muted">{pending.team.length ? pending.team.join(', ') : 'Tidak ada orang lain. Laporan tetap terkirim sebagai "Tidak ada penerima".'}</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="handover-mode" checked={draft.mode === 'PEOPLE'} onChange={() => update({ mode: 'PEOPLE' })} />
              Pilih orang
            </label>
            {draft.mode === 'PEOPLE' && (
              <div className="space-y-2 pl-6">
                <Input aria-label="Cari nama" placeholder="Cari nama" value={search} onChange={(event) => setSearch(event.target.value)} />
                {matches.map((person) => (
                  <Button key={person.id} size="sm" variant="secondary" onClick={() => { update({ people: [...draft.people, person.id] }); setSearch(''); }}>
                    + {person.name}
                  </Button>
                ))}
                <div className="flex flex-wrap gap-2">
                  {chosen.map((person) => (
                    <Button key={person.id} size="sm" variant="ghost" onClick={() => update({ people: draft.people.filter((id) => id !== person.id) })}>
                      {person.name} ✕
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
          <PhotoPicker id="handover-photo" label="Foto serah terima" file={handoverPhoto} onChange={setHandoverPhoto} />
          <Button block className="min-h-12" disabled={!handoverOk} onClick={() => setStep(nextStep(step)!)}>Lanjut</Button>
        </Card>
      )}

      {step === 'PROBLEM' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">{STEP_TITLES.PROBLEM}</h2>
          <p className="text-sm text-ink-muted">Laporan masalah hanya dibaca Pemilik dan GM, dan tidak berakibat apa pun bagi Anda.</p>
          {!draft.hasProblem ? (
            <>
              <Button block className="min-h-12" onClick={() => { update({ hasProblem: false }); setStep('SEND'); }}>Lewati</Button>
              <Button block variant="secondary" className="min-h-12" onClick={() => update({ hasProblem: true })}>Isi laporan masalah</Button>
            </>
          ) : (
            <>
              <Field id="problem-text" label="Ceritakan masalahnya" hint="Paling sedikit 10 huruf.">
                <Textarea id="problem-text" rows={4} value={draft.problem} maxLength={2000} onChange={(event) => update({ problem: event.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.concernsGm} onChange={(event) => update({ concernsGm: event.target.checked })} />
                Menyangkut GM (hanya Pemilik yang membaca)
              </label>
              <PhotoPicker id="problem-photo" label="Foto masalah" file={problemPhoto} onChange={setProblemPhoto} />
              <Button block className="min-h-12" disabled={!problemOk} onClick={() => setStep('SEND')}>Lanjut</Button>
              <Button block variant="ghost" onClick={() => update({ hasProblem: false, problem: '', concernsGm: false })}>Batal isi, tidak ada masalah</Button>
            </>
          )}
        </Card>
      )}

      {step === 'SEND' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">{STEP_TITLES.SEND}</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-ink-muted">Serah terima</dt><dd className="whitespace-pre-wrap">{draft.handover}</dd></div>
            <div>
              <dt className="text-ink-muted">Penerima</dt>
              <dd>{draft.mode === 'TEAM' ? `Tim saya${pending.team.length ? ` (${pending.team.length} orang)` : ' — tidak ada penerima'}` : chosen.map((person) => person.name).join(', ')}</dd>
            </div>
            <div><dt className="text-ink-muted">Foto serah terima</dt><dd>{handoverPhoto ? 'Ada' : 'Tidak ada'}</dd></div>
            <div><dt className="text-ink-muted">Laporan masalah</dt><dd>{draft.hasProblem ? `Ada${draft.concernsGm ? ' (menyangkut GM)' : ''}` : 'Tidak ada'}</dd></div>
          </dl>
          <p className="text-sm text-ink-muted">Sesudah terkirim isinya tidak bisa diubah; Anda bisa menambah keterangan di Serah Terima Saya.</p>
          <Button block className="min-h-12" loading={busy} onClick={() => void send()}>Kirim</Button>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => { setError(null); const back = previousStep(step); if (back) setStep(back); else onClose(); }}>Kembali</Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>Tutup, lanjutkan nanti</Button>
      </div>
    </div>
  );
}

/** Jendela serah terima sesudah Masuk (KEH-L21, KEH-92): satu per laporan, tombol aktif sesudah 1 detik. */
function HandoverPopups({ handovers }: { handovers: Handover[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = handovers[index];
  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, [index]);
  if (!current) return null;
  async function markRead() {
    setError(null);
    const result = await postJson('/api/attendance/handovers', { action: 'read', id: current.id });
    if (!result.ok) return setError(result.error ?? 'Belum tersimpan. Coba lagi.');
    if (index + 1 >= handovers.length) router.refresh();
    setIndex(index + 1);
  }
  return (
    <Dialog
      open title={`Serah terima dari ${current.from}`} onClose={() => undefined}
      footer={<Button disabled={!ready} onClick={() => void markRead()}>Sudah saya baca</Button>}
    >
      <div className="space-y-2">
        <p className="text-ink-muted">{current.branch} · {current.sentAt}{handovers.length > 1 ? ` · ${index + 1} dari ${handovers.length}` : ''}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="whitespace-pre-wrap">{current.text}</p>
        {current.notes.map((note, i) => <p key={i} className="rounded bg-canvas p-2 text-ink-muted">Keterangan {note.at}: {note.text}</p>)}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current.hasPhoto && <img src={`/api/attendance/handovers/${current.id}/photo`} alt="Foto serah terima" className="max-h-64 rounded-lg" />}
      </div>
    </Dialog>
  );
}

/** Sudah Pindah Cabang? (KEH-L10) sesudah Laporan Pulang terkirim. */
function RelocationCard({ relocation, onDone }: { relocation: Relocation; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function answer(value: 'YES' | 'NOT_YET') {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/attendance/relocation', { answer: value, workDate: relocation.workDate });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum terkirim. Coba lagi.');
    onDone(String(result.data?.message ?? 'Tercatat.'));
  }
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2"><h2 className="font-semibold">Sudah pindah cabang?</h2><NewBadge feature="fitur/sudah-pindah-cabang" /></div>
      <p className="text-sm">
        {relocation.workdays} hari kerja terakhir Anda absen di <strong>{relocation.branchName}</strong>, sedangkan cabang penempatan Anda {relocation.homeName}.
        Apakah Anda sudah pindah ke {relocation.branchName}?
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button block className="min-h-12" loading={busy} onClick={() => void answer('YES')}>Ya, sudah pindah</Button>
      <Button block variant="secondary" className="min-h-12" disabled={busy} onClick={() => void answer('NOT_YET')}>Belum</Button>
      <p className="text-xs text-ink-muted">Ya = usulan ke HR, Pemilik, atau GM. Cabang penempatan tetap sampai disetujui.</p>
    </Card>
  );
}

/** Bagian L3d di layar Absen. `autoOpen` = baru saja foto Pulang. */
export function EndOfDayPanel({ pending, handovers, relocation, autoOpen }: {
  pending: Pending | null; handovers: Handover[]; relocation: Relocation | null; autoOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen && Boolean(pending));
  const [message, setMessage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Relocation | null>(relocation);
  useEffect(() => setPrompt(relocation), [relocation]);
  const pendingDay = pending?.dayId ?? null;
  useEffect(() => {
    if (autoOpen && pendingDay) setOpen(true);
  }, [autoOpen, pendingDay]);

  if (open && pending) {
    return (
      <EndOfDayFlow
        pending={pending}
        onClose={() => { setOpen(false); router.replace('/absen'); }}
        onSent={(text, next) => { setOpen(false); setMessage(text); setPrompt(next); router.replace('/absen'); router.refresh(); }}
      />
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      {message && <Alert tone="ok">{message}</Alert>}
      {pending && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Laporan Pulang menunggu</p>
            <Badge tone="warn">Sampai {pending.until}</Badge>
            <NewBadge feature="fitur/laporan-pulang" />
          </div>
          <p className="text-sm text-ink-muted">Pulang baru dihitung sesudah laporan terkirim. Jam pulang tetap jam foto Anda.</p>
          <Button block className="min-h-12" onClick={() => { setOpen(true); router.replace('/absen?laporan=1'); }}>Lanjutkan laporan</Button>
        </Card>
      )}
      {!pending && prompt && <RelocationCard relocation={prompt} onDone={(text) => { setPrompt(null); setMessage(text); router.refresh(); }} />}
      {!pending && handovers.length > 0 && <HandoverPopups handovers={handovers} />}
    </div>
  );
}
