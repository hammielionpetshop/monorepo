'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import ResetPinDialog from './reset-pin-dialog'
import type { StaffPinItem, PinStatus } from './types'

interface Props {
  staff: StaffPinItem[]
  defaultPin: string
  currentUserId: number
}

function statusOf(item: StaffPinItem): PinStatus {
  if (item.mustChangeCredentials) return 'ONBOARDING'
  if (item.mustChangePin) return 'PERLU_GANTI'
  if (!item.hasPin) return 'BELUM_ADA'
  return 'AKTIF'
}

const STATUS_LABEL: Record<PinStatus, string> = {
  AKTIF: 'Aktif',
  PERLU_GANTI: 'Perlu ganti',
  BELUM_ADA: 'Belum ada',
  ONBOARDING: 'Menunggu onboarding',
}

const STATUS_CLASS: Record<PinStatus, string> = {
  AKTIF: 'bg-green-100 text-green-800',
  PERLU_GANTI: 'bg-amber-100 text-amber-800',
  BELUM_ADA: 'bg-muted text-muted-foreground',
  ONBOARDING: 'bg-blue-100 text-blue-800',
}

function formatDate(value: Date | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function StaffPinClient({ staff, defaultPin, currentUserId }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<StaffPinItem | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // PIN hasil reset ditahan di layar sampai ditutup manual — OWNER perlu membacanya
  // untuk disampaikan ke staf, jadi jangan hilang sendiri seperti toast biasa.
  const [resetResult, setResetResult] = useState<{ name: string; pin: string } | null>(null)

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 5000)
    return () => clearTimeout(t)
  }, [errorMsg])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staff
    return staff.filter((s) =>
      [s.name, s.username, s.staffNumber, s.roleName, s.branchName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [staff, search])

  const columns: ColumnDef<StaffPinItem>[] = [
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => <span className="text-foreground">{row.original.username ?? '-'}</span>,
    },
    {
      accessorKey: 'staffNumber',
      header: 'Nomor Staf',
      cell: ({ row }) => <span className="text-foreground">{row.original.staffNumber ?? '-'}</span>,
    },
    {
      accessorKey: 'roleName',
      header: 'Role',
      cell: ({ row }) => <span className="text-foreground">{row.original.roleName}</span>,
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-foreground">{row.original.branchName}</span>,
    },
    {
      id: 'status',
      header: 'Status PIN',
      cell: ({ row }) => {
        const status = statusOf(row.original)
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        )
      },
    },
    {
      id: 'pinSetAt',
      header: 'PIN Diubah',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.pinSetAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId
        return (
          <div className="text-right">
            {isSelf ? (
              <a href="/change-pin" className="text-xs font-medium text-primary hover:underline">
                Ganti PIN saya
              </a>
            ) : (
              <button
                onClick={() => {
                  setErrorMsg(null)
                  setTarget(row.original)
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reset PIN
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      {resetResult && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 bg-green-50 border border-green-200 text-green-900 px-4 py-3 rounded-md text-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">PIN {resetResult.name} berhasil di-reset.</p>
              <p className="mt-1">
                PIN sementara:{' '}
                <span className="font-mono font-bold tracking-[0.2em]">{resetResult.pin}</span>
              </p>
              <p className="mt-1 text-xs text-green-800">
                Sampaikan ke yang bersangkutan. Sistem akan meminta dia membuat PIN sendiri saat
                login berikutnya.
              </p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="text-xs font-medium text-green-800 hover:underline shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-xs leading-relaxed">
        Reset di sini hanya mengubah PIN — password staf tetap seperti semula. Untuk mengembalikan
        password sekaligus PIN ke default, pakai tombol reset kredensial di Pengaturan › Pengguna.
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada staf yang cocok"
        toolbar={
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, username, nomor staf..."
            className="w-full max-w-xs px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        }
      />

      {target && (
        <ResetPinDialog
          staff={target}
          defaultPin={defaultPin}
          onClose={() => setTarget(null)}
          onError={(message) => {
            setTarget(null)
            setResetResult(null)
            setErrorMsg(message)
          }}
          onSuccess={(pin) => {
            setResetResult({ name: target.name, pin })
            setTarget(null)
            setErrorMsg(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
