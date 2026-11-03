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
import { MONEY_DATE_FREE_DAYS, daysBetween, longDate, rupiah, splitInstallments } from '../rules/advance';

export type ManageMode = 'repay' | 'write_off' | 'reschedule' | 'reverse';

type Props = {
  mode: ManageMode;
  id: number; number: string; name: string; remaining: number; carried: number; today: string; handedOn: string;
  sources: { id: number; name: string; method: string }[];
  waiting: { amount: number; period: string }[];
  reschedule: { total: number; maxCount: number; starts: { value: string; label: string }[] };
  movement: { id: number; kind: string; amount: number; text: string } | null;
  allowed: boolean;
};

const TITLES: Record<ManageMode, string> = { repay: 'Terima pelunasan', write_off: 'Hapus utang', reschedule: 'Ubah jadwal', reverse: 'Batalkan catatan' };

/**
 * DRV-L34 Terima pelunasan, DRV-L35 Hapus utang, DRV-L36 Ubah jadwal, DRV-L39 Batalkan pelunasan/hapus.
 * Server memeriksa ulang semuanya; layar ini hanya membantu mengisi dan menampilkan akibatnya.
 */
export function ManageForm(props: Props) {
  const { mode, id, number, name, remaining, carried, today, handedOn, sources, waiting, reschedule, movement } = props;
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(mode === 'repay' || mode === 'write_off' ? '' : '0');
  const [sourceId, setSourceId] = useState(sources.length === 1 ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [dateReason, setDateReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [count, setCount] = useState(String(Math.min(reschedule.maxCount, Math.max(1, waiting.length))));
  const [start, setStart] = useState(reschedule.starts[0]?.value ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!props.allowed) return <Card className="max-w-xl"><Alert tone="warn">Tindakan ini tidak bisa dilakukan untuk kasbon ini sekarang.</Alert></Card>;

  const value = Number(amount.replace(/[^\d]/g, '')) || 0;
  const needsDateReason = mode === 'repay' && moneyDate <= today && daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS;
  const fromCarry = Math.min(carried, value);
  const counted = Number(count) || 1;
  const plan = reschedule.total > 0 && counted <= reschedule.total ? splitInstallments(reschedule.total, counted) : [];

  async function save() {
    setError(null);
    if ((mode === 'repay' || mode === 'write_off') && (value <= 0 || value > remaining)) return setError(`Isi nominal 1 sampai ${rupiah(remaining)}.`);
    if (mode === 'repay' && !sourceId) return setError('Pilih sumber uang.');
    if (needsDateReason && dateReason.trim().length < 15) return setError('Tulis alasan tanggal uang, paling sedikit 15 huruf.');
    if (mode !== 'repay' && reason.trim().length < 15) return setError('Alasan paling sedikit 15 huruf.');
    setBusy(true);
    let proofFileId: string | null = null;
    if (mode === 'repay' && photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      proofFileId = String(uploaded.data?.id);
    }
    const payload = mode === 'repay'
      ? { kind: 'repay', id, amount: value, sourceId: Number(sourceId), moneyDate, dateReason: needsDateReason ? dateReason.trim() : null, proofFileId }
      : mode === 'write_off' ? { kind: 'write_off', id, amount: value, reason }
        : mode === 'reschedule' ? { kind: 'reschedule', id, count: counted, start, reason }
          : { kind: 'reverse', id, movementId: movement?.id, reason };
    const result = await postJson('/api/advances', payload);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Tersimpan.'), 'ok');
    router.push(`/gaji/kasbon/${id}`);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <div className="text-sm">
        <p className="text-xs text-ink-muted">{number} · {name}</p>
        <p className="text-lg font-semibold tabular-nums">Sisa {rupiah(remaining)}</p>
        {waiting.length > 0 && <p className="text-ink-muted">Cicilan menunggu: {waiting.map((w) => `${rupiah(w.amount)} (${w.period})`).join(', ')}</p>}
        {carried > 0 && <p className="text-ink-muted">Sisa potongan kasbon yang dibawa: {rupiah(carried)}</p>}
      </div>

      {(mode === 'repay' || mode === 'write_off') && (
        <>
          <Field id="mg-amount" label="Nominal" hint={`Paling banyak ${rupiah(remaining)}.`}>
            <div className="flex gap-2">
              <Input id="mg-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
              <Button variant="secondary" size="sm" onClick={() => setAmount(String(remaining))}>{mode === 'repay' ? 'Lunasi semua' : 'Hapus semua'}</Button>
            </div>
          </Field>
          {value > 0 && value <= remaining && (
            <p className="text-sm text-ink-muted">
              Mengurangi {fromCarry > 0 ? `sisa dibawa ${rupiah(fromCarry)}${value > fromCarry ? ' lalu ' : ''}` : ''}{value > fromCarry ? `cicilan terdekat ${rupiah(value - fromCarry)}` : ''}. Sisa sesudahnya {rupiah(remaining - value)}{remaining - value === 0 ? (mode === 'repay' ? ' — kasbon lunas' : ' — kasbon selesai') : ''}.
            </p>
          )}
        </>
      )}

      {mode === 'repay' && (
        <>
          <Field id="mg-source" label="Masuk ke (sumber uang)">
            <Select id="mg-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Pilih sumber uang</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.method === 'TRANSFER' ? 'transfer' : 'tunai'}</option>)}
            </Select>
          </Field>
          <Field id="mg-date" label="Tanggal uang" hint={`Tidak sebelum diberikan (${longDate(handedOn)}); mundur lebih dari ${MONEY_DATE_FREE_DAYS} hari wajib alasan.`}>
            <Input id="mg-date" type="date" value={moneyDate} min={handedOn} max={today} onChange={(e) => setMoneyDate(e.target.value)} />
          </Field>
          {needsDateReason && (
            <Field id="mg-date-reason" label="Alasan tanggal uang"><Textarea id="mg-date-reason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} /></Field>
          )}
          <Field id="mg-photo" label="Foto bukti (dianjurkan)"><Input id="mg-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        </>
      )}

      {mode === 'write_off' && (
        <Alert tone="warn">Tidak ada uang yang bergerak. Jumlahnya dicatat sebagai biaya &quot;Utang kasbon dihapus&quot; di tab Uang Kasbon. Orangnya dan para pemilik diberi tahu. Ini bukan pemberian.</Alert>
      )}

      {mode === 'reschedule' && (
        reschedule.total <= 0 || !reschedule.starts.length ? <Alert tone="warn">Tidak ada cicilan yang bisa dijadwalkan ulang.</Alert> : (
          <>
            <Field id="mg-count" label="Banyaknya cicilan" hint={`1 sampai ${reschedule.maxCount}. Jumlahnya tetap ${rupiah(reschedule.total)}.`}>
              <Select id="mg-count" value={count} onChange={(e) => setCount(e.target.value)}>
                {Array.from({ length: reschedule.maxCount }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} kali</option>)}
              </Select>
            </Field>
            <Field id="mg-start" label="Mulai gajian">
              <Select id="mg-start" value={start} onChange={(e) => setStart(e.target.value)}>
                {reschedule.starts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            {plan.length > 0 && <p className="text-sm text-ink-muted">Jadwal baru: {plan.map(rupiah).join(' + ')}. Tidak memakai jatah tunda.</p>}
          </>
        )
      )}

      {mode === 'reverse' && movement && (
        <p className="text-sm">{movement.text} {rupiah(movement.amount)} dibatalkan. Jumlahnya kembali ke cicilan terdekat (atau satu cicilan baru di slip terbuka berikutnya), dan sisa kasbon bertambah {rupiah(movement.amount)}.</p>
      )}

      {mode !== 'repay' && (
        <Field id="mg-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="mg-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/kasbon/${id}`}>Batal</Link>
        <HoldButton loading={busy} onClick={save}>{TITLES[mode]}</HoldButton>
      </div>
    </Card>
  );
}
