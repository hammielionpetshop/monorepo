'use client';

import { useEffect, useRef, useState } from 'react';
import type { CancelBlocker } from '@/lib/services/po-cancel-service';

type Mode = 'OPEN' | 'COMPLETED';

interface CheckResult {
  status: string;
  blockers: CancelBlocker[];
  payable: { totalAmount: number } | null;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="text-sm text-foreground space-y-1.5">{children}</div>
    </section>
  );
}

/**
 * Jendela Batalkan PO beserta panduannya. Sengaja tidak tertutup lewat klik di luar / Esc
 * (sama seperti RequiredChoiceDialog) supaya panduan dibaca dulu sebelum PO dibatalkan.
 */
export function POCancelDialog({
  poId,
  poNumber,
  status,
  branchName,
  supplierName,
  hasReceivingInput,
  onClose,
  onCancelled,
}: {
  poId: number;
  poNumber: string;
  status: string;
  branchName: string;
  supplierName: string;
  /** PO Diterima yang input penerimaannya belum disetujui. */
  hasReceivingInput: boolean;
  onClose: () => void;
  onCancelled: (message: string) => void;
}) {
  const mode: Mode = status === 'COMPLETED' ? 'COMPLETED' : 'OPEN';
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState('');
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'COMPLETED') return;
    let alive = true;
    fetch(`/api/bo/purchase-orders/${poId}/cancel`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memeriksa syarat pembatalan');
        if (alive) setCheck(data);
      })
      .catch(err => alive && setCheckError(err instanceof Error ? err.message : 'Gagal memeriksa syarat pembatalan'));
    return () => {
      alive = false;
    };
  }, [mode, poId]);

  const blockers = check?.blockers ?? [];
  const blocked = mode === 'COMPLETED' && (blockers.length > 0 || check === null);
  const reasonOk = reason.trim().length >= 5;
  const pinOk = mode === 'OPEN' || /^\d{4,6}$/.test(pin);
  const canSubmit = !blocked && understood && reasonOk && pinOk && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/bo/purchase-orders/${poId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'COMPLETED' ? { reason: reason.trim(), pin } : { reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membatalkan PO');
      onCancelled(data.message ?? `${poNumber} dibatalkan`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan PO');
      setPin('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="po-cancel-title"
        className="bg-background rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="h-1.5 bg-destructive shrink-0" />
        <div className="px-6 pt-5 pb-3 shrink-0">
          <h3 id="po-cancel-title" className="text-base font-semibold text-foreground">
            Batalkan PO <span className="font-mono">{poNumber}</span>?
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{supplierName} · {branchName}</p>
        </div>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto">
          <Section title="Kapan dipakai">
            <p>
              Untuk PO yang salah dibuat atau tidak jadi: salah supplier, salah barang/qty, PO dobel,
              atau supplier tidak jadi mengirim. PO yang dibatalkan <b>tidak bisa dipakai lagi</b> — buat PO baru bila
              barangnya tetap dipesan.
            </p>
            <p className="text-muted-foreground">
              Barang hanya datang sebagian dan sisanya tidak dikirim? Jangan batalkan PO — catat yang datang lalu
              tekan <b>Setujui Penerimaan</b>; PO selesai dengan qty yang benar-benar diterima.
              Barang rusak/salah kirim yang sudah masuk stok? Pakai <b>Retur Supplier</b>.
            </p>
          </Section>

          {mode === 'OPEN' ? (
            <Section title="Yang terjadi">
              <ul className="list-disc pl-5 space-y-1">
                <li>Status PO menjadi <b>Dibatalkan</b>.</li>
                <li>Stok dan hutang supplier <b>tidak berubah</b> — PO ini belum memasukkan stok.</li>
                {hasReceivingInput && (
                  <li>Input penerimaan yang belum disetujui ikut dihapus (salinannya tetap tersimpan di Audit Log).</li>
                )}
                <li>Alasan dan nama Anda tercatat di detail PO dan Audit Log.</li>
              </ul>
            </Section>
          ) : (
            <Section title="Yang terjadi">
              <ul className="list-disc pl-5 space-y-1">
                <li>Stok yang masuk dari PO ini <b>ditarik kembali</b> dari cabang {branchName} dan tercatat di Mutasi Stok sebagai &quot;Batal PO&quot;.</li>
                <li>
                  Hutang ke {supplierName}
                  {check?.payable ? <> sebesar <b>{rupiah(check.payable.totalAmount)}</b></> : null} ditandai <b>Dihapus</b>.
                </li>
                <li>Bila modal barang sempat berubah karena PO ini, usulan pengembalian modal muncul di <b>Tinjauan Modal</b> untuk disetujui Owner/GM.</li>
                <li>Status PO menjadi <b>Dibatalkan</b>. Wajib PIN Owner.</li>
              </ul>
            </Section>
          )}

          {mode === 'COMPLETED' && (
            <Section title="Syarat pembatalan">
              {check === null && !checkError && <p className="text-muted-foreground">Memeriksa syarat…</p>}
              {checkError && <p className="text-destructive">{checkError}</p>}
              {check && blockers.length === 0 && (
                <ul className="space-y-1">
                  <li>✅ Hutang supplier belum dibayar</li>
                  <li>✅ Tidak ada retur supplier untuk PO ini</li>
                  <li>✅ Barang dari PO ini belum terpakai (belum terjual / dipindah / dipotong opname)</li>
                </ul>
              )}
              {blockers.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-destructive">PO ini belum bisa dibatalkan:</p>
                  {blockers.map(b => (
                    <div key={b.kind} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <p className="text-destructive">❌ {b.message}</p>
                      <p className="mt-1 text-foreground"><b>Langkah:</b> {b.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {!blocked && (
            <Section title="Langkah">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Pastikan nomor PO, supplier, dan cabang di atas benar.</li>
                <li>Tulis alasan yang jelas — siapa yang salah input dan apa salahnya.</li>
                {mode === 'COMPLETED' && <li>Minta Owner memasukkan PIN.</li>}
                <li>Centang pernyataan, lalu tekan <b>Ya, batalkan PO</b>.</li>
                <li>Bila barang tetap dipesan, buat PO baru dengan data yang benar.</li>
              </ol>
            </Section>
          )}

          {!blocked && (
            <div className="space-y-3 pt-1">
              <label className="block">
                <span className="text-sm font-medium">Alasan pembatalan <span className="text-destructive">*</span></span>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Contoh: admin salah pilih supplier, PO dobel dengan PO-..."
                  className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {reason.length > 0 && !reasonOk && <span className="text-xs text-destructive">Minimal 5 huruf</span>}
              </label>
              {mode === 'COMPLETED' && (
                <label className="block">
                  <span className="text-sm font-medium">PIN Owner <span className="text-destructive">*</span></span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="mt-1 w-40 border border-border rounded-md px-3 py-2 text-sm bg-background font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} className="mt-0.5" />
                <span>Saya sudah membaca panduan ini dan paham PO yang dibatalkan tidak bisa dikembalikan.</span>
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 disabled:opacity-50"
          >
            {blocked ? 'Tutup' : 'Kembali'}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {saving ? 'Memproses...' : 'Ya, batalkan PO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
