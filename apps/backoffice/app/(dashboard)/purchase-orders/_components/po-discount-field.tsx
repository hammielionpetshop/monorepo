'use client';

import { digitsOnly, formatRupiahInput } from '@/lib/number-input';
import { NewBadge } from '@/components/ui/new-badge';

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

/**
 * Ringkasan Subtotal − Diskon (Rp) = Total untuk form PO. Diskon diketik sebagai angka rupiah atas
 * total PO; persentasenya dibagi rata ke semua barang di server (lib/po-discount.ts).
 */
export function PoDiscountSummary({
  subtotal,
  discount,
  onDiscountChange,
  totalLabel = 'Total',
}: {
  subtotal: number;
  /** Angka mentah (hanya digit), kosong = tanpa diskon. */
  discount: string;
  onDiscountChange: (value: string) => void;
  totalLabel?: string;
}) {
  const discountValue = Number(discount) || 0;
  const tooLarge = discountValue > 0 && discountValue >= subtotal;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {discountValue > 0 && (
        <span className="text-muted-foreground">
          Subtotal: <span className="text-foreground">{rupiah(subtotal)}</span>
        </span>
      )}
      <label className="flex items-center gap-2 text-muted-foreground">
        <span>Diskon (Rp)</span>
        <NewBadge feature="fitur/po-diskon" />
        <input
          type="text"
          inputMode="numeric"
          value={formatRupiahInput(discount)}
          onChange={(e) => onDiscountChange(digitsOnly(e.target.value))}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className={`w-32 border rounded px-2 py-1 text-sm text-right bg-background text-foreground focus:outline-none ${
            tooLarge ? 'border-destructive' : 'border-border'
          }`}
        />
      </label>
      <span>
        <span className="text-muted-foreground">{totalLabel}: </span>
        <span className="font-semibold text-foreground text-base">{rupiah(Math.max(0, subtotal - discountValue))}</span>
      </span>
      {tooLarge && <span className="w-full text-xs text-destructive">Diskon harus lebih kecil dari subtotal.</span>}
    </div>
  );
}
