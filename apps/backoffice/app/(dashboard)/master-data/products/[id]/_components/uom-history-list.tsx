import { formatWIB } from '@petshop/shared'

export interface UomHistoryEntry {
  id: number
  createdAt: string
  userName: string | null
  description: string
}

export default function UomHistoryList({ entries }: { entries: UomHistoryEntry[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Jejak perubahan satuan produk ini: tambah, ubah isi/berat, hapus satuan, ganti satuan dasar, dan perubahan
        nama/kode di master Satuan Ukur. Perubahan sebelum 19 Nov 2026 tidak tercatat, kecuali ganti satuan dasar
        (tercatat sejak 2 Nov 2026).
      </p>
      {entries.length === 0 ? (
        <div className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada perubahan satuan yang tercatat.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-44">Waktu</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-40">Oleh</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatWIB(e.createdAt, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-xs text-foreground">{e.userName ?? 'Sistem'}</td>
                  <td className="px-3 py-2 text-xs text-foreground">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
