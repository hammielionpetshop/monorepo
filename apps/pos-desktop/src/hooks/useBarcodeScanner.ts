import { useEffect, useRef } from 'react';

/**
 * useBarcodeScanner
 * Hook to listen for global keyboard input from a barcode scanner (HID mode).
 * 
 * Logic:
 * - Listens for rapid character input (< 50ms interval).
 * - Collects characters until an 'Enter' key is received.
 * - Triggers a callback with the resulting barcode.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const codeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const diff = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Handle Enter key as suffix (common in barcode scanners)
      if (e.key === 'Enter') {
        if (codeRef.current.length > 2) {
          onScan(codeRef.current);
          codeRef.current = '';
        }
        return;
      }

      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      // If typing is fast enough, it's likely a scanner
      if (diff < 50) {
        codeRef.current += e.key;
      } else {
        // Reset if it's slow manual typing
        codeRef.current = e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
