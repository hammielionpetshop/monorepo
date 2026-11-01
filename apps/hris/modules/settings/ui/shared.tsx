'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import type { SettingCell, SettingMeta } from '../server/screens';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "1 November 2026". Tanggal isi awal (2026-01-01) ditampilkan "awal". */
export function longDate(date: string | null): string {
  if (!date) return '—';
  if (date === '2026-01-01') return 'awal';
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Kirim mutasi JSON dengan token CSRF (pola modul lain; disalin karena pintu modul memuat kode server). */
async function postJson(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const csrf = await (await fetch('/api/auth/csrf', { cache: 'no-store' })).json();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? 'Permintaan gagal.' };
  } catch {
    return { ok: false, error: 'Terjadi kesalahan jaringan, silakan coba lagi.' };
  }
}

function useSend(path = '/api/settings') {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(body: unknown, success: string) {
    setBusy(true);
    setError(null);
    const result = await postJson(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(success, 'ok');
    router.refresh();
    return true;
  }
  return { busy, error, setError, send };
}

function StepLabel({ step, total, title }: { step: number; total: number; title: string }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Langkah {step} dari {total} — {title}</p>;
}

function labelOf(meta: SettingMeta, raw: unknown): string {
  if (meta.type.kind === 'choice') return meta.type.options.find((o) => o.value === raw)?.label ?? String(raw);
  return `${String(raw)}${meta.unit ? ` ${meta.unit}` : ''}`;
}

/**
 * BER-L41 Ubah satu pengaturan, langkah baku: nilai baru → tanggal berlaku + alasan → periksa.
 * Langkah "Pengumuman" dilewati di Fase 1 (keputusan owner §8 butir 3). `propose` = usulan HR: isiannya sama,
 * tetapi masuk kotak Persetujuan dan nilai lama tetap berlaku (KAR-73). `prefill` = isian lama saat Ajukan ulang.
 */
export function ChangeDialog({
  meta, cell, targetLabel, affected, onClose, propose = false, prefill, resubmitOf,
}: {
  meta: SettingMeta; cell: SettingCell; targetLabel: string; affected: string; onClose: () => void;
  propose?: boolean; prefill?: { value: unknown; effectiveFrom: string; reason: string }; resubmitOf?: number;
}) {
  const [step, setStep] = useState(1);
  const initial = prefill?.value ?? cell.rawValue;
  const [value, setValue] = useState<string>(initial == null ? '' : String(initial));
  const [effectiveFrom, setEffectiveFrom] = useState(prefill && prefill.effectiveFrom >= meta.earliest ? prefill.effectiveFrom : meta.earliest);
  const [reason, setReason] = useState(prefill?.reason ?? '');
  const { busy, error, setError, send } = useSend(propose ? '/api/requests' : '/api/settings');
  const parsed: number | string = meta.type.kind === 'integer' ? Number(value) : value;

  function next() {
    setError(null);
    if (step === 1) {
      if (meta.type.kind === 'integer' && (!value.trim() || !Number.isInteger(parsed) || (parsed as number) < meta.type.min || (parsed as number) > meta.type.max)) {
        return setError(`Isi bilangan bulat antara ${meta.type.min} dan ${meta.type.max}.`);
      }
      if (meta.type.kind === 'choice' && !value) return setError('Pilih nilai baru.');
    }
    if (step === 2) {
      if (!effectiveFrom || effectiveFrom < meta.earliest) {
        return setError(meta.affectsMoney ? 'Pengaturan ini paling cepat berlaku besok.' : 'Tanggal berlaku tidak boleh mundur.');
      }
      if (!reason.trim()) return setError('Alasan wajib diisi.');
    }
    setStep(step + 1);
  }

  async function save() {
    const ok = propose ? await send({
      kind: 'submit', typeKey: 'position_setting_change', attachmentIds: [], resubmittedFromId: resubmitOf ?? null,
      fields: { key: meta.key, targetKind: cell.targetKind, targetId: cell.targetId, value: parsed, effectiveFrom, reason },
    }, 'Usulan terkirim. Nilai lama tetap berlaku sampai Pemilik atau GM menyetujui.') : await send({
      kind: 'set', key: meta.key, targetKind: cell.targetKind, targetId: cell.targetId, value: parsed,
      effectiveFrom, reason, expectedLatestId: cell.latestId,
    }, `${meta.label} disimpan.`);
    if (ok) onClose();
  }

  const footer = (
    <>
      {step === 1 ? <Button variant="secondary" onClick={onClose}>Batal</Button> : <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button>}
      {step < 3
        ? <Button onClick={next}>Lanjut</Button>
        : meta.affectsMoney
          ? <HoldButton loading={busy} onClick={save}>{propose ? 'Kirim usulan' : 'Simpan'}</HoldButton>
          : <Button loading={busy} onClick={save}>{propose ? 'Kirim usulan' : 'Simpan'}</Button>}
    </>
  );

  return (
    <Dialog open onClose={onClose} title={`${propose ? 'Usulkan' : 'Ubah'}: ${meta.label}`} footer={footer}>
      <div className="space-y-3">
        {step === 1 && (
          <>
            <StepLabel step={1} total={3} title="Nilai baru" />
            <p className="text-ink-muted">{meta.explain}</p>
            <p>Sekarang ({targetLabel}): <strong>{cell.value}</strong>{cell.inherited && <span className="text-ink-muted"> (ikut semua jabatan)</span>}</p>
            {meta.type.kind === 'integer' ? (
              <Field id="st-value" label={`Nilai baru${meta.unit ? ` (${meta.unit})` : ''}`} hint={`${meta.type.min}–${meta.type.max}`}>
                <Input id="st-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
            ) : (
              <Field id="st-value" label="Nilai baru">
                <Select id="st-value" value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Pilih</option>
                  {meta.type.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <StepLabel step={2} total={3} title="Tanggal berlaku dan alasan" />
            <Field id="st-date" label="Berlaku mulai" hint={meta.affectsMoney ? 'Menyangkut uang/hitungan: paling cepat besok.' : 'Boleh hari ini; tidak boleh mundur.'}>
              <Input id="st-date" type="date" min={meta.earliest} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </Field>
            <Field id="st-reason" label="Alasan"><Textarea id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </>
        )}
        {step === 3 && (
          <>
            <StepLabel step={3} total={3} title="Periksa" />
            <dl className="space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Sebelum</dt><dd>{cell.value}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Sesudah</dt><dd className="font-semibold">{labelOf(meta, parsed)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Mulai</dt><dd>{longDate(effectiveFrom)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Terkena</dt><dd className="text-right">{affected}</dd></div>
            </dl>
            {meta.mustAnnounce && (
              <Alert tone="warn">Perubahan ini perlu diumumkan ke karyawan. Papan pengumuman belum tersedia; sampaikan langsung.</Alert>
            )}
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

const STATUS_LABELS = { ACTIVE: 'Berlaku', PROPOSED: 'Usulan', CANCELLED: 'Dibatalkan' } as const;

/** Riwayat satu pengaturan: semua nilai, dari kapan sampai kapan, siapa, alasan. Nilai yang belum berlaku bisa dibatalkan. */
export function HistoryDialog({
  meta, cell, targetLabel, onClose,
}: { meta: SettingMeta; cell: SettingCell; targetLabel: string; onClose: () => void }) {
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const { busy, error, setError, send } = useSend();

  async function cancel() {
    if (cancelling == null) return;
    if (await send({ kind: 'cancel', id: cancelling, reason }, 'Nilai dibatalkan.')) setCancelling(null);
  }

  return (
    <Dialog open onClose={onClose} title={`Riwayat: ${meta.label}`} footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}>
      <p className="mb-2 text-ink-muted">{targetLabel}</p>
      {cell.history.length === 0
        ? <p className="text-ink-muted">Belum ada nilai sendiri; ikut nilai semua jabatan.</p>
        : (
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {cell.history.map((h) => (
              <li key={h.id} className="space-y-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.value}</span>
                  <Badge tone={h.status === 'ACTIVE' ? 'ok' : h.status === 'CANCELLED' ? 'danger' : 'warn'}>{STATUS_LABELS[h.status]}</Badge>
                </div>
                <p className="text-ink-muted">
                  {h.effectiveFrom === '2026-01-01' ? 'Sejak awal' : `Mulai ${longDate(h.effectiveFrom)}`}
                  {h.until ? ` sampai ${longDate(h.until)}` : ''} · {h.by}
                </p>
                <p>{h.reason}</p>
                {h.status === 'CANCELLED' && <p className="text-ink-muted">Dibatalkan {h.cancelledBy}: {h.cancelReason}</p>}
                {h.cancellable && meta.canEdit && cancelling !== h.id && (
                  <Button size="sm" variant="ghost" onClick={() => { setError(null); setReason(''); setCancelling(h.id); }}>Batalkan</Button>
                )}
                {cancelling === h.id && (
                  <div className="space-y-2">
                    <Field id={`cx-${h.id}`} label="Alasan pembatalan"><Textarea id={`cx-${h.id}`} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                    {error && <Alert tone="danger">{error}</Alert>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setCancelling(null)}>Kembali</Button>
                      <Button size="sm" variant="danger" loading={busy} onClick={cancel}>Batalkan nilai</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </Dialog>
  );
}
