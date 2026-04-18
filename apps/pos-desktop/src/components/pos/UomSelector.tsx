import React from 'react';
import { usePOSStore } from '@/store/pos-store';
import { cn } from '@/lib/utils';

interface UomSelectorProps {
  productId: number;
  currentUomId: number;
  onSelect: (uomId: number, uomCode: string) => void;
}

export const UomSelector: React.FC<UomSelectorProps> = ({ productId, currentUomId, onSelect }) => {
  const { conversions, uoms, products } = usePOSStore();
  
  const product = products.find(p => p.id === productId);
  if (!product) return null;

  const productConversions = conversions.filter(c => c.productId === productId);
  const baseUom = uoms.find(u => u.id === product.baseUomId);

  // Combine base UOM and conversions
  const availableUoms = [
    { id: product.baseUomId, code: baseUom?.code || 'PCS' },
    ...productConversions.map(c => ({ id: c.uomId, code: c.uomCode }))
  ];

  if (availableUoms.length <= 1) {
    return <span className="px-1.5 py-0.5 rounded-md bg-neutral-800 text-[10px] font-bold text-neutral-500 uppercase">{availableUoms[0]?.code}</span>;
  }

  return (
    <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-white/5">
      {availableUoms.map((uom) => (
        <button
          key={uom.id}
          onClick={() => onSelect(uom.id, uom.code)}
          className={cn(
            "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
            currentUomId === uom.id 
              ? "bg-neutral-700 text-white" 
              : "text-neutral-500 hover:text-neutral-300"
          )}
        >
          {uom.code}
        </button>
      ))}
    </div>
  );
};
