'use client';

import { Button } from '@/components/ui/button';

export function PrintSlipButton() {
  return <Button onClick={() => window.print()}>Cetak / Simpan PDF</Button>;
}
