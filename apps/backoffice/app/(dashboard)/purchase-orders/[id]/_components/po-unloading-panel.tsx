'use client';

import { useState } from 'react';
import { formatWIB } from '@petshop/shared';
import { NewBadge } from '@/components/ui/new-badge';

export interface PoUnloadingInfo {
  reportNumber: string;
  kind: 'DRAFT' | 'MATCHED';
  latestVersion: number;
  /** Laporan dikoreksi/dibatalkan sesudah PO lewat Draft dan belum diperiksa kantor. */
  pendingReview: { version: number; action: string; at: string }[];
  lastReview: { at: string; note: string | null; byName: string | null } | null;
}

export interface PoAttachment {
  id: number;
  url: string;
  kind: 'DELIVERY_NOTE' | 'GOODS';
}

interface UnloadingItem {
  id: number;
  productName: string | null;
  uomCode: string | null;
  qtyOrdered: string;
  qtyUnloaded: number | null;
}

const ACTION_LABEL: Record<string, string> = {
  FLAGGED: 'laporan dikoreksi',
  CANCELLED: 'laporan dibatalkan',
};

/** Kotak "Dari bongkaran" di Rincian PO: jumlah bongkaran vs PO, lampiran foto, tanda berubah. */
export function PoUnloadingPanel({
  poId,
  unloading,
  attachments,
  items,
  canReview,
  onReviewed,
}: {
  poId: number;
  unloading: PoUnloadingInfo | null;
  attachments: PoAttachment[];
  items: UnloadingItem[];
  canReview: boolean;
  onReviewed: (message: string) => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  if (!unloading && attachments.length === 0) return null;

  const review = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/bo/purchase-orders/${poId}/unloading-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setNote('');
      onReviewed('Perubahan bongkaran ditandai sudah diperiksa');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const withUnloaded = items.some((i) => i.qtyUnloaded != null);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden print:hidden">
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-2">
        <h2 className="font-medium text-foreground">
          {unloading
            ? `${unloading.kind === 'DRAFT' ? 'Dibuat dari' : 'Dicocokkan dengan'} Laporan Bongkaran ${unloading.reportNumber}`
            : 'Lampiran'}
        </h2>
        {unloading && unloading.latestVersion > 1 && (
          <span className="text-xs text-muted-foreground">versi {unloading.latestVersion}</span>
        )}
        <NewBadge feature="fitur/po-dari-bongkaran" />
      </div>

      {unloading && unloading.pendingReview.length > 0 && (
        <div className="mx-6 mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm space-y-2">
          <p className="font-semibold text-foreground">⚠ Bongkaran berubah, periksa</p>
          <ul className="text-muted-foreground list-disc pl-5">
            {unloading.pendingReview.map((c) => (
              <li key={`${c.version}-${c.at}`}>
                Versi {c.version}: {ACTION_LABEL[c.action] ?? 'berubah'} · {formatWIB(c.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            PO ini sudah lewat Draft, jadi isinya tidak diubah otomatis. Cocokkan dengan laporan di HRIS, lalu tandai sudah diperiksa.
          </p>
          {canReview && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan pemeriksaan"
                className="flex-1 min-w-48 border border-border rounded-md px-3 py-1.5 text-sm bg-background"
              />
              <button
                type="button"
                onClick={review}
                disabled={saving || note.trim().length < 3}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Sudah diperiksa'}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {unloading && unloading.pendingReview.length === 0 && unloading.lastReview && (
        <p className="px-6 pt-3 text-xs text-muted-foreground">
          Perubahan bongkaran sudah diperiksa {unloading.lastReview.byName ?? '-'} ·{' '}
          {formatWIB(unloading.lastReview.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {unloading.lastReview.note && <> — {unloading.lastReview.note}</>}
        </p>
      )}

      {unloading && withUnloaded && (
        <table className="w-full text-sm mt-2">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Produk</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty PO</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty Bongkaran</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((i) => {
              const ordered = Number(i.qtyOrdered);
              const diff = i.qtyUnloaded == null ? null : i.qtyUnloaded - ordered;
              return (
                <tr key={i.id}>
                  <td className="px-4 py-2">{i.productName ?? '-'}</td>
                  <td className="px-4 py-2 text-right">{ordered} {i.uomCode}</td>
                  <td className="px-4 py-2 text-right">{i.qtyUnloaded == null ? <span className="text-muted-foreground">tidak ada</span> : `${i.qtyUnloaded} ${i.uomCode ?? ''}`}</td>
                  <td className={`px-4 py-2 text-right ${diff ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                    {diff == null ? '-' : diff === 0 ? 'sama' : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {attachments.length > 0 && (
        <div className="px-6 py-4">
          <p className="text-xs text-muted-foreground mb-2">
            Foto {attachments.some((a) => a.kind === 'DELIVERY_NOTE') ? 'surat jalan' : 'barang (tanpa surat jalan)'} dari bongkaran
          </p>
          <div className="flex flex-wrap gap-3">
            {attachments.map((a) => (
              <button key={a.id} type="button" onClick={() => setPreview(a.url)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="Lampiran PO" className="h-24 w-24 rounded-md border border-border object-cover hover:opacity-80" />
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Lampiran PO" className="max-h-full max-w-full rounded-md" />
        </div>
      )}
    </div>
  );
}
