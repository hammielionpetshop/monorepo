'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import type { DepositEntryView, DepositStoreView, DepositUseView, PendingDepositView } from '../server/store-deposits';

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 12);

function useAct() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(body: Record<string, unknown>, done: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(done, 'ok');
    router.refresh();
    return true;
  }
  return { busy, error, act };
}

/** Terima Uang › Titipan toko menunggu diperiksa (A1): Cocok atau angka sebenarnya + catatan. */
export function DepositChecks({ rows, canCheck }: { rows: PendingDepositView[]; canCheck: boolean }) {
  const { busy, error, act } = useAct();
  const [actual, setActual] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  if (!rows.length) return null;
  return (
    <Card className="space-y-2">
      <h2 className="flex items-center gap-2 font-semibold">Titipan toko menunggu diperiksa ({rows.length}) <NewBadge feature="fitur/titipan-toko" /></h2>
      <p className="text-xs text-ink-muted">Uang lebih bayar / titip saja dari driver. Masuk saldo titipan toko sesudah diperiksa. <Link className="underline" href="/logistik/titipan">Buka Titipan Toko</Link></p>
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="space-y-2">
        {rows.map((r) => {
          const value = actual[r.id] ?? String(r.amount);
          const differs = Number(value || 0) !== r.amount;
          return (
            <li key={r.id} className="space-y-2 rounded-lg border border-line p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span><b>{r.store}</b> · dilaporkan <b className="tabular-nums">{rupiah(r.amount)}</b></span>
                {r.tripId && <Link className="text-xs underline" href={`/logistik/trip/${r.tripId}`}>{r.tripNumber}</Link>}
              </div>
              <p className="text-xs text-ink-muted">{r.by} · {r.on} {r.at}</p>
              {!r.ready ? <p className="text-xs text-ink-muted">Menunggu trip Menuju Garasi.</p> : canCheck && (
                <div className="flex flex-wrap items-end gap-2">
                  <Field id={`dep-${r.id}`} label="Uang titipan diterima (Rp)">
                    <Input id={`dep-${r.id}`} inputMode="numeric" value={value} onChange={(e) => setActual({ ...actual, [r.id]: digits(e.target.value) })} className="w-36" />
                  </Field>
                  {differs && (
                    <Field id={`dep-note-${r.id}`} label="Catatan (wajib bila beda)">
                      <Input id={`dep-note-${r.id}`} value={note[r.id] ?? ''} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} maxLength={300} />
                    </Field>
                  )}
                  <Button size="sm" loading={busy} onClick={() => act({ action: 'check_deposit', id: r.id, actual: Number(value || 0), note: note[r.id] ?? null }, `Titipan ${r.store} diperiksa.`)}>
                    {differs ? 'Simpan (tidak cocok)' : 'Cocok'}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function EntryLine({ e, onVoid }: { e: DepositEntryView; onVoid?: (e: DepositEntryView) => void }) {
  const sign = e.kind === 'IN' ? '+' : '−';
  return (
    <li className={`flex flex-wrap items-start justify-between gap-2 py-1 text-sm ${e.voided ? 'opacity-60 line-through' : ''}`}>
      <span>
        {e.on} · {e.label}{e.trxNumber ? ` ${e.trxNumber}` : ''}{e.tripNumber ? ` (trip ${e.tripNumber})` : ''} · {e.by}
        {e.kind === 'IN' && !e.checked && <Badge tone="warn">Belum diperiksa</Badge>}
        {e.kind === 'IN' && e.checked && e.actual !== e.amount && <span className="block text-xs text-danger-fg">Dilaporkan {rupiah(e.amount)}, diterima {rupiah(e.actual ?? 0)}: {e.checkNote}</span>}
        {e.kind === 'USE' && !e.voided && (e.recorded ? <span className="block text-xs text-ink-muted">Dicatat di kasir: {e.recorded.ref}</span> : <Badge tone="warn">Belum dicatat di kasir</Badge>)}
        {e.note && <span className="block text-xs text-ink-muted">{e.note}</span>}
        {e.voided && <span className="block text-xs">Dibatalkan: {e.voided.reason}</span>}
      </span>
      <span className="flex items-center gap-2">
        <b className="tabular-nums">{sign}{rupiah(e.kind === 'IN' ? e.actual ?? e.amount : e.amount)}</b>
        {onVoid && !e.voided && e.kind !== 'IN' && !e.recorded && <Button size="sm" variant="ghost" onClick={() => onVoid(e)}>Batalkan</Button>}
      </span>
    </li>
  );
}

type Ask = { kind: 'use' | 'refund'; store: DepositStoreView } | { kind: 'void'; entry: DepositEntryView } | null;

/** Halaman Logistik › Titipan Toko (A1): saldo per toko, pakai untuk nota, kembalikan tunai, riwayat. */
export function DepositsScreen({ stores, canAct }: { stores: DepositStoreView[]; canAct: boolean }) {
  const { busy, error, act } = useAct();
  const [ask, setAsk] = useState<Ask>(null);
  const [trx, setTrx] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const open = (next: Ask) => { setAsk(next); setTrx(''); setAmount(''); setReason(''); };

  async function save() {
    if (!ask) return;
    const ok = ask.kind === 'use'
      ? await act({ action: 'use_deposit', customerId: ask.store.customerId, transactionId: Number(trx), amount: Number(amount || 0) }, 'Pemakaian titipan masuk Perlu dicatat di kasir.')
      : ask.kind === 'refund'
        ? await act({ action: 'refund_deposit', customerId: ask.store.customerId, amount: Number(amount || 0), reason }, 'Pengembalian titipan tercatat.')
        : ask.kind === 'void' ? await act({ action: 'void_deposit', id: ask.entry.id, reason }, 'Dibatalkan.') : false;
    if (ok) setAsk(null);
  }

  const chosenDebt = ask?.kind === 'use' ? ask.store.debts.find((d) => String(d.transactionId) === trx) : null;
  return (
    <div className="space-y-4">
      {error && !ask && <Alert tone="danger">{error}</Alert>}
      {!stores.length && <EmptyState title="Belum ada titipan toko">Titipan tercatat saat driver memilih Lunas + titip atau Titip saja di Terkirim.</EmptyState>}
      {stores.map((s) => (
        <Card key={s.customerId} className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{s.store}</h2>
              <p className="text-sm">Saldo titipan <b className="tabular-nums">{rupiah(s.balance)}</b>{s.waitingCheck > 0 && <> · <span className="text-ink-muted">{rupiah(s.waitingCheck)} menunggu diperiksa di Terima Uang</span></>}</p>
            </div>
            {canAct && s.balance > 0 && (
              <div className="flex gap-2">
                <Button size="sm" disabled={!s.debts.length} onClick={() => open({ kind: 'use', store: s })}>Pakai untuk nota</Button>
                <Button size="sm" variant="secondary" onClick={() => open({ kind: 'refund', store: s })}>Kembalikan tunai</Button>
              </div>
            )}
          </div>
          {canAct && s.balance > 0 && !s.debts.length && <p className="text-xs text-ink-muted">Toko ini tidak punya nota berpiutang di kasir.</p>}
          <ul className="divide-y divide-line">{s.entries.map((e) => <EntryLine key={e.id} e={e} onVoid={canAct ? (entry) => open({ kind: 'void', entry }) : undefined} />)}</ul>
        </Card>
      ))}
      <Dialog
        open={!!ask} onClose={() => setAsk(null)}
        title={ask?.kind === 'use' ? `Pakai titipan ${ask.store.store}` : ask?.kind === 'refund' ? `Kembalikan titipan ${ask.store.store}` : 'Batalkan'}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAsk(null)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {ask?.kind === 'use' && (
            <>
              <p className="text-sm">Saldo {rupiah(ask.store.balance)}. Sesudah disimpan, catat <b>Pelunasan Piutang</b> nota itu di kasir lalu tandai Sudah dicatat di menu Perlu dicatat di kasir.</p>
              <Field id="dep-trx" label="Nota berpiutang">
                <Select id="dep-trx" value={trx} onChange={(e) => { setTrx(e.target.value); const d = ask.store.debts.find((x) => String(x.transactionId) === e.target.value); if (d) setAmount(String(Math.min(d.remaining, ask.store.balance))); }}>
                  <option value="">Pilih nota</option>
                  {ask.store.debts.map((d) => <option key={d.transactionId} value={d.transactionId}>{d.number} · sisa {rupiah(d.remaining)}</option>)}
                </Select>
              </Field>
            </>
          )}
          {(ask?.kind === 'use' || ask?.kind === 'refund') && (
            <Field id="dep-amount" label="Nominal (Rp)" hint={chosenDebt ? `Paling banyak ${rupiah(Math.min(chosenDebt.remaining, ask.store.balance))}.` : undefined}>
              <Input id="dep-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
            </Field>
          )}
          {(ask?.kind === 'refund' || ask?.kind === 'void') && (
            <Field id="dep-reason" label="Alasan (wajib, paling sedikit 5 huruf)">
              <Textarea id="dep-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </Field>
          )}
        </div>
      </Dialog>
    </div>
  );
}

/** Perlu dicatat di kasir › Pakai titipan toko (A1). */
export function DepositUsesToRecord({ waiting, done }: { waiting: DepositUseView[]; done: DepositUseView[] }) {
  const { busy, error, act } = useAct();
  const [ref, setRef] = useState<Record<number, string>>({});
  if (!waiting.length && !done.length) return null;
  return (
    <Card className="space-y-2">
      <h2 className="flex items-center gap-2 font-semibold">Pakai titipan toko ({waiting.length}) <NewBadge feature="fitur/titipan-toko" /></h2>
      <p className="text-xs text-ink-muted">Catat di kasir sebagai Pelunasan Piutang nota itu (uangnya titipan yang dipegang Gudang), lalu isi nomor / keterangan.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="space-y-2">
        {waiting.map((w) => (
          <li key={w.id} className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-line p-2 text-sm">
            <span><b>{w.store}</b> · {w.trxNumber} · <b className="tabular-nums">{rupiah(w.amount)}</b><span className="block text-xs text-ink-muted">{w.on} · {w.by}</span></span>
            <span className="flex items-end gap-2">
              <Input aria-label="Nomor / keterangan" placeholder="No. pelunasan / keterangan" value={ref[w.id] ?? ''} onChange={(e) => setRef({ ...ref, [w.id]: e.target.value })} maxLength={100} className="w-48" />
              <Button size="sm" loading={busy} disabled={(ref[w.id] ?? '').trim().length < 3} onClick={() => act({ action: 'record_deposit_use', id: w.id, ref: ref[w.id] }, 'Tercatat di kasir.')}>Sudah dicatat</Button>
            </span>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-ink-muted">30 terakhir yang sudah dicatat</summary>
          <ul className="mt-1 space-y-1 text-xs">{done.map((d) => <li key={d.id}>{d.recorded?.on} · {d.store} · {d.trxNumber} · {rupiah(d.amount)} · {d.recorded?.ref}</li>)}</ul>
        </details>
      )}
    </Card>
  );
}
