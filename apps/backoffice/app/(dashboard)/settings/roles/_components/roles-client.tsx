'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import type { PermissionItem, RoleItem } from './types'

interface Props {
  roles: RoleItem[]
  permissions: PermissionItem[]
  currentRole: string
}

const GROUPS: { label: string; prefixes: string[] }[] = [
  { label: 'Master Data', prefixes: ['master'] },
  { label: 'Inventori', prefixes: ['inventory', 'stock_opname', 'damaged_goods'] },
  { label: 'Pembelian & Transfer', prefixes: ['po', 'internal_transfer'] },
  { label: 'Transaksi & Keuangan', prefixes: ['transaction', 'void', 'return', 'debt', 'payable', 'cashflow'] },
  { label: 'Sistem', prefixes: ['user', 'branch', 'shift'] },
]

function groupOf(code: string): string {
  const segment = code.split('.')[0]
  return GROUPS.find((g) => g.prefixes.includes(segment))?.label ?? 'Lainnya'
}

function toMatrix(roles: RoleItem[]): Record<number, Set<number>> {
  const result: Record<number, Set<number>> = {}
  for (const role of roles) result[role.id] = new Set(role.permissionIds)
  return result
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export default function RolesClient({ roles, permissions, currentRole }: Props) {
  const [matrix, setMatrix] = useState<Record<number, Set<number>>>(() => toMatrix(roles))
  const [saved, setSaved] = useState<Record<number, Set<number>>>(() => toMatrix(roles))
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 5000)
    return () => clearTimeout(t)
  }, [successMsg])

  const groupedPermissions = useMemo(() => {
    const byGroup = new Map<string, PermissionItem[]>()
    for (const perm of permissions) {
      const label = groupOf(perm.code)
      const list = byGroup.get(label)
      if (list) list.push(perm)
      else byGroup.set(label, [perm])
    }
    const order = [...GROUPS.map((g) => g.label), 'Lainnya']
    return order
      .filter((label) => byGroup.has(label))
      .map((label) => ({ label, items: byGroup.get(label)! }))
  }, [permissions])

  const dirtyRoles = useMemo(
    () => roles.filter((r) => !isLocked(r) && !sameSet(matrix[r.id], saved[r.id])),
    [roles, matrix, saved] // eslint-disable-line react-hooks/exhaustive-deps
  )

  function isLocked(role: RoleItem): boolean {
    return role.name === 'OWNER' || role.name === currentRole
  }

  function toggle(roleId: number, permissionId: number) {
    setMatrix((prev) => {
      const next = new Set(prev[roleId])
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return { ...prev, [roleId]: next }
    })
  }

  function handleReset() {
    setMatrix(toMatrix(roles))
    setSaved(toMatrix(roles))
    setErrorMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    const failed: string[] = []

    for (const role of dirtyRoles) {
      try {
        const res = await fetch(`/api/bo/settings/roles/${role.id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionIds: [...matrix[role.id]] }),
        })
        const data = await res.json()
        if (!res.ok) {
          failed.push(`${role.name}: ${data.error ?? `gagal (${res.status})`}`)
          continue
        }
        const savedSet = new Set(matrix[role.id])
        setSaved((prev) => ({ ...prev, [role.id]: savedSet }))
      } catch {
        failed.push(`${role.name}: kesalahan jaringan`)
      }
    }

    setSaving(false)
    if (failed.length > 0) {
      setErrorMsg(`Gagal menyimpan — ${failed.join('; ')}`)
    } else {
      setSuccessMsg('Permission berhasil disimpan. User terdampak perlu login ulang agar perubahan berlaku.')
    }
  }

  return (
    <div>
      {successMsg && (
        <div role="status" aria-live="polite" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && !successMsg && (
        <div role="alert" aria-live="assertive" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-xs leading-relaxed">
        Perubahan permission baru berlaku setelah user yang bersangkutan <strong>login ulang</strong>,
        karena daftar permission dibekukan ke dalam sesi saat login. Role <strong>OWNER</strong> dan
        role Anda sendiri terkunci dan tidak dapat diubah dari halaman ini.
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[240px]">
                  Permission
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-3 py-3 text-center font-medium text-muted-foreground min-w-[90px]">
                    <div className="inline-flex items-center gap-1">
                      {isLocked(role) && <Lock size={11} aria-label="Terkunci" />}
                      {role.name}
                    </div>
                    <div className="text-[10px] font-normal text-muted-foreground/70 mt-0.5">
                      {role.userCount} user aktif
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedPermissions.map((group) => (
                <GroupRows
                  key={group.label}
                  label={group.label}
                  items={group.items}
                  roles={roles}
                  matrix={matrix}
                  isLocked={isLocked}
                  onToggle={toggle}
                  colCount={roles.length + 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || dirtyRoles.length === 0}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving || dirtyRoles.length === 0}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-input rounded-md hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Batalkan
        </button>
        {dirtyRoles.length > 0 && !saving && (
          <span className="text-xs text-muted-foreground">
            Perubahan belum disimpan: {dirtyRoles.map((r) => r.name).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}

interface GroupRowsProps {
  label: string
  items: PermissionItem[]
  roles: RoleItem[]
  matrix: Record<number, Set<number>>
  isLocked: (role: RoleItem) => boolean
  onToggle: (roleId: number, permissionId: number) => void
  colCount: number
}

function GroupRows({ label, items, roles, matrix, isLocked, onToggle, colCount }: GroupRowsProps) {
  return (
    <>
      <tr className="border-b border-border bg-muted/30">
        <td colSpan={colCount} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </td>
      </tr>
      {items.map((perm) => (
        <tr key={perm.id} className="border-b border-border/50 hover:bg-accent/30">
          <td className="px-4 py-2.5">
            <p className="font-medium text-foreground">{perm.name}</p>
            <p className="text-xs text-muted-foreground">
              <code className="text-[11px]">{perm.code}</code>
              {perm.description ? ` — ${perm.description}` : ''}
            </p>
          </td>
          {roles.map((role) => {
            const locked = isLocked(role)
            const checked = matrix[role.id]?.has(perm.id) ?? false
            return (
              <td key={role.id} className="px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => onToggle(role.id, perm.id)}
                  aria-label={`${perm.name} untuk ${role.name}`}
                  className="h-4 w-4 accent-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
