'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';
import { kgText } from '../rules/unloading';

const timeText = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

/** Dialog satu isian alasan/teks lalu kirim ke /api/unloading. */
function TextDialog({ title, intro, label, min, body, field, danger, done, onClose }: {
  title: string; intro: string; label: string; min: number; body: Record<string, unknown>; field: string; danger?: boolean; done: string; onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/unloading', { ...body, [field]: text });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? done), 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><HoldButton variant={danger ? 'danger' : 'primary'} loading={busy} disabled={text.trim().length < min} onClick={save}>{title}</HoldButton></>}>
      <div className="space-y-3">
        <p>{intro}</p>
        <Field id="td-text" label={label} hint={min > 1 ? `Paling sedikit ${min} huruf.` : undefined}><Textarea id="td-text" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

type PaySection = {
  status: string; cancelReason: string | null;
  question: { text: string; by: string; at: string | null; answer: string | null; open: boolean } | null;
  can: { pay: boolean; ask: boolean; answer: boolean; correct: boolean; cancelPayment: boolean };
  payments: {
    id: number; topUp: boolean; status: string; kind: string; amount: number; moneyDate: string; by: string; source: string | null; handedTo: string; ownerFlag: boolean;
    cancelReason: string | null; at: string; lines: { name: string; share: number; offset: number; received: number }[];
  }[];
  topUps: { id: number; status: string; statusLabel: string; at: string; lines: { name: string; amount: number }[] }[];
  overpayments: { id: number; name: string; amount: number; remaining: number; status: string }[];
};

/** Bagian Pembayaran + tombol di Rincian Laporan Bongkaran (DRV-L13, L17 s.d. L20). */
export function UnloadingPaySection({ reportId, totalPay, data }: { reportId: number; totalPay: number; data: PaySection }) {
  const [dialog, setDialog] = useState<'ask' | 'answer' | 'cancel' | { payment: number } | null>(null);
  const paid = data.status === 'PAID';
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Pembayaran</h2>
      {data.question && (
        <Alert tone={data.question.open ? 'warn' : 'info'} title={data.question.open ? 'Ditanyakan Finance' : 'Pertanyaan Finance (sudah dijawab)'}>
          <p>{data.question.text} <span className="text-ink-muted">— {data.question.by}{data.question.at ? `, ${timeText(data.question.at)}` : ''}</span></p>
          {data.question.answer && <p>Jawaban: {data.question.answer}</p>}
        </Alert>
      )}
      {data.cancelReason && <Alert tone="danger">Dibatalkan: {data.cancelReason}</Alert>}
      <div className="flex flex-wrap gap-2">
        {data.can.pay && <Link className={buttonClass({})} href={`/gaji/bongkaran/bayar?r=${reportId}`}>Bayar {rupiah(totalPay)}</Link>}
        {data.can.ask && <Button variant="secondary" onClick={() => setDialog('ask')}>Tanyakan dulu</Button>}
        {data.can.answer && <Button variant="secondary" onClick={() => setDialog('answer')}>Jawab</Button>}
        {data.can.correct && <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/bongkaran/${reportId}/koreksi`}>Koreksi</Link>}
        {data.can.correct && <Button variant="ghost" onClick={() => setDialog('cancel')}>Batalkan laporan</Button>}
      </div>
      {!data.payments.length && <p className="text-sm text-ink-muted">Belum ada pembayaran.</p>}
      {data.payments.map((p) => (
        <div key={p.id} className="space-y-1 rounded-card border border-line p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={p.status === 'ACTIVE' ? 'ok' : 'danger'}>{p.status === 'ACTIVE' ? 'Berlaku' : 'Dibatalkan'}</Badge>
            <b>{p.topUp ? 'Susulan' : 'Pembayaran'} {rupiah(p.amount)}</b> · tanggal uang {longDate(p.moneyDate)} · oleh {p.by}{p.source ? ` · ${p.source}` : ''} · {p.handedTo}
            {p.ownerFlag && <Badge tone="warn">Pembayar ikut/pembuat</Badge>}
          </p>
          <ul className="text-ink-muted">{p.lines.map((l, i) => <li key={i}>{l.name}: bagian {rupiah(l.share)}{l.offset ? `, diperhitungkan lebih bayar ${rupiah(l.offset)}` : ''}, diterima {rupiah(l.received)}</li>)}</ul>
          {p.cancelReason && <p className="text-danger-fg">Batal bayar: {p.cancelReason}</p>}
          {p.status === 'ACTIVE' && data.can.cancelPayment && <Button size="sm" variant="ghost" onClick={() => setDialog({ payment: p.id })}>Batal bayar</Button>}
        </div>
      ))}
      {data.topUps.length > 0 && (
        <div className="text-sm"><p className="font-medium">Susulan</p>
          <ul>{data.topUps.map((t) => <li key={t.id}>{timeText(t.at)} · {t.statusLabel} · {t.lines.map((l) => `${l.name} ${rupiah(l.amount)}`).join(', ')}</li>)}</ul>
        </div>
      )}
      {data.overpayments.length > 0 && (
        <div className="text-sm"><p className="font-medium">Lebih bayar dari laporan ini</p>
          <ul>{data.overpayments.map((o) => <li key={o.id}>{o.name}: {rupiah(o.amount)}, sisa {rupiah(o.remaining)} · {o.status}</li>)}</ul>
        </div>
      )}
      {dialog === 'ask' && <TextDialog title="Tanyakan dulu" intro="Pembuat laporan, Pemilik, dan GM diberi tahu. Tanda ini bukan penahan; pengingat belum dibayar tetap berjalan." label="Pertanyaan" min={15} field="question" body={{ kind: 'ask', id: reportId }} done="Pertanyaan terkirim." onClose={() => setDialog(null)} />}
      {dialog === 'answer' && <TextDialog title="Jawab" intro={data.question?.text ?? ''} label="Jawaban" min={3} field="answer" body={{ kind: 'answer', id: reportId }} done="Jawaban terkirim ke penanya." onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && (
        <TextDialog title="Batalkan laporan" danger field="reason" min={15} label="Alasan" body={{ kind: 'cancel', id: reportId }} done="Laporan dibatalkan." onClose={() => setDialog(null)}
          intro={paid ? `${rupiah(totalPay)} sudah diterima peserta; menjadi lebih bayar masing-masing dan diperhitungkan di bongkaran mereka berikutnya. Laporan yang dibatalkan tidak dihidupkan lagi.` : 'Baris upah semua peserta dibatalkan dan laporan keluar dari daftar bayar. Laporan yang dibatalkan tidak dihidupkan lagi; yang benar dibuat sebagai laporan baru.'} />
      )}
      {dialog && typeof dialog === 'object' && (
        <TextDialog title="Batal bayar" danger field="reason" min={15} label="Alasan" body={{ kind: 'cancel_payment', id: dialog.payment }} done="Pembayaran dibatalkan; laporan kembali menunggu dibayar." onClose={() => setDialog(null)}
          intro="Untuk pembayaran yang salah catat. Lebih bayar yang diperhitungkan di pembayaran ini hidup kembali, dan laporan (atau susulan) kembali menunggu dibayar." />
      )}
    </Card>
  );
}

type Ready = {
  key: string; reportId: number; topUpId: number | null; label: string; workDate: string; supplierName: string; totalKg: string; flags: string[]; photoIds: number[];
  ownerFlag: boolean; creator: { key: string; name: string }; lines: { key: string; name: string; share: number; offset: number; received: number }[]; amount: number;
};

/** DRV-L17 Bayar Bongkaran (3 langkah): yang dibayar, dari mana/kapan/kepada siapa, bayar. */
export function UnloadingPayForm({ today, freeDays, ready, blocked, sources }: {
  today: string; freeDays: number; ready: Ready[]; blocked: { label: string; why: string }[]; sources: { id: number; name: string; method: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState(sources.length === 1 ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [dateReason, setDateReason] = useState('');
  const [handed, setHanded] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = ready.reduce((s, r) => s + r.amount, 0);
  const people = ready.reduce((s, r) => s + r.lines.length, 0);
  const old = Math.round((Date.parse(today) - Date.parse(moneyDate)) / 86_400_000) > freeDays;
  const source = sources.find((s) => String(s.id) === sourceId);

  function next() {
    setError(null);
    if (step === 2) {
      if (total > 0 && !sourceId) return setError('Pilih sumber uang.');
      if (old && dateReason.trim().length < 15) return setError(`Tanggal uang mundur lebih dari ${freeDays} hari: tulis alasannya.`);
    }
    setStep(step + 1);
  }
  async function pay() {
    setBusy(true);
    setError(null);
    let proofFileId: string | null = null;
    if (proof) {
      const body = new FormData();
      body.append('file', proof);
      const up = await postJson('/api/files', body);
      if (!up.ok) { setBusy(false); return setError(up.error ?? 'Foto bukti gagal diunggah.'); }
      proofFileId = String(up.data?.id);
    }
    const result = await postJson('/api/unloading', {
      kind: 'pay', targets: ready.map((r) => ({ reportId: r.reportId, topUpId: r.topUpId })), sourceId: sourceId ? Number(sourceId) : null, moneyDate,
      dateReason: old ? dateReason : null, proofFileId, handedTo: Object.fromEntries(ready.map((r) => [r.key, handed[r.key] || null])),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membayar.');
    const failed = (result.data?.failed as string[] | undefined) ?? [];
    toast(`${result.data?.paid} laporan dibayar, ${rupiah(Number(result.data?.total ?? 0))}.${failed.length ? ` Gagal: ${failed.join(' ')}` : ''}`, failed.length ? 'info' : 'ok');
    router.push('/gaji/bongkaran');
    router.refresh();
  }

  if (!ready.length) {
    return <Card className="space-y-2"><Alert tone="warn">Tidak ada yang bisa dibayar.</Alert>{blocked.map((b) => <p key={b.label} className="text-sm">{b.label}: {b.why}</p>)}<Link className="underline" href="/gaji/bongkaran">Kembali</Link></Card>;
  }
  return (
    <Card className="max-w-3xl space-y-4">
      <p className="text-sm text-ink-muted">Langkah {step} dari 3</p>
      {blocked.length > 0 && <Alert tone="warn" title="Tidak ikut dibayar">{blocked.map((b) => <p key={b.label}>{b.label}: {b.why}</p>)}</Alert>}
      {step === 1 && ready.map((r) => (
        <div key={r.key} className="space-y-2 rounded-card border border-line p-3 text-sm">
          <p className="font-medium">{r.label} · {r.supplierName} · {longDate(r.workDate)} · {kgText(r.totalKg)} kg</p>
          {r.flags.length > 0 && <p className="flex flex-wrap gap-1">{r.flags.map((f) => <Badge key={f} tone="warn">{f}</Badge>)}</p>}
          {r.ownerFlag && <Alert tone="warn">Anda ikut atau membuat laporan ini; pembayaran bertanda dan para pemilik diberi tahu.</Alert>}
          {r.photoIds.length > 0 && <p className="flex flex-wrap gap-2">{r.photoIds.map((id) => <a key={id} className="underline" href={`/api/unloading/photos/${id}`} target="_blank" rel="noreferrer">Foto {id}</a>)}</p>}
          <ul>{r.lines.map((l) => <li key={l.key}>{l.name}: bagian {rupiah(l.share)}{l.offset ? ` − lebih bayar ${rupiah(l.offset)}` : ''} = <b>{rupiah(l.received)}</b></li>)}</ul>
          <p>Uang keluar: <b>{rupiah(r.amount)}</b></p>
        </div>
      ))}
      {step === 2 && (
        <div className="space-y-3">
          {total > 0 ? (
            <Field id="up-source" label="Sumber uang">
              <Select id="up-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Pilih sumber uang</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          ) : <Alert tone="info">Semua bagian habis diperhitungkan lebih bayar: dibayar tanpa uang.</Alert>}
          <Field id="up-date" label="Tanggal uang" hint={`Boleh mundur sampai ${freeDays} hari tanpa alasan; tidak sebelum tanggal kerja.`}>
            <Input id="up-date" type="date" max={today} value={moneyDate} onChange={(e) => setMoneyDate(e.target.value)} />
          </Field>
          {old && <Field id="up-reason" label="Alasan tanggal mundur"><Textarea id="up-reason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} /></Field>}
          {ready.map((r) => (
            <Field key={r.key} id={`up-h-${r.key}`} label={`Diserahkan kepada (${r.label})`}>
              <Select id={`up-h-${r.key}`} value={handed[r.key] ?? ''} onChange={(e) => setHanded((h) => ({ ...h, [r.key]: e.target.value }))}>
                <option value="">Langsung ke tiap peserta</option>
                {r.lines.map((l) => <option key={l.key} value={l.key}>Dititipkan ke {l.name}</option>)}
                {!r.lines.some((l) => l.key === r.creator.key) && <option value={r.creator.key}>Dititipkan ke {r.creator.name} (pembuat)</option>}
              </Select>
            </Field>
          ))}
          <Field id="up-proof" label="Foto bukti (dianjurkan)"><Input id="up-proof" type="file" accept="image/*" capture="environment" onChange={(e) => setProof(e.target.files?.[0] ?? null)} /></Field>
        </div>
      )}
      {step === 3 && (
        <p className="text-sm">{ready.length} laporan, {people} orang, <b>{rupiah(total)}</b>{source ? ` dari ${source.name}` : ''}, tanggal {longDate(moneyDate)}. Peserta yang punya akun diberi tahu dan boleh melapor bila uangnya belum diterima dalam 3 hari.</p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href="/gaji/bongkaran">Batal</Link>}
        {step < 3 ? <Button onClick={next}>Lanjut</Button> : <HoldButton loading={busy} onClick={pay}>Bayar {rupiah(total)}</HoldButton>}
      </div>
    </Card>
  );
}

/** Tab Belum dibayar: centang lalu Bayar terpilih (DRV-L11 titipan 4G-3b). */
export function UnloadingPayPicker({ rows, topUps }: {
  rows: { id: number; number: string; totalPay: number; status: string }[];
  topUps: { topUpId: number; reportId: number; number: string; workDate: string; supplierName: string; total: number }[];
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (key: string) => setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  const sum = [...rows.filter((r) => picked.includes(`r${r.id}`)).map((r) => r.totalPay), ...topUps.filter((t) => picked.includes(`t${t.topUpId}`)).map((t) => t.total)].reduce((s, n) => s + n, 0);
  const href = `/gaji/bongkaran/bayar?${picked.map((k) => (k.startsWith('r') ? `r=${k.slice(1)}` : `t=${k.slice(1)}`)).join('&')}`;
  if (!rows.length && !topUps.length) return null;
  return (
    <Card className="space-y-2">
      <p className="text-sm font-medium">Pilih yang dibayar</p>
      <div className="flex flex-wrap gap-2 text-sm">
        {rows.filter((r) => r.status === 'ACTIVE').map((r) => (
          <label key={r.id} className="flex items-center gap-1"><input type="checkbox" checked={picked.includes(`r${r.id}`)} onChange={() => toggle(`r${r.id}`)} />{r.number} {rupiah(r.totalPay)}</label>
        ))}
        {topUps.map((t) => (
          <label key={t.topUpId} className="flex items-center gap-1"><input type="checkbox" checked={picked.includes(`t${t.topUpId}`)} onChange={() => toggle(`t${t.topUpId}`)} /><Badge tone="warn">Susulan</Badge>{t.number} {rupiah(t.total)}</label>
        ))}
      </div>
      {picked.length > 0 && <Link className={buttonClass({})} href={href}>Bayar terpilih ({picked.length}, {rupiah(sum)})</Link>}
    </Card>
  );
}

type OverRow = { id: number; name: string; casual: boolean; reportId: number; number: string; bornOn: string; amount: number; remaining: number; used: number; age: number; late: boolean; status: string; statusLabel: string };

/** DRV-L21 Lebih Bayar Bongkaran. */
export function UnloadingOverpaymentsTab({ days, canDecide, canRefund, today, head, rows, sources }: {
  days: number; canDecide: boolean; canRefund: boolean; today: string; head: { people: number; remaining: number; late: number }; rows: OverRow[]; sources: { id: number; name: string }[];
}) {
  const [dialog, setDialog] = useState<{ row: OverRow; kind: 'COLLECT' | 'WRITE_OFF' | 'REFUND' } | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm">{head.people} orang masih bersisa {rupiah(head.remaining)} · {head.late} lewat {days} hari.</p>
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Belum ada lebih bayar bongkaran."
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (r) => <span>{r.name}{r.casual ? <span className="text-ink-muted"> · pekerja lepas</span> : null}</span> },
          { key: 'report', header: 'Laporan asal', render: (r) => <Link className="underline" href={`/gaji/bongkaran/${r.reportId}`}>{r.number}</Link> },
          { key: 'born', header: 'Lahir', render: (r) => `${longDate(r.bornOn)} (${r.age} hari)` },
          { key: 'amount', header: 'Nominal', render: (r) => rupiah(r.amount) },
          { key: 'used', header: 'Sudah tertutup', render: (r) => rupiah(r.used) },
          { key: 'remaining', header: 'Sisa', render: (r) => <b>{rupiah(r.remaining)}</b> },
          { key: 'status', header: 'Status', render: (r) => <span className="flex gap-1"><Badge tone={r.late ? 'danger' : 'info'}>{r.statusLabel}</Badge>{r.late && <Badge tone="danger">Lewat {days} hari</Badge>}</span> },
          {
            key: 'act', header: '', render: (r) => (r.remaining > 0 && r.status !== 'WRITTEN_OFF' ? (
              <span className="flex flex-wrap gap-1">
                {canDecide && r.status === 'OPEN' && <Button size="sm" variant="ghost" onClick={() => setDialog({ row: r, kind: 'COLLECT' })}>Tagih tunai</Button>}
                {canDecide && <Button size="sm" variant="ghost" onClick={() => setDialog({ row: r, kind: 'WRITE_OFF' })}>Hapus</Button>}
                {canRefund && <Button size="sm" variant="ghost" onClick={() => setDialog({ row: r, kind: 'REFUND' })}>Terima pengembalian</Button>}
              </span>
            ) : null),
          },
        ]}
      />
      <p className="text-sm text-ink-muted">Lebih bayar diperhitungkan otomatis di pembayaran bongkaran berikutnya orang itu (yang paling lama lebih dulu). Tidak diambil dari slip dan bukan Potongan Lain.</p>
      {dialog?.kind === 'COLLECT' && <TextDialog title="Tagih tunai" intro={`${dialog.row.name}: sisa ${rupiah(dialog.row.remaining)}. Perhitungan otomatis di bongkaran berikutnya tetap berjalan sampai uangnya diterima.`} label="Catatan" min={0} field="reason" body={{ kind: 'overpay_decide', id: dialog.row.id, decision: 'COLLECT' }} done="Ditandai ditagih tunai." onClose={() => setDialog(null)} />}
      {dialog?.kind === 'WRITE_OFF' && <TextDialog title="Hapus" danger intro={`${dialog.row.name}: sisa ${rupiah(dialog.row.remaining)} menjadi Rp0. Tidak ada uang yang bergerak.`} label="Alasan" min={15} field="reason" body={{ kind: 'overpay_decide', id: dialog.row.id, decision: 'WRITE_OFF' }} done="Lebih bayar dihapus." onClose={() => setDialog(null)} />}
      {dialog?.kind === 'REFUND' && <RefundDialog row={dialog.row} today={today} sources={sources} onClose={() => setDialog(null)} />}
    </div>
  );
}

function RefundDialog({ row, today, sources, onClose }: { row: OverRow; today: string; sources: { id: number; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(String(row.remaining));
  const [sourceId, setSourceId] = useState(sources.length === 1 ? String(sources[0].id) : '');
  const [moneyDate, setMoneyDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/unloading', { kind: 'overpay_refund', id: row.id, amount: Number(amount), sourceId: Number(sourceId), moneyDate });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Pengembalian dicatat.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title="Terima pengembalian"
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><HoldButton loading={busy} disabled={!sourceId} onClick={save}>Simpan</HoldButton></>}>
      <div className="space-y-3">
        <p>{row.name}: sisa {rupiah(row.remaining)}.</p>
        <Field id="rf-amount" label="Nominal diterima"><Input id="rf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field id="rf-source" label="Masuk ke sumber uang"><Select id="rf-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">Pilih</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field id="rf-date" label="Tanggal uang"><Input id="rf-date" type="date" max={today} value={moneyDate} onChange={(e) => setMoneyDate(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

/** DRV-L22 Bongkaran per Orang. */
export function UnloadingPerPersonTab({ from, to, q, kind, rows }: {
  from: string; to: string; q: string; kind: string;
  rows: { key: string; name: string; casual: boolean; times: number; kg: string; shares: number; received: number; unpaid: number; overpay: number }[];
}) {
  return (
    <div className="space-y-3">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="PEOPLE" />
        <Field id="pp-from" label="Dari"><Input id="pp-from" type="date" name="dari" defaultValue={from} /></Field>
        <Field id="pp-to" label="Sampai"><Input id="pp-to" type="date" name="sampai" defaultValue={to} /></Field>
        <Field id="pp-kind" label="Orang"><Select id="pp-kind" name="jenis" defaultValue={kind}><option value="">Semua</option><option value="EMPLOYEE">Karyawan</option><option value="CASUAL">Pekerja lepas</option></Select></Field>
        <Field id="pp-q" label="Cari nama"><Input id="pp-q" name="cari" defaultValue={q} /></Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
        <a className={buttonClass({ variant: 'ghost' })} href={`/api/unloading/per-person?dari=${from}&sampai=${to}`}>Unduh CSV</a>
      </form>
      <DataList
        rows={rows}
        rowKey={(r) => r.key}
        empty="Belum ada bongkaran di rentang ini."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (r) => <span>{r.name}{r.casual ? <span className="text-ink-muted"> · pekerja lepas</span> : null}</span> },
          { key: 'times', header: 'Berapa kali', render: (r) => r.times },
          { key: 'kg', header: 'Kg bagian', render: (r) => kgText(r.kg) },
          { key: 'shares', header: 'Jumlah bagian', render: (r) => rupiah(r.shares) },
          { key: 'received', header: 'Diterima', render: (r) => rupiah(r.received) },
          { key: 'unpaid', header: 'Belum dibayar', render: (r) => rupiah(r.unpaid) },
          { key: 'overpay', header: 'Sisa lebih bayar', render: (r) => rupiah(r.overpay) },
        ]}
      />
      <p className="text-sm text-ink-muted">Kg bagian = total kg laporan dibagi jumlah peserta. Diterima sudah dikurangi lebih bayar yang diperhitungkan.</p>
    </div>
  );
}

type MyRow = {
  reportId: number; workDate: string; totalKg: string; people: number; share: number; corrected: { from: number; to: number } | null; status: string; offset: number;
  topUps: { amount: number; status: string }[]; claimPaymentId: number | null;
};

/** Kartu Upah bongkaran di Pendapatan Saya (DRV-53, 120) + "Uang belum saya terima" (DRV-113). */
export function MyUnloadingCard({ rows, overpay }: { rows: MyRow[]; overpay: number }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!rows.length) return null;
  async function send() {
    setBusy(true);
    const result = await postJson('/api/requests', { kind: 'submit', typeKey: 'unloading_not_received', fields: { paymentId: target, note }, attachmentIds: [] });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast('Laporan terkirim. Pemilik atau GM dan yang membayar diberi tahu.', 'ok');
    setTarget(null); setNote('');
    router.refresh();
  }
  return (
    <Card className="space-y-3" >
      <h2 id="bongkaran" className="font-semibold">Upah bongkaran (90 hari terakhir)</h2>
      {overpay > 0 && <Alert tone="warn">Sisa lebih bayar bongkaran Anda {rupiah(overpay)}; diperhitungkan di bongkaran Anda berikutnya.</Alert>}
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.reportId} className="rounded-card border border-line p-2">
            <p><b>{longDate(r.workDate)}</b> · {kgText(r.totalKg)} kg · {r.people} orang · bagian Anda <b>{rupiah(r.share)}</b></p>
            <p className="text-ink-muted">{r.status}{r.corrected ? ` · dikoreksi ${rupiah(r.corrected.from)} → ${rupiah(r.corrected.to)}` : ''}{r.offset ? ` · diperhitungkan lebih bayar ${rupiah(r.offset)}` : ''}</p>
            {r.topUps.map((t, i) => <p key={i} className="text-ink-muted">Susulan {rupiah(t.amount)} · {t.status}</p>)}
            {r.claimPaymentId && <Button size="sm" variant="ghost" onClick={() => setTarget(r.claimPaymentId)}>Uang belum saya terima</Button>}
          </li>
        ))}
      </ul>
      {target != null && (
        <Dialog open onClose={() => setTarget(null)} title="Uang belum saya terima"
          footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Kembali</Button><Button loading={busy} disabled={note.trim().length < 15} onClick={send}>Kirim</Button></>}>
          <div className="space-y-3">
            <p>Pemilik atau GM memeriksa dan memutuskan. Yang membayar ikut diberi tahu.</p>
            <Field id="mu-note" label="Keterangan" hint="Paling sedikit 15 huruf."><Textarea id="mu-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </Card>
  );
}
