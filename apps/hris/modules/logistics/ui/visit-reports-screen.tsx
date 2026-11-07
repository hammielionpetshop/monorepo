'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import { CUT_REASONS, DECISION_LABELS, cleanDecision, cutReasonOf, type CutReason, type Decision } from '../rules/store-payments';
import type { ReportRow } from '../server/store-payments';

function DecisionLine({ row }: { row: ReportRow }) {
  const d = row.decision;
  if (!d) return row.closed ? <p className="text-sm text-ink-muted">Selesai ({row.closedBy}): {row.closeNote}</p> : null;
  return (
    <div className="space-y-0.5 text-sm">
      <p className="inline-flex flex-wrap items-center gap-1">
        <Badge tone={d.decision === 'NO_CUT' ? 'info' : 'warn'}>{d.label}</Badge>
        {d.noteNumber && <span className="tabular-nums">{d.noteNumber}</span>}
        {d.amount != null && <b className="tabular-nums">{rupiah(d.amount)}</b>}
        {d.reasonLabel && <span>({d.reasonLabel})</span>}
        {d.decision !== 'NO_CUT' && (d.recorded ? <Badge tone="ok">Sudah dicatat di kasir</Badge> : <Badge tone="danger">Belum dicatat di kasir</Badge>)}
      </p>
      {d.note && <p>{d.note}</p>}
      <p className="text-xs text-ink-muted">
        {d.by} · {d.on} {d.at}{d.changes > 0 ? ` · diubah ${d.changes}× (${d.changeReason})` : ''}
        {d.recorded ? ` · dicatat ${d.recorded.by} ${d.recorded.on}: ${d.recorded.ref}` : ''}
      </p>
    </div>
  );
}

function ReportCard({ row, onDecide }: { row: ReportRow; onDecide?: (row: ReportRow) => void }) {
  return (
    <Card className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="inline-flex flex-wrap items-center gap-1">
            <Badge tone={row.kind === 'RETURN' ? 'info' : 'warn'}>{row.label}</Badge>
            {row.customerId != null ? <Link href={`/logistik/toko/${row.customerId}`} className="font-medium underline">{row.store}</Link> : <span className="font-medium">{row.store}</span>}
            {row.source && <Badge tone="info">{row.source}</Badge>}
          </p>
          <p className="text-sm text-ink-muted">
            {row.by} · {row.on} {row.at} · {row.source ? 'perjalanan' : 'trip'} <Link href={row.tripHref} className="underline">{row.tripNumber}</Link>
            {row.carriedBack ? ' · barang dibawa pulang' : ''}
          </p>
          {row.note && <p className="text-sm">{row.note}</p>}
          {row.items.length > 0 && (
            <ul className="list-disc pl-5 text-sm">{row.items.map((i, n) => <li key={n}>{i.name}: {i.quantity} {i.unit}</li>)}</ul>
          )}
          <a href={row.photoUrl} target="_blank" rel="noreferrer" className="text-sm underline">Foto</a>
          <DecisionLine row={row} />
          {row.own && onDecide === undefined && !row.closed && <p className="text-xs text-ink-muted">Laporan Anda sendiri diputuskan orang lain.</p>}
        </div>
        {onDecide && <Button size="sm" variant={row.decision ? 'secondary' : 'primary'} onClick={() => onDecide(row)}>{row.decision ? 'Ubah keputusan' : 'Putuskan'}</Button>}
      </div>
    </Card>
  );
}

/**
 * Laporan Toko (spec LT1 §13.5 butir 5, §14.2 butir 1): Finance (Pemilik/GM) memutuskan Potong nota / Dicatat lewat Retur BO /
 * Tidak dipotong. Potong nota dan Retur BO masuk "Perlu dicatat di kasir"; ubah keputusan dengan alasan sampai dicatat.
 */
