import { ReturnTypeChooser } from '@/components/supplier-returns/return-type-chooser'

export default function ReturPilihanPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Retur Barang</h1>
        <p className="text-sm text-muted-foreground mt-1">Barang ini mau dikembalikan ke mana? Pilih salah satu.</p>
      </div>
      <ReturnTypeChooser supplierHref="/purchase-orders/supplier-returns" internalHref="/purchase-orders/internal-returns" />
    </div>
  )
}
