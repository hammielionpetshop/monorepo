'use client'

import { useState } from 'react'

interface LogoutButtonProps {
  logoutAction: () => Promise<void>;
}

export default function LogoutButton({ logoutAction }: LogoutButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleLogout = async () => {
    setIsPending(true)
    try {
      await logoutAction()
    } catch (err) {
      console.error(err)
      setIsPending(false)
      setIsOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-[44px] min-w-[44px] px-5 py-2 text-sm font-semibold text-muted-foreground border border-border rounded-xl hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all cursor-pointer"
      >
        Keluar
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => !isPending && setIsOpen(false)}
          />
          
          {/* Modal Card */}
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground">Konfirmasi Keluar</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Apakah Anda yakin ingin keluar dari sistem POS? Sesi aktif Anda akan diakhiri.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="flex-1 min-h-[44px] px-4 py-2 text-sm font-semibold text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleLogout}
                className="flex-1 min-h-[44px] px-4 py-2 text-sm font-semibold text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Ya, Keluar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