export function VisitReportsScreen({ open, closed, canDecide }: { open: ReportRow[]; closed: ReportRow[]; canDecide: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<ReportRow | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<CutReason | null>(null);
  const [note, setNote] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function begin(row: ReportRow) {
    const d = row.decision;
    setTarget(row);
    setDecision(d?.decision ?? null);
    setNoteId(d?.noteId ?? (row.noteOptions.length === 1 ? row.noteOptions[0].id : null));
    setAmount(d?.amount != null ? String(d.amount) : '');
    setReason(d?.reason ?? (row.kind === 'RETURN' ? null : cutReasonOf(row.kind)));
    setNote(d?.note ?? '');
    setChangeReason('');
    setError(null);
  }

  const check = target && decision
    ? cleanDecision(target.kind, { decision, noteId, amount: amount ? Number(amount) : null, reason, note }, target.noteOptions, { noteOptional: target.pickup })
    : null;
  const ready = !!check?.ok && (!target?.decision || changeReason.trim().length >= 5);

  async function save() {
    if (!target || !decision) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', {
      action: 'decide_visit_report', reportId: target.id, decision, noteId: decision === 'NO_CUT' ? null : noteId,
      amount: decision === 'CUT' && amount ? Number(amount) : null, reason: decision === 'CUT' ? reason : null, note: note || null,
      changeReason: target.decision ? changeReason : null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Keputusan laporan ${target.store} tersimpan.`, 'ok');
    setTarget(null);
    router.refresh();
  }

  const decidable = (row: ReportRow) => canDecide && !row.own && (!row.closed || (!!row.decision && !row.decision.recorded));
  const choices: Decision[] = target?.pickup ? ['RETURN_BO', 'NO_CUT'] : target?.kind === 'RETURN' ? ['RETURN_BO', 'CUT', 'NO_CUT'] : ['CUT', 'NO_CUT'];
  const chosenNote = target?.noteOptions.find((n) => n.id === noteId);

  return (
    <div className="space-y-4">
      <p className="inline-flex flex-wrap items-center gap-1 text-sm text-ink-muted">
        Laporan driver sesudah Terkirim. Finance memutuskan potong nota di sini; Potong nota dan Retur BO lalu dicatat di kasir lewat menu
        Perlu dicatat di kasir. HRIS tidak mengubah nota. <NewBadge feature="fitur/potong-nota" />
      </p>
      <h2 className="font-semibold">Belum diputuskan ({open.length})</h2>
      {!open.length ? <EmptyState title="Tidak ada laporan toko yang menunggu." /> : (
        <ul className="space-y-2">{open.map((r) => <li key={r.id}><ReportCard row={r} onDecide={decidable(r) ? begin : undefined} /></li>)}</ul>
      )}
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">30 laporan terakhir yang sudah diputuskan</summary>
          <ul className="mt-2 space-y-2">{closed.map((r) => <li key={r.id}><ReportCard row={r} onDecide={decidable(r) ? begin : undefined} /></li>)}</ul>
        </details>
      )}
      <Dialog
        open={!!target} onClose={() => setTarget(null)} title={target ? `${target.decision ? 'Ubah keputusan' : 'Putuskan'}: ${target.label} ${target.store}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Batal</Button><Button loading={busy} disabled={!ready} onClick={save}>Simpan</Button></>}
      >
        {target && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            {target.note && <p className="text-sm">Laporan driver: {target.note}</p>}
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => (
                <Button key={c} size="sm" variant={decision === c ? 'primary' : 'secondary'} onClick={() => setDecision(c)}>{DECISION_LABELS[c]}</Button>
              ))}
            </div>
            {target.pickup && decision === 'RETURN_BO' && (
              <p className="text-sm text-ink-muted">Retur jemputan: pilih nota asalnya langsung saat membuat Retur di Back Office.</p>
            )}
            {decision && decision !== 'NO_CUT' && !target.pickup && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Nota</p>
                {!target.noteOptions.length ? <p className="text-sm text-danger-fg">Kunjungan ini tidak punya nota kasir.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {target.noteOptions.map((n) => (
                      <Button key={n.id} size="sm" variant={noteId === n.id ? 'primary' : 'secondary'} onClick={() => setNoteId(n.id)}>
                        {n.number} · {rupiah(n.amount)}
                      </Button>
                    ))}
                  </div>
                )}
                {decision === 'CUT' && chosenNote && chosenNote.otherCuts > 0 && (
                  <p className="text-xs text-ink-muted">Sudah ada potongan lain {rupiah(chosenNote.otherCuts)} pada nota ini.</p>
                )}
              </div>
            )}
            {decision === 'CUT' && (
              <>
                <Field id="cut-amount" label="Nominal potongan (Rp)">
                  <Input id="cut-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 12))} />
                </Field>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Alasan potongan</p>
                  <div className="flex flex-wrap gap-2">
                    {CUT_REASONS.map((r) => <Button key={r.code} size="sm" variant={reason === r.code ? 'primary' : 'secondary'} onClick={() => setReason(r.code)}>{r.label}</Button>)}
                  </div>
                </div>
              </>
            )}
            {decision && (
              <Field
                id="decision-note"
                label={decision === 'NO_CUT' ? 'Catatan (wajib)' : decision === 'CUT' && reason === 'OTHER' ? 'Catatan (wajib untuk Lainnya)' : 'Catatan (boleh kosong)'}
                hint={decision === 'RETURN_BO' ? 'Nilai retur tidak diisi di HRIS; Finance membuat Retur di Back Office.' : undefined}
              >
                <Textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
            )}
            {target.decision && (
              <Field id="change-reason" label="Alasan ubah keputusan (wajib)">
                <Textarea id="change-reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} maxLength={500} />
              </Field>
            )}
            {check && !check.ok && (decision === 'NO_CUT' ? note : decision === 'CUT' ? amount : noteId) ? <p className="text-xs text-danger-fg">{check.error}</p> : null}
          </div>
        )}
      </Dialog>
    </div>
  );
}
