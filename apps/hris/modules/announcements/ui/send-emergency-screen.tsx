'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QueueHold } from '@/components/queue';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { EMERGENCY_TITLE_MAX, letterCount } from '../rules/emergency';
import type { EmergencyLimitsView } from '../server/emergency';
import { dateText } from './shared';

type Option = { id: number; name: string };

const STEPS = ['Isi', 'Sasaran & masa tayang', 'Periksa & Kirim'] as const;

/** Kirim pengumuman darurat (BER-L24): 3 langkah, tombol Kirim ditahan, jumlah penerima tampil. */
export function SendEmergencyScreen({ branches, positions, limits }: { branches: Option[]; positions: Option[]; limits: EmergencyLimitsView }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [all, setAll] = useState(true);
  const [branchIds, setBranchIds] = useState<number[]>([]);
  const [positionIds, setPositionIds] = useState<number[]>([]);
  const [untilToday, setUntilToday] = useState(true);
  const [untilDate, setUntilDate] = useState(limits.today);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = all ? { all: true as const } : { all: false as const, branchIds, positionIds };
  const showsUntilDate = untilToday ? limits.today : untilDate;
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    if (step < 1) return;
    let stale = false;
    setRecipients(null);
    void postJson('/api/announcements/emergency/preview', { target: JSON.parse(targetKey) }).then((res) => {
      if (!stale) setRecipients(res.ok ? Number(res.data?.recipients ?? 0) : 0);
    });
    return () => { stale = true; };
  }, [step, targetKey]);

  function next() {
    setError(null);
    if (step === 0) {
      if (!title.trim() || !message.trim()) return setError('Judul dan pesan wajib diisi.');
      if (letterCount(title.trim()) > EMERGENCY_TITLE_MAX) return setError(`Judul paling banyak ${EMERGENCY_TITLE_MAX} huruf.`);
      if (letterCount(message.trim()) > limits.maxChars) return setError(`Pesan paling banyak ${limits.maxChars} huruf.`);
    }
    if (step === 1) {
      if (!all && !branchIds.length && !positionIds.length) return setError('Pilih Semua orang, atau minimal satu cabang atau jabatan.');
      if (!untilToday && (untilDate < limits.today || untilDate > limits.lastDate)) return setError(`Pilih tanggal antara hari ini dan ${dateText(limits.lastDate)}.`);
      if (recipients === 0) return setError('Tidak ada karyawan aktif pada sasaran ini.');
    }
    setStep((n) => n + 1);
  }

  async function send() {
    setBusy(true);
    setError(null);
    const res = await postJson('/api/announcements/emergency', { title, message, target, showsUntilDate });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Gagal mengirim.');
    toast(`Pengumuman darurat terkirim ke ${res.data?.recipients ?? 0} orang.`, 'ok');
    router.push(`/announcements/${res.data?.id}`);
    router.refresh();
  }

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const chosen = (options: Option[], ids: number[]) => options.filter((o) => ids.includes(o.id)).map((o) => o.name).join(', ');
  const messageCount = letterCount(message.trim());

  return (
    <Card className="max-w-2xl space-y-5">
      <QueueHold />
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? 'font-semibold text-brand-700' : 'text-ink-muted'}>{index + 1}. {label}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <Field id="emergency-title" label="Judul" hint={`${letterCount(title.trim())}/${EMERGENCY_TITLE_MAX} huruf`}>
            <Input id="emergency-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Toko Singaparna tutup hari ini" />
          </Field>
          <Field id="emergency-message" label="Pesan" hint={`${messageCount}/${limits.maxChars} huruf — pendek supaya terbaca dalam 5 detik`} error={messageCount > limits.maxChars ? `Pesan lebih dari ${limits.maxChars} huruf.` : null}>
            <Textarea id="emergency-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sasaran</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="target" checked={all} onChange={() => setAll(true)} /> Semua orang</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="target" checked={!all} onChange={() => setAll(false)} /> Cabang dan/atau jabatan tertentu</label>
          </fieldset>
          {!all && (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Cabang <span className="font-normal text-ink-muted">(kosong = semua cabang)</span></legend>
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => setBranchIds(toggle(branchIds, b.id))} /> {b.name}
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Jabatan <span className="font-normal text-ink-muted">(kosong = semua jabatan)</span></legend>
                {positions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={positionIds.includes(p.id)} onChange={() => setPositionIds(toggle(positionIds, p.id))} /> {p.name}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
          {!all && branchIds.length > 0 && positionIds.length > 0 && (
            <p className="text-xs text-ink-muted">Yang menerima hanya orang yang cabang <strong>dan</strong> jabatannya cocok.</p>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tayang sampai</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="until" checked={untilToday} onChange={() => setUntilToday(true)} /> Akhir hari ini</label>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input type="radio" name="until" checked={!untilToday} onChange={() => setUntilToday(false)} /> Akhir tanggal
              <Input type="date" className="w-auto" min={limits.today} max={limits.lastDate} value={untilDate} disabled={untilToday} onChange={(e) => setUntilDate(e.target.value)} aria-label="Tanggal terakhir tayang" />
            </label>
            <p className="text-xs text-ink-muted">Paling lama {limits.maxDays} hari, sampai {dateText(limits.lastDate)}.</p>
          </fieldset>
          <p className="text-sm">Penerima: <strong>{recipients == null ? 'menghitung…' : `${recipients} orang`}</strong></p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Alert tone="danger" title={title.trim()}>{message.trim()}</Alert>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2"><dt className="text-ink-muted">Sasaran:</dt><dd>{all ? 'Semua orang' : [branchIds.length ? chosen(branches, branchIds) : 'semua cabang', positionIds.length ? chosen(positions, positionIds) : 'semua jabatan'].join(' · ')}</dd></div>
            <div className="flex gap-2"><dt className="text-ink-muted">Tayang sampai:</dt><dd>akhir {dateText(showsUntilDate)}</dd></div>
            <div className="flex gap-2"><dt className="text-ink-muted">Penerima:</dt><dd><strong>{recipients ?? '…'} orang</strong></dd></div>
          </dl>
          <p className="text-xs text-ink-muted">Sesudah terkirim, pengumuman tidak bisa diubah atau dihapus. Bila salah, akhiri lalu kirim yang benar.</p>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={() => (step === 0 ? router.push('/announcements?view=emergency') : setStep((n) => n - 1))} disabled={busy}>
          {step === 0 ? 'Batal' : 'Kembali'}
        </Button>
        {step < 2
          ? <Button onClick={next} disabled={step === 1 && recipients == null}>Lanjut</Button>
          : <HoldButton key="send" variant="danger" loading={busy} onClick={() => void send()}>Kirim ke {recipients ?? '…'} orang</HoldButton>}
      </div>
    </Card>
  );
}
