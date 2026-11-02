'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Year = {
  start: string; end: string; expiresOn: string; quota: number; balance: number; reserved: number; used: number; expired: number; adjusted: number;
  history: { id: number; label: string; at: string; reason: string | null }[];
};

type Props = {
  employeeId: number | null;
  name: string;
  firstDate: string | null;
  quota: number | null;
  current: Year | null;
  previous: Year[];
  canAdjust: boolean;
  self: boolean;
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const long = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const at = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

function YearCard({ year, title }: { year: Year; title: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-muted">{title}: {long(year.start)} – {long(year.end)}</p>
      <p className="mt-2 text-4xl font-bold">{year.balance} <span className="text-base font-normal text-ink-muted">hari sisa</span></p>
      <dl className="mt-3 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
        <div><dt className="text-ink-muted">Jatah</dt><dd>{year.quota} hari</dd></div>
        <div><dt className="text-ink-muted">Dipesan</dt><dd>{year.reserved} hari</dd></div>
        <div><dt className="text-ink-muted">Dipakai</dt><dd>{year.used} hari</dd></div>
        <div><dt className="text-ink-muted">Hangus pada</dt><dd>{long(year.expiresOn)}</dd></div>
      </dl>
      {(year.expired > 0 || year.adjusted !== 0) && (
        <p className="mt-2 text-xs text-ink-muted">{year.expired > 0 ? `Hangus ${year.expired} hari. ` : ''}{year.adjusted !== 0 ? `Disesuaikan ${year.adjusted > 0 ? '+' : ''}${year.adjusted} hari.` : ''}</p>
      )}
      <h3 className="mt-4 text-sm font-semibold">Riwayat</h3>
      {year.history.length === 0 ? <p className="text-sm text-ink-muted">Belum ada gerak.</p> : (
        <ul className="mt-1 divide-y divide-line text-sm">
          {year.history.map((row) => (
            <li key={row.id} className="py-1.5">
              <span className="font-medium">{row.label}</span> <span className="text-xs text-ink-muted">{at(row.at)}</span>
              {row.reason && <p className="text-xs text-ink-muted">{row.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** KEH-L31 Sisa Cuti Saya; dipakai juga HR di Halaman orang (Sesuaikan sisa, spec L3f §9 butir 4). Hanya baca untuk orangnya. */
export function LeaveScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [showOld, setShowOld] = useState(false);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function adjust() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/attendance/absence', { action: 'adjust', employeeId: props.employeeId, days: Number(days), reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    setOpen(false);
    toast(`Sisa cuti sekarang ${result.data?.balance} hari.`, 'ok');
    router.refresh();
  }

  if (!props.current) {
    return (
      <Alert>
        {props.self ? 'Cuti pertama Anda' : `Cuti pertama ${props.name}`} bisa diajukan mulai {props.firstDate ? long(props.firstDate) : '-'}.
        Jatahnya {props.quota} hari per tahun cuti.
      </Alert>
    );
  }
  return (
    <div className="space-y-4">
      <YearCard year={props.current} title="Tahun cuti" />
      <div className="flex flex-wrap gap-2">
        {props.self && <Link href="/tidak-masuk/ajukan?jenis=ANNUAL_LEAVE" className={buttonClass()}>Ajukan cuti</Link>}
        {props.canAdjust && <Button variant="secondary" onClick={() => { setOpen(true); setError(null); }}>Sesuaikan sisa</Button>}
        {props.previous.length > 0 && (
          <Button variant="ghost" onClick={() => setShowOld(!showOld)}>{showOld ? 'Sembunyikan tahun lama' : 'Lihat tahun cuti lama'}</Button>
        )}
      </div>
      {showOld && props.previous.map((year) => <YearCard key={year.start} year={year} title="Tahun cuti lama" />)}
      <Dialog open={open} onClose={() => setOpen(false)} title="Sesuaikan sisa cuti">
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Untuk memasukkan cuti yang sudah dipakai di sistem lama. Isi minus untuk mengurangi. Tercatat dan orangnya diberi tahu.</p>
          <Field id="lv-days" label="Jumlah hari (+/-)">
            <Input id="lv-days" type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field id="lv-reason" label="Alasan">
            <Textarea id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Kembali</Button>
            <Button loading={busy} onClick={adjust}>Simpan</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
