import type { SlipView } from '../server/payslip';
import type { SlipLine } from '../rules/payslip';
import { longDate, rupiah } from '../rules/salary';

/** Rincian satu baris (PRI-21): rincian per hari, kalimat, periode asal. Layar kantor saja; cetakan tidak membukanya. */
function LineDetails({ line }: { line: SlipLine }) {
  const d = line.details;
  if (!d.days?.length && !d.text && !line.originPeriod) return null;
  return (
    <details className="mt-1 text-xs text-ink-muted print:hidden">
      <summary className="cursor-pointer">Rincian</summary>
      {line.originPeriod && <p>Periode asal {longDate(line.originPeriod)}.</p>}
      {d.text && <p>{d.text}</p>}
      {d.days?.length ? (
        <ul className="mt-1 space-y-0.5">
          {d.days.map((day, i) => (
            <li key={`${day.workDate}-${i}`}>{longDate(day.workDate)}: {day.text} · {rupiah(day.amount)}{day.note ? ` (${day.note})` : ''}</li>
          ))}
        </ul>
      ) : null}
      {d.link && <a className="underline" href={d.link}>Buka catatan asal</a>}
    </details>
  );
}

const originText = (l: SlipLine) => (l.originPeriod ? ` (periode ${longDate(l.originPeriod)})` : '');

/** Bentuk slip (GAJ-97): satu bentuk untuk layar kantor dan cetakan. */
export function SlipDocument({ slip, printing = false }: { slip: SlipView; printing?: boolean }) {
  const estimate = slip.status === 'ESTIMATE';
  return (
    <article className="space-y-4 text-sm">
      <header className="flex flex-wrap justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-base font-semibold">{printing ? 'Slip Gaji' : 'Slip gaji'} {slip.number ?? ''}</p>
          <p>{slip.name} · {slip.positionName} · {slip.branchName}</p>
          <p>Periode {slip.period.label}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{estimate ? 'Perkiraan, belum final' : slip.statusLabel}{slip.version > 1 ? ` · versi ${slip.version}` : ''}</p>
          {slip.closedAt && <p>Ditutup {slip.closedAt}{slip.closedBy ? ` oleh ${slip.closedBy}` : ''}</p>}
        </div>
      </header>

      <section>
        <p className="mb-1 font-semibold">Pendapatan</p>
        <table className="w-full">
          <tbody>
            {slip.income.map((l) => (
              <tr key={l.sourceKey} className="align-top">
                <td className="py-0.5">{l.label}{originText(l)}<LineDetails line={l} /></td>
                <td className="py-0.5 text-right tabular-nums">{rupiah(l.amount)}</td>
              </tr>
            ))}
            {!slip.income.length && <tr><td className="text-ink-muted">Tidak ada.</td><td /></tr>}
            <tr className="border-t border-line font-medium"><td>Jumlah pendapatan</td><td className="text-right tabular-nums">{rupiah(slip.totals.income)}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <p className="mb-1 font-semibold">Potongan</p>
        <table className="w-full">
          <thead><tr className="text-left text-xs text-ink-muted"><th>Potongan</th><th className="text-right">Nominal</th><th className="text-right">Terpotong</th><th className="text-right">Sisa dibawa</th></tr></thead>
          <tbody>
            {slip.deductions.map((g) => (
              <GroupRows key={g.group} group={g} />
            ))}
            <tr className="border-t border-line font-medium"><td>Jumlah terpotong</td><td /><td className="text-right tabular-nums">{rupiah(slip.totals.taken)}</td><td className="text-right tabular-nums">{slip.totals.carried ? rupiah(slip.totals.carried) : '—'}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="flex justify-between border-y border-line py-2 text-base font-semibold">
        <span>Gaji bersih</span><span className="tabular-nums">{rupiah(slip.totals.net)}</span>
      </section>

      <section className="space-y-1 text-xs text-ink-muted">
        {slip.totals.carried > 0 && <p>Sisa potongan {rupiah(slip.totals.carried)} dibawa ke slip berikutnya.</p>}
        {slip.objectionUntil && <p>Keberatan atas slip ini paling lambat {slip.objectionUntil}.</p>}
        {estimate && <p>Angka perkiraan dihitung dari data terbaru; angka terkunci saat slip ditutup.</p>}
      </section>
    </article>
  );
}

function GroupRows({ group }: { group: SlipView['deductions'][number] }) {
  return (
    <>
      <tr><td colSpan={4} className="pt-2 text-xs font-medium">({group.group}) {group.label}</td></tr>
      {group.lines.map((l) => (
        <tr key={l.sourceKey} className="align-top">
          <td className="py-0.5 pl-3">{l.label}{originText(l)}<LineDetails line={l} /></td>
          <td className="py-0.5 text-right tabular-nums">{rupiah(l.amount)}</td>
          <td className="py-0.5 text-right tabular-nums">{rupiah(l.taken)}</td>
          <td className="py-0.5 text-right tabular-nums">{l.remaining ? rupiah(l.remaining) : '—'}</td>
        </tr>
      ))}
      {!group.lines.length && <tr><td colSpan={4} className="pl-3 text-xs text-ink-muted">{group.group === 'd' ? 'Kasbon menyusul.' : 'Tidak ada.'}</td></tr>}
    </>
  );
}
