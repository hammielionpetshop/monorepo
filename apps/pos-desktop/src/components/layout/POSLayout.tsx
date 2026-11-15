import React from 'react';
import { POSHeader } from './POSHeader';

interface POSLayoutProps {
  children: React.ReactNode;
}

export const POSLayout: React.FC<POSLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <POSHeader />
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};
