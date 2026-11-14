'use client';

import { Button } from '@/components/ui/button';

export function PrintButton() {
  return <div className="print:hidden"><Button onClick={() => window.print()}>Cetak</Button></div>;
}
