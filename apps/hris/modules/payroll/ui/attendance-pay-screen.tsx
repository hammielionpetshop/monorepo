'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import type { LineKey, PayResult } from '../rules/attendance-pay';
import { longDate, rupiah } from '../rules/salary';
import { WaiveDialog, type WaiveTarget } from './waive-dialog';

const RULE_TEXT: Partial<Record<LineKey, string>> = {
  LATE: 'Telat di atas toleransi dipotong seluruh menitnya.',
  PERMIT_SICK: 'Izin, izin duka, dan sakit tanpa surat dihitung bersama dalam periode ini.',
  SUDDEN: 'Izin mendadak punya hitungan harinya sendiri.',
  ALPHA: 'Alpha punya hitungan harinya sendiri.',
  SICK_LETTER: 'Sakit dengan surat dokter dihitung per periode.',
  OVERTIME: 'Jam lembur yang disahkan × tarif lembur.',
  COMPENSATION: 'Diminta masuk di hari libur dan benar-benar masuk.',
  FINE: 'Denda lupa absen yang penjelasannya disetujui dan denda tidak memilih libur.',
};

const RULE_CARD: Partial<Record<LineKey, string>> = {
  LATE: 'late', PERMIT_SICK: 'permit', SUDDEN: 'sudden', ALPHA: 'alpha', SICK_LETTER: 'sick_letter', OVERTIME: 'overtime', COMPENSATION: 'compensation', FINE: 'forgot',
};

/** GAJ-L09 Hitungan Kehadiran: dari mana tiap rupiah kehadiran, sampai ke hari dan aturannya. */
export function AttendancePayScreen({ person, period, periods, computedAt, result, labels, canWaive, note }: {
  person: { id: number; name: string; positionName: string; branchName: string; workStatus: 'TRAINING' | 'EMPLOYEE' };
  period: { start: string; end: string; label: string };
  periods: { start: string; label: string }[];
  computedAt: string;
  result: PayResult | null;
  labels: { lines: Record<LineKey, string> };
  canWaive: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<WaiveTarget | null>(null);
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(computedAt));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>{person.positionName}</span><span>·</span><span>{person.branchName}</span><span>·</span>
        <span>{person.workStatus === 'TRAINING' ? 'Training' : 'Karyawan'}</span><span>·</span>
        <Link className="underline" href={`/gaji/${person.id}`}>Kembali ke Gaji {person.name}</Link>
        {' · '}<Link className="underline" href={`/gaji/${person.id}/potongan`}>Lihat urutan potongan</Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ap-period" label="Periode">
          <Select id="ap-period" value={period.start} onChange={(e) => router.push(`/gaji/${person.id}/hitungan?periode=${e.target.value}`)}>
            {periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
          </Select>
        </Field>
        <Badge tone="info">Perkiraan, dihitung pukul {time}</Badge>
      </div>
      {note && <Alert tone="info">{note}</Alert>}
      {!result && <Alert tone="warn" title="Belum ada gaji">Hitungan belum bisa dibuat karena gaji orang ini di periode ini belum diisi.</Alert>}
      {result && (
        <>
          <Card>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Gaji tetap sebulan</dt><dd className="tabular-nums">{rupiah(result.monthly)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-muted">Gaji harian (keterangan)</dt><dd className="tabular-nums">Rp{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(result.daily)}</dd></div>
            </dl>
          </Card>
          {result.lines.map((line) => (
            <Card key={line.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{labels.lines[line.key]}</h2>
                <span className={`tabular-nums font-semibold ${line.sign === -1 && line.amount > 0 ? 'text-danger-fg' : ''}`}>
                  {line.key === 'BASE' ? '' : line.sign === 1 ? '+ ' : '− '}{rupiah(line.amount)}
                </span>
              </div>
              {RULE_TEXT[line.key] && <p className="mt-1 text-sm text-ink-muted">{RULE_TEXT[line.key]} <Link className="underline" href={`/panduan/aturan-potongan#${RULE_CARD[line.key]}`}>Lihat aturan</Link></p>}
              {line.details.length > 0 && (
                <details className="mt-2" open={line.key !== 'BASE' && line.details.length <= 5}>
                  <summary className="cursor-pointer text-sm">Rincian ({line.details.length})</summary>
                  <ul className="mt-2 divide-y divide-line text-sm">
                    {line.details.map((d) => (
                      <li key={`${d.workDate}-${d.text}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span>
                          <span className="text-ink-muted">{longDate(d.workDate)}</span> · {d.text}
                          {d.note && <> <Badge tone={d.waived ? 'warn' : 'info'}>{d.note}</Badge></>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{rupiah(d.amount)}</span>
                          {canWaive && d.waive && !d.waived && d.amount > 0 && (
                            <Button size="sm" variant="ghost" onClick={() => setTarget({
                              mode: 'waive', employeeId: person.id, name: person.name, kind: d.waive!.kind, fineKind: d.waive!.fineKind,
                              workDate: d.workDate, what: d.waive!.kind === 'LATE' ? 'Potongan telat' : d.text.replace(/ \(.*\)$/, ''), amount: d.amount,
                            })}>Tiadakan</Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          ))}
          {(result.paidFull.dayOff + result.paidFull.leave + result.paidFull.closed > 0) && (
            <p className="text-sm text-ink-muted">Libur {result.paidFull.dayOff}, cuti {result.paidFull.leave}, hari tutup {result.paidFull.closed}: dibayar penuh.</p>
          )}
          {result.pending.length > 0 && (
            <Alert tone="warn" title={`${result.pending.length} hari belum dipotong`}>
              {result.pending.map((p) => `${longDate(p.workDate)}: ${p.text}`).join(' · ')}
            </Alert>
          )}
          <Card>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt>Gaji tetap periode ini</dt><dd className="tabular-nums">{rupiah(result.lines[0].amount)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Tambahan kehadiran</dt><dd className="tabular-nums">+ {rupiah(result.additions)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Potongan kehadiran</dt><dd className="tabular-nums">− {rupiah(result.deductions)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-1 font-semibold"><dt>Perkiraan</dt><dd className="tabular-nums">{rupiah(result.estimate)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-ink-muted">Belum termasuk potongan lain (kehilangan barang, minus kas, Potongan Lain) dan bonus. Periode {period.label}.</p>
          </Card>
        </>
      )}
      <WaiveDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
