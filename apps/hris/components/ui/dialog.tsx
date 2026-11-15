'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Dialog konfirmasi/isian berbasis <dialog> bawaan browser (fokus terkunci, Esc menutup).
 * Di HP tampil sebagai lembar dari bawah. Klik di luar kotak sengaja TIDAK menutup (permintaan owner 2026-11-04:
 * isian sering hilang tak sengaja); tutup lewat tombol ×, tombol Batal, atau Esc.
 */
export function Dialog({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-0 mt-auto w-full max-w-lg rounded-t-card bg-surface p-0 backdrop:bg-black/40 sm:m-auto sm:rounded-card"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-m-1 rounded p-1 text-xl leading-none text-ink-muted hover:bg-black/5 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}
