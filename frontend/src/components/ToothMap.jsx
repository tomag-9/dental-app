import React, { useState } from "react";
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';
function cn(...inputs) { return twMerge(clsx(inputs)); }
const QUADRANTS = {
  Q1: ["18", "17", "16", "15", "14", "13", "12", "11"], Q2: ["21", "22", "23", "24", "25", "26", "27", "28"],
  Q4: ["48", "47", "46", "45", "44", "43", "42", "41"], Q3: ["31", "32", "33", "34", "35", "36", "37", "38"],
};
export default function ToothMap({ editable, value = {}, onChange }) {
  const [selected, setSelected] = useState(null);
  const handle = (code) => {
    const n = { ...value }; if (code) n[selected] = code; else delete n[selected];
    onChange?.(n); setSelected(null);
  };
  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-4xl mx-auto">
      <div className="grid grid-cols-2 gap-8 pb-4">
        <div className="flex gap-1 justify-end">{QUADRANTS.Q1.map(id => <button key={id} onClick={() => editable && setSelected(id)} className={cn("w-10 h-10 rounded border font-bold text-xs", value[id] ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-400")}>{id}</button>)}</div>
        <div className="flex gap-1">{QUADRANTS.Q2.map(id => <button key={id} onClick={() => editable && setSelected(id)} className={cn("w-10 h-10 rounded border font-bold text-xs", value[id] ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-400")}>{id}</button>)}</div>
      </div>
      <div className="h-px bg-gray-200 w-full mb-4" />
      <div className="grid grid-cols-2 gap-8">
        <div className="flex gap-1 justify-end">{QUADRANTS.Q4.map(id => <button key={id} onClick={() => editable && setSelected(id)} className={cn("w-10 h-10 rounded border font-bold text-xs", value[id] ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-400")}>{id}</button>)}</div>
        <div className="flex gap-1">{QUADRANTS.Q3.map(id => <button key={id} onClick={() => editable && setSelected(id)} className={cn("w-10 h-10 rounded border font-bold text-xs", value[id] ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-400")}>{id}</button>)}</div>
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} /><div className="relative bg-white p-8 rounded-3xl shadow-2xl space-y-4"><h3>Zub {selected}</h3><div className="flex gap-2"><button onClick={() => handle('I')} className="p-2 bg-blue-50 border rounded font-bold">Implantát</button><button onClick={() => handle('K')} className="p-2 bg-purple-50 border rounded font-bold">Korunka</button><button onClick={() => handle(null)} className="p-2 bg-red-50 text-red-600 font-bold">Zrušiť</button></div></div></div>}
    </div>
  );
}
