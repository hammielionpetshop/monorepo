'use client'

import { useState, useEffect, useRef } from 'react'
import PaymentMethodForm from './payment-method-form'
import { paymentMethodTypeLabel } from './types'
import type { PaymentMethod } from './types'

interface Props {
  paymentMethods: PaymentMethod[]
}

export default function PaymentMethodClient({ paymentMethods: initialMethods }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods)
  const [showForm, setShowForm] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isFormSubmittingRef = useRef(false)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 5000)
    return () => clearTimeout(t)
  }, [errorMsg])

  useEffect(() => {
    if (!showForm && !deletingMethod) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deletingMethod) { setDeletingMethod(null); return }
        closeForm()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm, deletingMethod])

  async function refreshMethods() {
    try {
      const res = await fetch('/api/bo/master-data/payment-methods')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar metode pembayaran')
        return
      }
      const data = await res.json()
      setMethods(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar metode pembayaran')
    }
  }

  function openAddForm() {
    setEditingMethod(null)
    setShowForm(true)
  }

  function openEditForm(method: PaymentMethod) {
    setEditingMethod(method)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingMethod(null)
  }

  async function handleSuccess() {
    setErrorMsg(null)
    setSuccessMsg(editingMethod ? 'Metode pembayaran berhasil diperbarui' : 'Metode pembayaran berhasil ditambahkan')
    closeForm()
    await refreshMethods()
  }

  async function handleDelete() {
    if (!deletingMethod || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/bo/master-data/payment-methods/${deletingMethod.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menghapus metode pembayaran (${res.status})`)
        setDeletingMethod(null)
        return
      }
      setSuccessMsg('Metode pembayaran berhasil dihapus')
      setDeletingMethod(null)
      await refreshMethods()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
      setDeletingMethod(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && !successMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={openAddForm}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Tambah Metode Pembayaran
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipe</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {methods.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada data metode pembayaran
                </td>
              </tr>
            ) : (
              methods.map((method) => (
                <tr key={method.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{method.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      {paymentMethodTypeLabel(method.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditForm(method)}
                      className="text-xs font-medium text-primary hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingMethod(method)}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="pm-dialog-title" className="text-base font-semibold text-foreground">
                {editingMethod ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <PaymentMethodForm
                paymentMethod={editingMethod}
                onSuccess={handleSuccess}
                onCancel={closeForm}
                onSubmittingChange={(v) => { isFormSubmittingRef.current = v }}
              />
            </div>
          </div>
        </div>
      )}

      {deletingMethod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-delete-dialog-title"
          onClick={() => { if (!isDeleting) setDeletingMethod(null) }}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="pm-delete-dialog-title" className="text-base font-semibold text-foreground">
                Hapus Metode Pembayaran
              </h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-foreground">
                Apakah Anda yakin ingin menghapus metode pembayaran{' '}
                <span className="font-medium">{deletingMethod.name}</span>?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Metode pembayaran yang sudah digunakan pada transaksi tidak dapat dihapus.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setDeletingMethod(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
