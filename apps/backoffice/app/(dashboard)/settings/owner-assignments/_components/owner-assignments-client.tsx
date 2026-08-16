'use client'

import { useEffect, useState } from 'react'
import type { BranchOwnerRow, EligibleOwner } from './types'

interface Props {
  branches: BranchOwnerRow[]
  eligibleOwners: EligibleOwner[]
}

// Value untuk opsi "tidak diassign".
const NONE_VALUE = ''

export default function OwnerAssignmentsClient({ branches, eligibleOwners }: Props) {
  const [rows, setRows] = useState<BranchOwnerRow[]>(branches)
  // Nilai select per-cabang (userId string atau NONE_VALUE).
  const [drafts, setDrafts] = useState<Record<number, string>>(
    Object.fromEntries(branches.map((b) => [b.id, b.currentOwner ? String(b.currentOwner.id) : NONE_VALUE]))
  )
  const [savingId, setSavingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(null), 3000)
    return () => window.clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!errorMsg) return
    const t = window.setTimeout(() => setErrorMsg(null), 5000)
    return () => window.clearTimeout(t)
  }, [errorMsg])

  function isDirty(branch: BranchOwnerRow): boolean {
    const draft = drafts[branch.id] ?? NONE_VALUE
    const current = branch.currentOwner ? String(branch.currentOwner.id) : NONE_VALUE
    return draft !== current
  }

  async function handleSave(branch: BranchOwnerRow) {
    if (savingId !== null) return
    const draft = drafts[branch.id] ?? NONE_VALUE
    const userId = draft === NONE_VALUE ? null : Number(draft)

    setSavingId(branch.id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/bo/settings/owner-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id, userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }

      const nextOwner =
        userId === null
          ? null
          : (() => {
              const found = eligibleOwners.find((o) => o.id === userId)
              return found ? { id: found.id, name: found.name, username: found.username } : null
            })()

      setRows((prev) =>
        prev.map((r) => (r.id === branch.id ? { ...r, currentOwner: nextOwner } : r))
      )
      setSuccessMsg(
        userId === null
          ? `Owner untuk cabang ${branch.name} dihapus`
          : `Owner cabang ${branch.name} disimpan`
      )
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-md text-sm dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200"
        >
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      {eligibleOwners.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 rounded-md text-sm dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">
          Belum ada pengguna dengan role OWNER dan PIN aktif. Buat owner + set PIN-nya
          terlebih dahulu di halaman Pengguna.
        </div>
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Cabang</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium w-32" />
            </tr>
          </thead>
          <tbody>
            {rows.map((branch) => {
              const draft = drafts[branch.id] ?? NONE_VALUE
              const dirty = isDirty(branch)
              const saving = savingId === branch.id
              return (
                <tr key={branch.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{branch.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {branch.code}
                      {!branch.isActive && (
                        <span className="ml-2 text-destructive">(nonaktif)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [branch.id]: e.target.value }))
                      }
                      disabled={saving}
                      className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    >
                      <option value={NONE_VALUE}>— Tidak diassign —</option>
                      {eligibleOwners.map((o) => (
                        <option key={o.id} value={String(o.id)}>
                          {o.name}
                          {o.username ? ` (${o.username})` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSave(branch)}
                      disabled={!dirty || saving}
                      className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Belum ada cabang.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
