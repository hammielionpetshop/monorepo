import type { ReactNode } from 'react';
import { EmptyState } from './surface';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Kolom utama jadi judul kartu di HP. */
  primary?: boolean;
};

/**
 * Daftar data: tabel di layar lebar, kartu bertumpuk di HP (SIS-03).
 * Tidak ada urutan/filter di sini; itu urusan layar pemakainya.
 */
export function DataList<T>({
  rows, columns, rowKey, empty = 'Belum ada data.',
}: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string | number; empty?: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-card border border-line bg-surface p-3">
            <div className="font-medium">{primary.render(row)}</div>
            <dl className="mt-2 space-y-1 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{c.header}</dt>
                  <dd className="text-right">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-ink-muted">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className="px-4 py-2.5 font-medium">{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => <td key={c.key} className="px-4 py-2.5">{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
