import React, { useState } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
import { ProductSearch } from '@/components/pos/ProductSearch';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { usePOSStore } from '@/store/pos-store';
import { useCartStore } from '@/store/cart-store';
import { apiClient } from '@/lib/api-client';
import { PinChallengeDialog } from '@/components/pos/PinChallengeDialog';
import { OwnerOverrideDialog } from '@/components/pos/OwnerOverrideDialog';

export default function POS() {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  console.log("POS PAGE");
  
  
  const { 
    isInitialized, 
    showPinChallenge, setShowPinChallenge,
    showOverrideDialog, setShowOverrideDialog,
    activeOverrideItem, setOverrideItem,
    prices
  } = usePOSStore();
  
  const { addItem, updateItem, items } = useCartStore();

  const overrideCartItem = activeOverrideItem 
    ? items.find(i => i.productId === activeOverrideItem.productId && i.uomId === activeOverrideItem.uomId) || null 
    : null;
    
  const overrideRetailPriceStr = activeOverrideItem
    ? prices.find((p: any) => p.productId === activeOverrideItem.productId && p.uomId === activeOverrideItem.uomId && p.tierType === 'RETAIL')?.price
    : '0';
  const overrideRetailPrice = parseFloat(overrideRetailPriceStr || '0');

  // Initialize data
  useBootstrap();

  // Handle Barcode Scan
  useBarcodeScanner(async (barcode) => {
    console.log('[POS] Scanned Barcode:', barcode);
    try {
      const results = await apiClient(`/products?q=${barcode}&limit=1`);
      if (results.length > 0) {
        const product = results[0];
        const store = usePOSStore.getState();
        const foundPrice = store.prices.find(p => p.productId === product.id && p.uomId === product.baseUomId && p.tierType === 'RETAIL');
        const unitPrice = foundPrice ? parseFloat(foundPrice.price) : 0;
        const uom = store.uoms.find(u => u.id === product.baseUomId);

        addItem({
          productId: product.id,
          productName: product.name,
          uomId: product.baseUomId,
          uomCode: uom?.code || 'PCS',
          qty: 1,
          unitPrice, 
          priceTier: 'RETAIL',
          discountAmount: 0,
          subtotal: unitPrice,
          isOwnerOverride: false,
        });
      }
    } catch (err) {
      console.error('Barcode lookup failed:', err);
    }
  });

  const handleSearch = async (query: string, categoryId: number | null) => {
    setIsSearching(true);
    try {
      let url = `/products?q=${query}&limit=20`;
      if (categoryId) url += `&categoryId=${categoryId}`;
      const results = await apiClient(url);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <POSLayout>
      <div className="flex h-full w-full overflow-hidden">
        {/* Main Content: Search + Results */}
        <div className="flex-1 flex flex-col p-6 min-w-0">
          <ProductSearch onSearch={handleSearch} />
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {!isInitialized && !isSearching ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
              </div>
            ) : (
              <ProductGrid products={searchResults} isLoading={isSearching} />
            )}
          </div>
        </div>

        {/* Right Sidebar: Cart */}
        <CartPanel />
      </div>

      <PinChallengeDialog 
        isOpen={showPinChallenge}
        onClose={() => {
          setShowPinChallenge(false);
          setOverrideItem(null);
        }}
        onSuccess={() => {
          setShowPinChallenge(false);
          setShowOverrideDialog(true);
        }}
      />

      <OwnerOverrideDialog
        isOpen={showOverrideDialog}
        onClose={() => {
          setShowOverrideDialog(false);
          setOverrideItem(null);
        }}
        item={overrideCartItem}
        retailPrice={overrideRetailPrice}
      />
    </POSLayout>
  );
}
