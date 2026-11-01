import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/surface';
import { REQUEST_STATUSES, STATUS_LABELS } from '../rules/status';
import type { RequestCard } from '../server/queries';
import { RequestCardLink } from './shared';

type Data = {
  cards: RequestCard[];
  types: { key: string; label: string }[];
  filter: { status: string; type: string };
};

/** BER-L04 Pengajuan Saya: kartu terbaru di atas, saring status & jenis, tombol besar Ajukan. */
export function MyRequestsScreen({ data }: { data: Data }) {
  const filtered = !!(data.filter.status || data.filter.type);
  return (
    <div className="space-y-4">
      <Link
        href="/pengajuan/baru"
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700"
      >
        Ajukan
      </Link>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Status</span>
          <Select name="status" defaultValue={data.filter.status}>
            <option value="">Semua status</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
        </label>
        {data.types.length > 1 && (
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Jenis</span>
            <Select name="type" defaultValue={data.filter.type}>
              <option value="">Semua jenis</option>
              {data.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </label>
        )}
        <Button type="submit" size="sm" variant="secondary">Saring</Button>
        {filtered && <Link href="/pengajuan" className="text-sm text-brand-700">Hapus saringan</Link>}
      </form>
      {data.cards.length === 0 ? (
        <EmptyState title={filtered ? 'Tidak ada pengajuan yang cocok' : 'Belum ada pengajuan'}>
          {filtered ? 'Coba ubah saringan.' : 'Tekan Ajukan untuk membuat pengajuan baru.'}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {data.cards.map((card) => <RequestCardLink key={card.id} card={card} href={`/pengajuan/${card.id}`} mode="mine" />)}
        </div>
      )}
    </div>
  );
}

/** BER-L05 Ajukan: pilih jenis. Jenis berhak tetapi syaratnya belum terpenuhi tampil redup dengan alasannya. */
export function ChooseTypeScreen({ types }: {
  types: { key: string; label: string; description: string; deadline: string; blockedReason: string | null; formHref: string | null }[];
}) {
  if (!types.length) {
    return <EmptyState title="Belum ada jenis pengajuan untuk Anda">Hubungi HR bila Anda perlu mengajukan sesuatu.</EmptyState>;
  }
  return (
    <div className="space-y-3">
      {types.map((type) => type.blockedReason ? (
        <div key={type.key} className="rounded-card border border-line bg-surface p-4 opacity-60" aria-disabled>
          <p className="font-semibold">{type.label}</p>
          <p className="text-sm">{type.blockedReason}</p>
          <p className="mt-1 text-xs text-ink-muted">{type.deadline}</p>
        </div>
      ) : (
        <Link key={type.key} href={type.formHref ?? `/pengajuan/baru/${type.key}`} className="block rounded-card border border-line bg-surface p-4 hover:bg-canvas">
          <p className="font-semibold">{type.label}</p>
          <p className="text-sm text-ink-muted">{type.description}</p>
          <p className="mt-1 text-xs text-ink-muted">{type.deadline}</p>
        </Link>
      ))}
      <Link href="/pengajuan" className="inline-block text-sm text-brand-700">← Kembali ke Pengajuan Saya</Link>
    </div>
  );
}
