'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Alert, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Letter = { id: number; requestId: number; range: string; open: boolean; text: string };

/** KEH-L32 Susulkan Surat Dokter: 2 langkah (foto → periksa dan Kirim). Lewat batas: tombol mati. */
export function DoctorLetterScreen({ letters }: { letters: Letter[] }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(file: File | null) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function send(letter: Letter) {
    if (!photo) return setError('Ambil atau pilih foto surat dulu.');
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append('absenceId', String(letter.id));
    body.append('photo', photo);
    const result = await postJson('/api/attendance/absence', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Surat gagal dikirim.');
    toast(String(result.data?.message ?? 'Surat terkirim.'), 'ok');
    setSelected(null);
    choose(null);
    router.refresh();
  }

  if (!letters.length) return <EmptyState title="Tidak ada surat dokter yang perlu disusulkan." />;
  return (
    <div className="space-y-3">
      {letters.map((letter) => (
        <Card key={letter.id}>
          <p className="font-semibold">Sakit {letter.range}</p>
          <p className="text-sm text-ink-muted">{letter.text}</p>
          <Link className="text-xs text-brand-700" href={`/pengajuan/${letter.requestId}`}>Lihat pengajuan PJ-{letter.requestId}</Link>
          {letter.open && selected !== letter.id && (
            <div className="mt-3"><Button onClick={() => { setSelected(letter.id); choose(null); setError(null); }}>Susulkan surat</Button></div>
          )}
          {selected === letter.id && (
            <div className="mt-3 space-y-3">
              <Field id={`dl-${letter.id}`} label="1. Foto surat dokter" hint="Kamera atau galeri.">
                <input id={`dl-${letter.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => choose(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </Field>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal sebelum dikirim
                <img src={preview} alt="Pratinjau surat" className="h-48 rounded-lg border border-line object-contain" />
              )}
              <p className="text-sm">2. Periksa: foto terbaca jelas, lalu Kirim. Sesudah dikirim tidak bisa diganti sendiri.</p>
              {error && <Alert tone="danger">{error}</Alert>}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setSelected(null); choose(null); }}>Kembali</Button>
                {photo && <Button variant="ghost" onClick={() => choose(null)}>Foto ulang</Button>}
                <Button loading={busy} disabled={!photo} onClick={() => send(letter)}>Kirim</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
