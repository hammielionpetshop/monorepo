import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'warning'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-400 text-white',
    warning: 'bg-orange-500 hover:bg-orange-400 text-neutral-950',
    info: 'bg-brand-500 hover:bg-brand-400 text-white'
  };

  const iconStyles = {
    danger: 'text-red-500 bg-red-500/10',
    warning: 'text-orange-500 bg-orange-500/10',
    info: 'text-brand-500 bg-brand-500/10'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${variant === 'danger' ? 'text-red-500' : 'text-orange-500'}`} />
            {title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <p className="text-neutral-400 text-sm leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-2xl transition-all border border-white/5"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 font-black py-3.5 rounded-2xl transition-all shadow-lg ${variantStyles[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
