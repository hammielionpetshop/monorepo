import { tierInitial } from '@/lib/tier-initials'

/**
 * Deretan tag inisial kelas harga (mis. [ret] [gro] untuk nota campuran). Tampilan internal,
 * tidak pernah ikut struk/surat jalan. Urutkan tiers dengan `orderTiers` sebelum dioper ke sini.
 */
export function TierTags({ tiers, className = '' }: { tiers: string[]; className?: string }) {
  if (!tiers || tiers.length === 0) return <span className="text-muted-foreground">-</span>
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {tiers.map((t) => (
        <span
          key={t}
          className="rounded bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground"
          title={`Kelas harga: ${t} (tampilan internal)`}
        >
          {tierInitial(t)}
        </span>
      ))}
    </span>
  )
}
