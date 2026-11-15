'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { RETURN_ITEMS_MAX, cleanReturnItems } from '../rules/returned-goods';
import { REPORT_KINDS, type ReportKind } from '../rules/store-payments';
import { LiveCamera, photoForm } from './capture';

/**
 * Lapor masalah sesudah Terkirim (spec LT1 §13.5 butir 4, §14.1 butir 2, §15.4 butir 3): pilihan baku + foto kamera langsung;
 * Retur wajib rincian barang, dan pemilik barang bila asal barangnya lebih dari satu cabang. Dipakai Trip Saya (truk) dan
 * Antar Sendiri. `fields` = isian tetap untuk API (aksi, trip, kunjungan/tujuan).
 */
export function ReportForm({ destination, origins, endpoint, fields, hint, onDone }: {
  destination: string; origins: { id: number; name: string }[]; endpoint: string; fields: Record<string, string | number>; hint: string;
  onDone: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [items, setItems] = useState([{ name: '', quantity: '', unit: '' }]);
  const [owner, setOwner] = useState<number | null>(origins.length === 1 ? origins[0].id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsOk = kind !== 'RETURN' || (cleanReturnItems(items).ok && (origins.length <= 1 || owner != null));
  const ready = !!kind && ((kind !== 'OTHER' && kind !== 'PRICE') || note.trim().length >= 5) && itemsOk;
  const setItem = (index: number, field: 'name' | 'quantity' | 'unit', value: string) =>
    setItems((list) => list.map((item, n) => (n === index ? { ...item, [field]: value } : item)));

  async function send() {
    if (!kind || !photo) return;
    if (kind === 'RETURN') {
      const check = cleanReturnItems(items);
      if (!check.ok) return setError(check.error);
    }
    setBusy(true);
    setError(null);
    const result = await postJson(endpoint, photoForm({
      ...fields, kind, note, items: kind === 'RETURN' ? JSON.stringify(items) : null, ownerBranchId: kind === 'RETURN' ? owner : null,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Laporan ${destination} terkirim ke kantor.`, 'ok');
    onDone(true);
  }

  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h2 className="font-semibold">Lapor masalah: {destination}</h2>
      <p className="text-sm text-ink-muted">{hint}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        {REPORT_KINDS.map((k) => (
          <Button key={k.code} className="min-h-11" variant={kind === k.code ? 'primary' : 'secondary'} onClick={() => setKind(k.code)}>{k.label}</Button>
        ))}
      </div>
      {kind === 'RETURN' && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Barang retur yang dibawa pulang</p>
          {items.map((item, n) => (
            <div key={n} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-1">
              <Input aria-label={`Nama barang ${n + 1}`} placeholder="Nama barang" value={item.name} maxLength={120} onChange={(e) => setItem(n, 'name', e.target.value)} />
              <Input aria-label={`Jumlah ${n + 1}`} placeholder="Jml" inputMode="decimal" value={item.quantity} maxLength={10} onChange={(e) => setItem(n, 'quantity', e.target.value)} />
              <Input aria-label={`Satuan ${n + 1}`} placeholder="pcs" value={item.unit} maxLength={20} onChange={(e) => setItem(n, 'unit', e.target.value)} />
            </div>
          ))}
          <div className="flex gap-2">
            {items.length < RETURN_ITEMS_MAX && (
              <Button size="sm" variant="secondary" onClick={() => setItems((list) => [...list, { name: '', quantity: '', unit: '' }])}>+ Barang</Button>
            )}
            {items.length > 1 && <Button size="sm" variant="ghost" onClick={() => setItems((list) => list.slice(0, -1))}>Hapus baris terakhir</Button>}
          </div>
          {origins.length > 1 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Barang ini milik cabang</p>
              <div className="flex flex-wrap gap-2">
                {origins.map((o) => <Button key={o.id} size="sm" variant={owner === o.id ? 'primary' : 'secondary'} onClick={() => setOwner(o.id)}>{o.name}</Button>)}
              </div>
            </div>
          )}
        </div>
      )}
      <Field id="report-note" label={kind === 'OTHER' ? 'Ceritakan kendalanya (wajib)' : kind === 'PRICE' ? 'Harga yang diminta toko (wajib)' : kind === 'RETURN' ? 'Catatan (alasan retur)' : 'Catatan (barang apa, berapa)'}>
        <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Contoh: 2 sak Royal 10 kg sobek" />
      </Field>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={URL.createObjectURL(photo)} alt="Foto masalah" className="w-full rounded-lg" />
          <div className="flex gap-2">
            <Button block className="min-h-12" loading={busy} disabled={!ready} onClick={send}>Kirim laporan</Button>
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
          {!ready && <p className="text-xs text-ink-muted">Pilih jenis laporan dulu (Kendala lain wajib cerita; Harga beda wajib tulis harga yang diminta toko; Retur wajib nama, jumlah, dan satuan barang).</p>}
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto barangnya" />}
      <Button variant="ghost" block disabled={busy} onClick={() => onDone(false)}>Batal</Button>
    </Card>
  );
}
