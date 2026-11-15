import React from 'react';
import { cn } from '@/lib/utils';

interface TierPriceSelectorProps {
  currentTier: string;
  onSelect: (tier: string) => void;
}

export const TierPriceSelector: React.FC<TierPriceSelectorProps> = ({ currentTier, onSelect }) => {
  const tiers = ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'];

  return (
    <div className="flex flex-wrap gap-1">
      {tiers.map((tier) => (
        <button
          key={tier}
          onClick={() => onSelect(tier)}
          className={cn(
            "px-2 py-0.5 text-[9px] font-bold rounded border transition-all",
            currentTier === tier 
              ? "bg-brand-500/20 border-brand-500/40 text-brand-400" 
              : "border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10"
          )}
        >
          {tier}
        </button>
      ))}
    </div>
  );
};
