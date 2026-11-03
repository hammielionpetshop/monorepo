import { Card } from '@/components/ui/surface';

type Kind = { code: string; name: string; unit: string; source: string; module: string; track: string };

/** Jenis Upah (DRV-L01, U1): baca saja. */
export function WageKindsScreen({ kinds }: { kinds: Kind[] }) {
  return (
    <div className="space-y-3">
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-ink-muted">
            <th className="py-1 pr-3 font-medium">Jenis</th><th className="py-1 pr-3 font-medium">Dihitung per</th><th className="py-1 pr-3 font-medium">Dasar angka</th>
            <th className="py-1 pr-3 font-medium">Dicatat oleh</th><th className="py-1 font-medium">Jalur bayar</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {kinds.map((k) => (
              <tr key={k.code}>
                <td className="py-1.5 pr-3 font-medium">{k.name}</td><td className="py-1.5 pr-3">{k.unit}</td><td className="py-1.5 pr-3">{k.source}</td>
                <td className="py-1.5 pr-3">{k.module}</td><td className="py-1.5">{k.track}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-sm text-ink-muted">Jenis upah baru ditambah lewat pembangunan sistem, bukan dari layar ini. Tidak ada baris upah yang diketik bebas: setiap upah lahir dari modul pencatatnya.</p>
    </div>
  );
}
