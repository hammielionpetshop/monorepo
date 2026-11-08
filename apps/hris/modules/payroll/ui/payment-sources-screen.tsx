import { buttonClass } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/surface';

type Row = {
  id: number; name: string; kindLabel: string; branchName: string | null; accountTail: string | null; heldBy: string; holderNote: string | null;
  methodLabel: string; active: boolean; payable: boolean;
};

/**
 * Pengaturan › Sumber Uang (F2-1b): daftar baca dari Tempat Uang Back Office. HRIS tidak mengubahnya;
 * tambah, ubah, dan nonaktifkan di Back Office supaya satu daftar dipakai semua web.
 */
export function PaymentSourcesScreen({ rows, manageUrl }: { rows: Row[]; manageUrl: string | null }) {
  return (
    <div className="space-y-4">
      <Card className="max-w-2xl space-y-2 text-sm">
        <p>
          Daftar ini sekarang diambil dari <b>Back Office › Pengaturan › Tempat Uang</b>. Untuk menambah, mengubah, atau
          menonaktifkan sumber uang, buka Back Office.
        </p>
        <p className="text-ink-muted">Laci kasir tidak bisa dipilih untuk membayar di HRIS: isinya dihitung oleh shift kasir.</p>
        {manageUrl && <a href={manageUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Atur di Back Office</a>}
      </Card>
      <Card className="text-sm">
        {rows.length === 0 ? (
          <p className="text-ink-muted">Belum ada Tempat Uang. Tambahkan di Back Office.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-ink-muted">{r.kindLabel}{r.accountTail ? ` ••${r.accountTail}` : ''} · {r.methodLabel}</span>
                {r.branchName && <span className="text-ink-muted">· {r.branchName}</span>}
                <span className="text-ink-muted">· dipegang {r.heldBy}{r.holderNote ? ` (${r.holderNote})` : ''}</span>
                {!r.active && <Badge tone="warn">Nonaktif</Badge>}
                {r.active && !r.payable && <Badge>Tidak untuk bayar HRIS</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
