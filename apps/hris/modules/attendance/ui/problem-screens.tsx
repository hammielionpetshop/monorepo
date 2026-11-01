'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import { PROBLEM_STATUSES, PROBLEM_STATUS_LABELS, cleanText, type ProblemStatus } from '../rules/end-of-day';
import { AddNote } from './handover-screens';

type Note = { text: string; at: string };
type MyRow = {
  id: number; body: string; sentAt: string; concernsGm: boolean; hasPhoto: boolean; status: ProblemStatus; statusLabel: string;
  response: string | null; notes: Note[];
};

const tone = (status: ProblemStatus) => (status === 'DONE' ? 'ok' : status === 'IN_PROGRESS' ? 'info' : 'warn');

/** KEH-L23 Lapor Masalah: kirim baru + daftar milik sendiri. */
export function MyProblemsScreen({ allowed, rows }: { allowed: boolean; rows: MyRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [concernsGm, setConcernsGm] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.set('body', body);
    form.set('concernsGm', String(concernsGm));
    if (photo) form.set('photo', photo);
    const result = await postJson('/api/attendance/problems', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum terkirim. Coba lagi.');
    setBody('');
    setConcernsGm(false);
    setPhoto(null);
    setMessage(String(result.data?.message ?? 'Terkirim.'));
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {allowed && (
        <Card className="max-w-lg space-y-3">
          <h2 className="font-semibold">Laporan baru</h2>
          <p className="text-sm text-ink-muted">Hanya Pemilik dan GM yang membaca, termasuk nama Anda. Laporan ini tidak berakibat apa pun bagi Anda.</p>
          {error && <Alert tone="danger">{error}</Alert>}
          {message && <Alert tone="ok">{message}</Alert>}
          <Field id="problem-body" label="Ceritakan masalahnya" hint="Paling sedikit 10 huruf.">
            <Textarea id="problem-body" rows={4} value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={concernsGm} onChange={(event) => setConcernsGm(event.target.checked)} />
            Menyangkut GM (hanya Pemilik yang membaca)
          </label>
          <Field id="problem-photo" label="Foto" hint="Boleh kosong. Dari kamera atau galeri.">
            <Input id="problem-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          </Field>
          <Button loading={busy} disabled={cleanText(body).length < 10} onClick={() => void send()}>Kirim</Button>
        </Card>
      )}
      <h2 className="font-semibold">Laporan saya</h2>
      {!rows.length && <EmptyState title="Belum ada laporan masalah." />}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={tone(row.status)}>{row.statusLabel}</Badge>
                <span className="text-ink-muted">{row.sentAt}</span>
                {row.concernsGm && <Badge tone="info">Menyangkut GM</Badge>}
                {row.hasPhoto && <span className="text-ink-muted">· ada foto</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{row.body}</p>
              {row.notes.map((note, i) => <p key={i} className="rounded bg-canvas p-2 text-sm text-ink-muted">Keterangan {note.at}: {note.text}</p>)}
              {row.response && <p className="text-sm"><span className="text-ink-muted">Tanggapan:</span> {row.response}</p>}
              <AddNote endpoint="/api/attendance/problems/update" id={row.id} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ListRow = MyRow & { reporter: string; origin: 'END_OF_DAY' | 'MENU' };

function Decide({ row }: { row: ListRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<ProblemStatus>(row.status);
  const [response, setResponse] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(confirmNames: boolean) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/attendance/problems/update', { action: 'status', id: row.id, status, response, confirmNames });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Belum tersimpan.');
    if (result.data?.warning) return setWarning(String(result.data.warning));
    setWarning(null);
    setResponse('');
    router.refresh();
  }
  return (
    <div className="space-y-2 border-t border-line pt-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {warning && (
        <Alert tone="warn">
          {warning}
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void save(true)}>Tetap simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => setWarning(null)}>Ubah tanggapan</Button>
          </div>
        </Alert>
      )}
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <Field id={`status-${row.id}`} label="Status">
          <Select id={`status-${row.id}`} value={status} onChange={(event) => setStatus(event.target.value as ProblemStatus)}>
            {PROBLEM_STATUSES.map((key) => <option key={key} value={key}>{PROBLEM_STATUS_LABELS[key]}</option>)}
          </Select>
        </Field>
        <Field id={`response-${row.id}`} label="Tanggapan untuk pelapor" hint="Opsional, satu kalimat. Jangan sebut nama orang.">
          <Input id={`response-${row.id}`} value={response} maxLength={300} onChange={(event) => { setResponse(event.target.value); setWarning(null); }} />
        </Field>
      </div>
      <Button size="sm" loading={busy && !warning} disabled={Boolean(warning)} onClick={() => void save(false)}>Simpan</Button>
    </div>
  );
}

/** KEH-L24 Laporan Masalah (rahasia). Laporan menyangkut GM tidak sampai ke GM sama sekali. */
export function ProblemListScreen({ status, selectedId, counts, cards }: {
  status: ProblemStatus | null; selectedId: number | null; counts: Record<string, number>; cards: ListRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/kehadiran/laporan-masalah" className={status ? 'text-ink-muted' : 'font-semibold'}>Semua</Link>
        {PROBLEM_STATUSES.map((key) => (
          <Link key={key} href={`/kehadiran/laporan-masalah?status=${key}`} className={status === key ? 'font-semibold' : 'text-ink-muted'}>
            {PROBLEM_STATUS_LABELS[key]} ({counts[key] ?? 0})
          </Link>
        ))}
      </div>
      {!cards.length && <EmptyState title="Tidak ada laporan masalah." />}
      <ul className="space-y-3">
        {cards.map((row) => (
          <li key={row.id} id={`laporan-${row.id}`}>
            <Card className={`space-y-2 ${selectedId === row.id ? 'ring-2 ring-brand-600' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={tone(row.status)}>{row.statusLabel}</Badge>
                <span className="font-semibold">{row.reporter}</span>
                <span className="text-ink-muted">{row.sentAt} · {row.origin === 'END_OF_DAY' ? 'dari Laporan Pulang' : 'dari menu'}</span>
                {row.concernsGm && <Badge tone="danger">Menyangkut GM</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{row.body}</p>
              {row.notes.map((note, i) => <p key={i} className="rounded bg-canvas p-2 text-sm text-ink-muted">Keterangan pelapor {note.at}: {note.text}</p>)}
              {row.hasPhoto && (
                <a href={`/api/attendance/problems/${row.id}/photo`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/attendance/problems/${row.id}/photo`} alt="Foto laporan masalah" loading="lazy" className="max-h-48 rounded-lg" />
                </a>
              )}
              {row.response && <p className="text-sm"><span className="text-ink-muted">Tanggapan terakhir:</span> {row.response}</p>}
              <Decide row={row} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
