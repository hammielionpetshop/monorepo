'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

// Lama jeda dibaca server dari pengaturan "Jeda tombol konfirmasi berakibat" (BER §8, spec L2e §3.3)
// dan diberikan kerangka aplikasi lewat penyedia ini. 3 detik hanya cadangan bila penyedia tidak ada.
const HoldSecondsContext = createContext(3);

export function HoldSecondsProvider({ seconds, children }: { seconds: number; children: ReactNode }) {
  return <HoldSecondsContext.Provider value={seconds}>{children}</HoldSecondsContext.Provider>;
}

export function useHoldSeconds(): number {
  return useContext(HoldSecondsContext);
}

/** Tombol simpan yang ditahan beberapa detik untuk tindakan berakibat (TAM-15). Hitungan mulai saat tampil. */
export function HoldButton({ children, ...rest }: ButtonProps) {
  const seconds = useHoldSeconds();
  const [countdown, setCountdown] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Button {...rest} disabled={rest.disabled || countdown > 0}>
      {countdown > 0 ? <>{children} ({countdown})</> : children}
    </Button>
  );
}
