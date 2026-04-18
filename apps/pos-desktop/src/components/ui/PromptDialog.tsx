import React, { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  initialValue?: string;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = 'Masukkan nilai...',
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  initialValue = ''
}) => {
  const [value, setValue] = useState(initialValue || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-500" />
            {title}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <p className="text-neutral-400 text-sm leading-relaxed px-1">
              {message}
            </p>
            <input 
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-black border border-white/10 focus:border-brand-500 rounded-2xl py-4 px-5 text-white outline-none transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onConfirm(value);
                  onClose();
                }
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-2xl transition-all border border-white/5"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm(value);
                onClose();
              }}
              className="flex-1 bg-brand-500 hover:bg-brand-400 text-neutral-950 font-black py-3.5 rounded-2xl transition-all shadow-lg"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
