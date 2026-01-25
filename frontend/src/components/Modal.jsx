import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-2xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative bg-white rounded-[2rem] shadow-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-gray-100", maxWidth)}>
        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </div>
    </div>
  );
}
