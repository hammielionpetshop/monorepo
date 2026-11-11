import type { ReactNode } from 'react';

export type Explanation = {
  /** Artinya: apa angka ini, bahasa sehari-hari. */
  meaning: ReactNode;
  /** Asal angka: layar & catatan sumbernya. */
  origin: ReactNode;
  /** Hitungan memakai angka yang sedang tampil. */
  calc: ReactNode;
  /** Perlu diketahui: batasan sumber, terus terang. */
  notes?: ReactNode[];
  /** Lihat rincian →. */
  detail?: { href: string; label: string } | null;
};

/** Tombol "Cara membaca" (PRD 07 §3): susunan tetap Artinya · Asal angka · Hitungan · Perlu diketahui · Lihat rincian. */
export function CaraMembaca({ title, e }: { title: string; e: Explanation }) {
  return (
    <details className="group mt-1 text-left">
      <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">Cara membaca</summary>
      <div className="mt-2 w-full max-w-md rounded-md border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-sm">
        <p className="mb-2 font-semibold">Cara membaca: {title}</p>
        <dl className="space-y-1.5">
          <div><dt className="inline font-medium">Artinya: </dt><dd className="inline">{e.meaning}</dd></div>
          <div><dt className="inline font-medium">Asal angka: </dt><dd className="inline">{e.origin}</dd></div>
          <div><dt className="inline font-medium">Hitungan: </dt><dd className="inline tabular-nums">{e.calc}</dd></div>
          {e.notes && e.notes.length > 0 && (
            <div>
              <dt className="font-medium">Perlu diketahui:</dt>
              <dd>
                <ul className="ml-4 list-disc">{e.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </dd>
            </div>
          )}
        </dl>
        {e.detail && (
          <a href={e.detail.href} className="mt-2 inline-block font-medium text-primary hover:underline">{e.detail.label} →</a>
        )}
      </div>
    </details>
  );
}

/** Catatan baku yang berlaku untuk semua angka F2-6a. */
export const COMMON_NOTES: ReactNode[] = [
  'Gaji, kasbon, bongkaran (HRIS) dan sewa mobil (Logistik) baru ada di staging; di produksi bagian ini belum berisi data nyata.',
  'Bensin Logistik dan catatan lama "belum diketahui" belum punya Tempat Uang, jadi belum ikut saldo (lihat kotak "Belum masuk saldo").',
  'Belum ada tutup bulan: angka bulan lalu bisa berubah bila ada pembatalan atau koreksi.',
];
