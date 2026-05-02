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
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Status Operasional Cabang
        </h2>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {offlineBranches.length === 0 ? (
        <div className="group bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 flex items-center gap-4 transition-all hover:shadow-md hover:shadow-emerald-100/50">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
            <div className="w-3 h-3 rounded-full bg-emerald-500 relative" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Semua Cabang Terhubung
            </p>
            <p className="text-xs text-emerald-600/80 mt-0.5">
              Seluruh operasional berjalan normal dan tersinkronisasi.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Cabang</th>
                  <th className="px-6 py-4">Terakhir Terhubung</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-900">
                {offlineBranches.map((branch) => (
                  <tr key={branch.branchId} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">{branch.branchName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-600">
                          {formatLastSeen(branch.lastSeenAt)}
                        </span>
                        {branch.offlineMinutes !== null && (
                          <span className="text-[10px] font-medium text-red-500 mt-0.5 uppercase tracking-tight">
                            Terputus {branch.offlineMinutes} menit
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          !branch.lastSeenAt
                            ? 'bg-gray-100 text-gray-600 border border-gray-200'
                            : 'bg-red-50 text-red-700 border border-red-100'
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
