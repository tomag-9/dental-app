import { useMemo, useState } from 'react';
import { X, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { FDI_LOWER, FDI_UPPER, expandFdiRange, fdiLabel } from '../../lib/dentalNotation';

const PROCEDURES = [
    { code: 'KOR-ZIR', short: 'K', label: 'Korunka', color: 'bg-[var(--color-accent-purple-bg)] text-[var(--color-accent-purple-text)] border-[#d8c8f0]' },
    { code: 'MOS-3Z', short: 'M', label: 'Mostík', color: 'bg-[#e0e7ff] text-[#3730a3] border-[#c7d2fe]' },
    { code: 'INL-KER', short: 'V', label: 'Výplň/Inlay', color: 'bg-[var(--color-accent-amber-bg)] text-[var(--color-accent-amber-text)] border-[#f2d38b]' },
    { code: 'IMP-ABU', short: 'I', label: 'Implantát', color: 'bg-[#f3e8ff] text-[#6b21a8] border-[#e9d5ff]' },
    { code: 'PRO-CEL', short: 'P', label: 'Protéza', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' },
    { code: 'EXT-001', short: 'X', label: 'Chýba/extrakcia', color: 'bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled-text)] border-[#f5c0bb]' },
    { code: 'TECH', short: 'T', label: 'Technické', color: 'bg-secondary text-[var(--color-sidebar-text)] border-border' },
];

const procedureByCode = Object.fromEntries(PROCEDURES.map((procedure) => [procedure.code, procedure]));

function normalizeValue(value) {
    const normalized = {};
    Object.entries(value || {}).forEach(([tooth, code]) => {
        expandFdiRange(tooth).forEach((fdi) => {
            normalized[fdi] = code;
        });
    });
    return normalized;
}

function getProcedure(code) {
    return procedureByCode[code] || PROCEDURES.find((procedure) => procedure.short === code) || PROCEDURES[6];
}

function Tooth({ id, code, notation, selected, editable, onClick, ranges }) {
    const procedure = getProcedure(code);
    const isMissing = code === 'EXT-001' || code === 'X';
    const isImplant = code?.startsWith?.('IMP') || code === 'I';
    const isBridge = ranges.some((range) => range.teeth.includes(id));

    return (
        <button
            type="button"
            disabled={!editable}
            onClick={() => onClick(id)}
            className={cn(
                'relative flex h-16 min-w-0 flex-col items-center justify-between rounded-md border bg-white p-1 text-xs transition-all',
                editable && 'cursor-pointer hover:border-primary hover:bg-[#fbfaf6]',
                selected ? 'border-primary shadow-[0_0_0_3px_rgba(13,124,107,.14)]' : 'border-[#ece7dc]',
                isMissing && 'opacity-70'
            )}
            title={`${id} · ${procedure.label}`}
        >
            {isBridge && <span className="absolute left-0 right-0 top-0 h-1 bg-[#4f46e5]" />}
            <span className="font-mono text-[11px] font-bold text-foreground">{fdiLabel(id, notation)}</span>
            <span className={cn('flex h-6 min-w-6 items-center justify-center rounded border px-1 font-bold', code ? procedure.color : 'border-border bg-[#fbfaf6] text-muted-foreground')}>
                {code ? procedure.short : '-'}
            </span>
            <span className="flex h-2 items-center gap-1">
                {isImplant && <span className="h-1.5 w-1.5 rounded-full bg-[#9333ea]" />}
                {isBridge && <span className="h-1.5 w-1.5 rounded-full bg-[#4f46e5]" />}
                {isMissing && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
            </span>
        </button>
    );
}

function NotationToggle({ value, onChange }) {
    return (
        <div className="inline-flex rounded-md bg-secondary p-1">
            {[
                ['fdi', 'FDI'],
                ['palmer', 'Palmer'],
                ['universal', 'Universal'],
            ].map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={cn(
                        'rounded px-2.5 py-1 text-xs font-bold transition-colors',
                        value === key ? 'bg-white text-primary shadow-sm' : 'text-[var(--color-sidebar-text)] hover:text-primary'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export default function ToothMap({ editable = false, value = {}, onChange }) {
    const [notation, setNotation] = useState('fdi');
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempCode, setTempCode] = useState('');
    const normalizedValue = useMemo(() => normalizeValue(value), [value]);
    const ranges = useMemo(() => Object.keys(value || {})
        .map((range) => ({ range, teeth: expandFdiRange(range) }))
        .filter((range) => range.teeth.length > 1), [value]);

    const handleToothClick = (id) => {
        if (!editable) return;
        setSelectedTooth(id);
        setTempCode(normalizedValue[id] || '');
    };

    const handleAssign = () => {
        if (!selectedTooth) return;
        const next = { ...value };
        const containingRange = Object.keys(next).find((range) => expandFdiRange(range).includes(selectedTooth));
        if (containingRange && containingRange !== selectedTooth) delete next[containingRange];
        if (!tempCode) delete next[selectedTooth];
        else next[selectedTooth] = tempCode;
        onChange?.(next);
        setSelectedTooth(null);
        setTempCode('');
    };

    return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[var(--color-card-border)] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <div className="text-sm font-bold text-foreground">Zubný kríž</div>
                    <div className="text-xs text-muted-foreground">Kanonicky ukladáme FDI, zobrazenie môžete prepínať.</div>
                </div>
                <NotationToggle value={notation} onChange={setNotation} />
            </div>

            <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#9333ea]" /> implantát</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4f46e5]" /> mostík</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> chýba/extrakcia</span>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[720px] space-y-3">
                    <div className="grid grid-cols-[1fr_18px_1fr] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        <div className="text-right">Hore · pravá</div>
                        <div />
                        <div>Hore · ľavá</div>
                    </div>
                    <div className="grid grid-cols-[repeat(8,minmax(38px,1fr))_18px_repeat(8,minmax(38px,1fr))] gap-1">
                        {FDI_UPPER.slice(0, 8).map((id) => <Tooth key={id} id={id} code={normalizedValue[id]} notation={notation} selected={selectedTooth === id} editable={editable} onClick={handleToothClick} ranges={ranges} />)}
                        <div />
                        {FDI_UPPER.slice(8).map((id) => <Tooth key={id} id={id} code={normalizedValue[id]} notation={notation} selected={selectedTooth === id} editable={editable} onClick={handleToothClick} ranges={ranges} />)}
                    </div>
                    <div className="h-px bg-[repeating-linear-gradient(to_right,#c8c0b4_0_6px,transparent_6px_12px)]" />
                    <div className="grid grid-cols-[repeat(8,minmax(38px,1fr))_18px_repeat(8,minmax(38px,1fr))] gap-1">
                        {FDI_LOWER.slice(0, 8).map((id) => <Tooth key={id} id={id} code={normalizedValue[id]} notation={notation} selected={selectedTooth === id} editable={editable} onClick={handleToothClick} ranges={ranges} />)}
                        <div />
                        {FDI_LOWER.slice(8).map((id) => <Tooth key={id} id={id} code={normalizedValue[id]} notation={notation} selected={selectedTooth === id} editable={editable} onClick={handleToothClick} ranges={ranges} />)}
                    </div>
                    <div className="grid grid-cols-[1fr_18px_1fr] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        <div className="text-right">Dolu · pravá</div>
                        <div />
                        <div>Dolu · ľavá</div>
                    </div>
                </div>
            </div>

            {editable && selectedTooth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="font-bold text-foreground">Zub {fdiLabel(selectedTooth, notation)}</h3>
                                <p className="text-xs text-muted-foreground">FDI {selectedTooth}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedTooth(null)} className="text-muted-foreground hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {PROCEDURES.map((procedure) => (
                                <button
                                    key={procedure.code}
                                    type="button"
                                    onClick={() => setTempCode(procedure.code)}
                                    className={cn('rounded-md border p-2 text-left text-sm font-semibold transition-all', procedure.color, tempCode === procedure.code && 'ring-2 ring-primary')}
                                >
                                    {procedure.short} · {procedure.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => setTempCode('')} className={cn('rounded-md border border-border p-2 text-left text-sm font-semibold hover:bg-secondary', tempCode === '' && 'ring-2 ring-primary')}>
                                Vyčistiť
                            </button>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedTooth(null)}>Zrušiť</Button>
                            <Button type="button" className="flex-1" onClick={handleAssign}><Check className="h-4 w-4" />Priradiť</Button>
                        </div>
                    </div>
                </div>
            )}

            {!editable && Object.keys(normalizedValue).length > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-[#fbfaf6] p-3 text-xs text-muted-foreground">
                    <Search className="h-4 w-4" />
                    {Object.keys(normalizedValue).length} zubov má priradené úkony.
                </div>
            )}
        </div>
    );
}
