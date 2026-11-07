import { NewBadge } from '@/components/ui/new-badge';
import { Badge } from '@/components/ui/surface';
import { rupiah } from '../rules/rates';
import type { KasirSeen } from '../server/store-payments';

/** Tanda pemeriksa kasir (B1+B2): nilai retur dari kasir, atau potong nota sudah terlihat di nominal nota. */
export function KasirSeenBadge({ kasir }: { kasir: KasirSeen | null }) {
  if (!kasir) return null;
  if (kasir.kind === 'RETURN') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-xs">
        {!kasir.found ? <Badge tone="warn">⚠️ Retur {kasir.number} tidak terbaca di kasir</Badge>
          : kasir.cancelled ? <Badge tone="danger">⚠️ Retur {kasir.number} dibatalkan di kasir</Badge>
            : <Badge tone="ok">✅ Retur {kasir.number} · {rupiah(kasir.amount ?? 0)}</Badge>}
        <NewBadge feature="fitur/pemeriksa-kasir" />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      {kasir.seen ? <Badge tone="ok">✅ Terlihat di kasir</Badge>
        : <Badge tone="warn">⚠️ Belum terlihat di kasir{kasir.current != null ? ` (nota ${rupiah(kasir.current)}, harusnya ≤ ${rupiah(kasir.expected)})` : ''}</Badge>}
      <NewBadge feature="fitur/pemeriksa-kasir" />
    </span>
  );
}
