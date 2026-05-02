import { getOfflineBranches } from '@/lib/services/dashboard-service'

function formatLastSeen(isoString: string | null): string {
  if (!isoString) return 'Belum pernah terhubung'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

export default async function OfflineBranchWidget() {
  let data
  try {
    data = await getOfflineBranches()
  } catch (err) {
    console.error('[OfflineBranchWidget] Gagal mengambil data:', err)
    return null
  }

  const offlineBranches = data.filter((b) => b.isOffline)

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Status Operasional Cabang
        </h2>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {offlineBranches.length === 0 ? (
        <div className="group bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex items-center gap-4 transition-all hover:shadow-md hover:shadow-emerald-500/5">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
            <div className="w-3 h-3 rounded-full bg-emerald-500 relative" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              Semua Cabang Terhubung
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
              Seluruh operasional berjalan normal dan tersinkronisasi.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4">Cabang</th>
                  <th className="px-6 py-4">Terakhir Terhubung</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-card-foreground">
                {offlineBranches.map((branch) => (
                  <tr key={branch.branchId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-card-foreground">{branch.branchName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium">
                          {formatLastSeen(branch.lastSeenAt)}
                        </span>
                        {branch.offlineMinutes !== null && (
                          <span className="text-[10px] font-bold text-destructive mt-1 uppercase tracking-tight">
                            Terputus {branch.offlineMinutes} menit
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          !branch.lastSeenAt
                            ? 'bg-muted text-muted-foreground border border-border'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                      >
                        {!branch.lastSeenAt ? 'NEVER CONNECTED' : 'OFFLINE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
