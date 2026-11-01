'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { GENDER_LABELS, GENDERS, IDENTITY_FIELDS, IDENTITY_LABELS, type IdentityField } from '../rules/fields';
import { formatLongDate } from '../rules/dates';

type Values = Record<IdentityField, string>;
const BANK: readonly IdentityField[] = ['bankName', 'bankAccountNumber', 'bankAccountHolder'];

const toForm = (values: Record<string, string | null | undefined>): Values =>
  Object.fromEntries(IDENTITY_FIELDS.map((f) => [f, values[f] ?? ''])) as Values;

/**
 * KAR-L12 Ubah data identitas: nilai lama di samping nilai baru. Mengganti rekening wajib melampirkan foto buku
 * tabungan atau kartu ATM (kamera atau galeri, KAR-80). Disimpan sebagai pengajuan; data lama tetap berlaku.
 */
export function IdentityChangeForm({ current, prefill, resubmittedFromId }: {
  current: Record<IdentityField, string | null>;
  prefill?: Record<string, unknown> | null;
  resubmittedFromId?: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => toForm({ ...current, ...(prefill as Record<string, string | null> | undefined) }), [current, prefill]);
  const [form, setForm] = useState<Values>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = IDENTITY_FIELDS.filter((f) => form[f].trim() !== (current[f] ?? ''));
  const bankChanged = changed.some((f) => BANK.includes(f));

  function reset() {
    setForm(toForm(current));
    setPhoto(null);
    setError(null);
  }

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (!changed.length) return setError('Tidak ada data yang berubah.');
    if (bankChanged && !photo) return setError('Foto buku tabungan atau kartu ATM wajib dilampirkan saat mengganti rekening.');
    setBusy(true);
    const attachmentIds: string[] = [];
    if (photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) {
        setBusy(false);
        return setError(uploaded.error ?? 'Foto gagal diunggah.');
      }
      attachmentIds.push(String(uploaded.data?.id));
    }
    const fields = Object.fromEntries(changed.map((f) => [f, form[f].trim() || null]));
    const result = await postJson('/api/requests', {
      kind: 'submit', typeKey: 'identity_change', fields, attachmentIds, resubmittedFromId: resubmittedFromId ?? null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Pengajuan gagal dikirim.');
    toast(String(result.data?.message ?? 'Pengajuan terkirim.'), 'ok');
    router.push(`/pengajuan/${result.data?.id}`);
    router.refresh();
  }

  const shown = (field: IdentityField) => {
    const value = current[field];
    if (!value) return '—';
    if (field === 'gender') return GENDER_LABELS[value as keyof typeof GENDER_LABELS] ?? value;
    if (field === 'birthDate') return formatLongDate(value.slice(0, 10));
    return value;
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        {IDENTITY_FIELDS.map((field) => (
          <Field key={field} id={`id-${field}`} label={IDENTITY_LABELS[field]} hint={`Sekarang: ${shown(field)}`}>
            {field === 'gender' ? (
              <Select id={`id-${field}`} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}>
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </Select>
            ) : (
              <Input
                id={`id-${field}`}
                type={field === 'birthDate' ? 'date' : 'text'}
                inputMode={field === 'bankAccountNumber' ? 'numeric' : undefined}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            )}
          </Field>
        ))}
        {bankChanged && (
          <Field id="id-photo" label="Foto buku tabungan atau kartu ATM" hint="Wajib saat mengganti rekening. JPG, PNG, atau WebP, paling besar 10 MB.">
            <input
              id="id-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </Field>
        )}
        <p className="text-sm text-ink-muted">
          {changed.length ? `${changed.length} data akan diubah.` : 'Ubah isian yang perlu diganti.'} Data lama tetap dipakai sampai HR menyetujui.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={reset}>Ulangi dari awal</Button>
          <Button type="submit" loading={busy}>Kirim pengajuan</Button>
        </div>
      </form>
    </Card>
  );
}
