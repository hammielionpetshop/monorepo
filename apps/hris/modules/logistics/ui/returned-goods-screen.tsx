'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { ReceiptResult } from '../rules/returned-goods';
import type { ReturnedGoodsRow } from '../server/returned-goods';
import { LiveCamera, photoForm } from './capture';

const STEP_LABELS = { WAREHOUSE: 'Diterima di Gudang', OWNER: 'Diterima cabang pemilik' } as const;

function GoodsCard({ row, onReceive }: { row: ReturnedGoodsRow; onReceive?: (row: ReturnedGoodsRow) => void }) {
  return (
    <Card className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="inline-flex flex-wrap items-center gap-1">
            <Badge tone={row.kind === 'RETURN' ? 'info' : 'warn'}>{row.kind === 'RETURN' ? 'Retur' : 'Tidak terkirim'}</Badge>
            <span className="font-medium">{row.destination}</span>
            {!row.ownerIsHome && <Badge tone="info">Milik {row.owner}</Badge>}
            {row.mismatch && <Badge tone="danger">Tidak sesuai</Badge>}
          </p>
          <p className="text-sm text-ink-muted">
            {row.what} · trip <Link href={`/logistik/trip/${row.tripId}`} className="underline">{row.tripNumber}</Link> ({row.tripDate})
            {row.next && row.age > 0 && <> · {row.age} hari</>}
          </p>
          {row.detail && <p className="text-sm">{row.detail}</p>}
          {row.items.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {row.items.map((i, n) => <li key={n}>{i.name}: <span className="tabular-nums">{i.quantity}</span> {i.unit}</li>)}
            </ul>
          )}
          {row.reportPhoto && <a href={row.reportPhoto} target="_blank" rel="noreferrer" className="text-sm underline">Foto retur</a>}
          {row.receipts.map((r) => (
            <p key={r.step} className="text-sm text-ink-muted">
              {STEP_LABELS[r.step]}: <b className={r.result === 'MISMATCH' ? 'text-danger' : ''}>{r.label}</b> · {r.by} · {r.on} {r.at}
              {r.note && <> · {r.note}</>} · <a href={r.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto</a>
            </p>
          ))}
        </div>
        {onReceive && row.next && <Button size="sm" onClick={() => onReceive(row)}>{row.next === 'OWNER' ? `Terima di ${row.owner}` : 'Terima'}</Button>}
      </div>
    </Card>
  );
}

/**
 * Barang Kembali (spec LT1 §14.1 butir 1): barang yang ikut pulang di truk (Kirim Besok / Gagal, retur dibawa pulang)
 * diterima di Gudang dengan foto, Sesuai / Tidak sesuai; milik cabang lain lalu diterima di cabang pemiliknya.
 */
export function ReturnedGoodsScreen({ warehouse, owner, done, canReceive, from }: {
  warehouse: ReturnedGoodsRow[]; owner: ReturnedGoodsRow[]; done: ReturnedGoodsRow[]; canReceive: boolean; from: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<ReturnedGoodsRow | null>(null);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(row: ReturnedGoodsRow) {
    setTarget(row);
    setResult(null);
    setNote('');
    setPhoto(null);
    setError(null);
  }

  async function save() {
    if (!target || !result || !photo) return;
    setBusy(true);
    setError(null);
    const sent = await postJson('/api/logistics/upload', photoForm({
      action: 'receive_goods', tripId: target.tripId, sourceKind: target.kind, sourceId: target.sourceId, result, note,
    }, photo));
    setBusy(false);
    if (!sent.ok) return setError(sent.error ?? 'Gagal menyimpan.');
    toast(`Barang dari ${target.destination} diterima.`, 'ok');
    setTarget(null);
    router.refresh();
  }

  const receive = canReceive ? open : undefined;
  const ready = !!result && !!photo && (result === 'MATCH' || note.trim().length >= 5);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Barang yang ikut pulang di truk sejak {from}: surat jalan Kirim Besok atau Gagal, dan retur yang dibawa pulang driver. Turunkan di Gudang,
        cocokkan, lalu tekan <b>Terima</b> dengan foto. Barang milik cabang lain diantar ke cabangnya, lalu diterima lagi di sana.
        Awak trip itu tidak bisa menerima barang yang ia bawa sendiri.
      </p>
      <h2 className="font-semibold">Menunggu diterima di Gudang ({warehouse.length})</h2>
      {!warehouse.length ? <EmptyState title="Tidak ada barang kembali yang menunggu." /> : (
        <ul className="space-y-2">{warehouse.map((r) => <li key={r.key}><GoodsCard row={r} onReceive={receive} /></li>)}</ul>
      )}
      <h2 className="font-semibold">Perlu diantar ke cabang pemilik ({owner.length})</h2>
      {!owner.length ? <EmptyState title="Tidak ada barang milik cabang lain yang menunggu." /> : (
        <ul className="space-y-2">{owner.map((r) => <li key={r.key}><GoodsCard row={r} onReceive={receive} /></li>)}</ul>
      )}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">50 barang kembali terakhir yang sudah diterima</summary>
          <ul className="mt-2 space-y-2">{done.map((r) => <li key={r.key}><GoodsCard row={r} /></li>)}</ul>
        </details>
      )}
      <Dialog
        open={!!target} onClose={() => setTarget(null)}
        title={target ? `${target.next === 'OWNER' ? `Terima di ${target.owner}` : 'Terima di Gudang'}: ${target.destination}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Batal</Button><Button loading={busy} disabled={!ready} onClick={save}>Simpan</Button></>}
      >
        {target && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm">{target.what}</p>
            {target.items.length > 0 && (
              <ul className="list-disc pl-5 text-sm">{target.items.map((i, n) => <li key={n}>{i.name}: {i.quantity} {i.unit}</li>)}</ul>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={result === 'MATCH' ? 'primary' : 'secondary'} onClick={() => setResult('MATCH')}>Sesuai</Button>
              <Button variant={result === 'MISMATCH' ? 'danger' : 'secondary'} onClick={() => setResult('MISMATCH')}>Tidak sesuai</Button>
            </div>
            <Field id="receive-note" label={result === 'MISMATCH' ? 'Apa yang tidak sesuai? (wajib)' : 'Catatan (boleh kosong)'}>
              <Textarea id="receive-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Contoh: kurang 1 dus" />
            </Field>
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(photo)} alt="Foto barang diterima" className="w-full rounded-lg" />
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setPhoto(null)}>Ulangi foto</Button>
              </>
            ) : <LiveCamera onPhoto={setPhoto} onError={setError} label="Foto barang yang diterima" />}
          </div>
        )}
      </Dialog>
    </div>
  );
}
