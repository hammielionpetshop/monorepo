'use client'

import { useState } from 'react'
import UomConversionClient from './uom-conversion-client'
import PriceTierClient from './price-tier-client'

type ActiveTab = 'satuan' | 'harga'

interface UomConversion {
  id: number
  uomId: number | null
  uomCode: string | null
  uomName: string | null
  ratio: number | null
  weightGram: number | null
}

interface UomOption {
  id: number
  code: string
  name: string
}

interface BranchOption {
  id: number
  code: string
  name: string
}

interface UomForPricing {
  id: number
  code: string
  name: string
  isBase: boolean
  ratio: number
}

interface Props {
  productId: number
  initialConversions: UomConversion[]
  availableUoms: UomOption[]
  baseUomId: number
  branches: BranchOption[]
  uomsForPricing: UomForPricing[]
}

export default function ProductDetailTabs({
  productId,
  initialConversions,
  availableUoms,
  baseUomId,
  branches,
  uomsForPricing,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('satuan')

  const tabClass = (tab: ActiveTab) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'text-primary border-b-2 border-primary'
        : 'text-muted-foreground hover:text-foreground'
    }`

  return (
    <>
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0">
          <button onClick={() => setActiveTab('satuan')} className={tabClass('satuan')}>
            Satuan
          </button>
          <button onClick={() => setActiveTab('harga')} className={tabClass('harga')}>
            Harga
          </button>
        </nav>
      </div>

      {activeTab === 'satuan' && (
        <UomConversionClient
          productId={productId}
          initialConversions={initialConversions}
          availableUoms={availableUoms}
          baseUomId={baseUomId}
        />
      )}
      {activeTab === 'harga' && (
        <PriceTierClient
          productId={productId}
          branches={branches}
          uomsForPricing={uomsForPricing}
        />
      )}
    </>
  )
}