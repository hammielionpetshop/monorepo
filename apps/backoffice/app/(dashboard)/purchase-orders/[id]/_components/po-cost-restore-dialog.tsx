'use client';

import { useState } from 'react';

type RestoreResult = {
  restored: string[];
  pendingClosed: string[];
  skipped: { name: string; reason: 'NEWER' | 'NO_OLD' | 'NO_CONVERSION' }[];
};

const SKIP_LABEL: Record<RestoreResult['skipped'][number]['reason'], string> = {
  NEWER: 'modal sudah diperbarui barang masuk lain sesudah PO ini',
  NO_OLD: 'belum punya modal sebelum PO ini',
  NO_CONVERSION: 'data satuan produk tidak ditemukan',
};

/** Kembalikan modal barang-barang PO Selesai ke angka sebelum PO masuk; harga PO & hutang tetap. */
export function PoCostRestoreDialog({
  poId,
  poNumber,
  onClose,
  onDone,
}: {
  poId: number;
  poNumber: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError('Alasan wajib diisi (minimal 5 huruf)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${poId}/restore-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Gagal mengembalikan modal (${res.status})`);
        return;
      }
      setResult(data as RestoreResult);
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi');
    } finally {
      setSaving(false);
    }
  }

  const close = () => (result ? onDone() : onClose());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={saving ? undefined : close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-title"
        onClick={e => e.stopPropagation()}
        className="bg-background rounded-lg shadow-lg w-full max-w-lg mx-4 p-6 space-y-4"
      >
        <div>
          <h3 id="restore-title" className="text-base font-semibold text-foreground">Kembalikan Modal</h3>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{poNumber}</p>
        </div>

        {result ? (
          <div className="space-y-3 text-sm">
            {result.restored.length > 0 && (
              <div>
                <p className="font-medium text-green-700">Modal dikembalikan ke sebelum PO ({result.restored.length} barang):</p>
                <p className="text-muted-foreground">{result.restored.join(', ')}</p>
              </div>
            )}
            {result.pendingClosed.length > 0 && (
              <div>
                <p className="font-medium text-foreground">Modal memang belum berubah — usulan tinjauannya ditutup ({result.pendingClosed.length} barang):</p>
                <p className="text-muted-foreground">{result.pendingClosed.join(', ')}</p>
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <p className="font-medium">Tidak diubah — cek manual di Manajemen Harga:</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.skipped.map(s => <li key={s.name}>{s.name}: {SKIP_LABEL[s.reason]}</li>)}
                </ul>
              </div>
            )}
            {result.restored.length + result.pendingClosed.length + result.skipped.length === 0 && (
              <p className="text-muted-foreground">PO ini tidak mengubah modal barang apa pun — tidak ada yang perlu dikembalikan.</p>
            )}
            <p className="text-xs text-muted-foreground">Harga PO dan hutang tidak berubah. Perubahan harga faktur berikutnya tidak akan mengubah modal lagi.</p>
            <div className="flex justify-end">
              <button type="button" onClick={onDone} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p>Modal semua barang di PO ini (semua satuan) dikembalikan ke angka <span className="font-semibold">sebelum PO ini masuk</span>.</p>
              <p><span className="font-semibold">Harga beli di PO, total, dan hutang tidak berubah.</span> HPP barang yang sudah masuk juga tidak diubah.</p>
              <p>Sesudahnya, perubahan harga faktur PO ini tidak akan mengubah modal lagi. Langkah ini tidak bisa dibatalkan.</p>
            </div>
            <div>
              <label htmlFor="restore-reason" className="block text-xs font-medium text-muted-foreground mb-1">
                Alasan <span className="text-destructive">*</span>
              </label>
              <textarea
                id="restore-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="mis. Harga beli rekan (harga jual), bukan modal — barang kembali"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Memproses…' : 'Kembalikan Modal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
