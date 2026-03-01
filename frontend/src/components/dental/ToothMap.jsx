import { useState } from 'react';
import { cn } from '../../lib/utils';
import { X, Check } from 'lucide-react';
import { Button } from '../ui/Button';

// Dental Procedures Configuration
const PROCEDURES = [
    { code: "I", label: "Implantát", color: "bg-blue-100 border-blue-300" },
    { code: "Č", label: "Čistenie", color: "bg-orange-100 border-orange-300" },
    { code: "J", label: "Extrakcia", color: "bg-red-100 border-red-300" },
    { code: "K", label: "Korunka", color: "bg-purple-100 border-purple-300" },
    { code: "M", label: "Mostík", color: "bg-cyan-100 border-cyan-300" },
    { code: "V", label: "Výplň", color: "bg-yellow-100 border-yellow-300" },
];

const QUADRANTS = {
    Q1: ["18", "17", "16", "15", "14", "13", "12", "11"],
    Q2: ["21", "22", "23", "24", "25", "26", "27", "28"],
    Q4: ["48", "47", "46", "45", "44", "43", "42", "41"],
    Q3: ["31", "32", "33", "34", "35", "36", "37", "38"],
};

const getProcedureData = (code) => {
    const proc = PROCEDURES.find(p => p.code === code);
    return proc || { color: "bg-gray-50 border-transparent", label: "Žiaden zákrok" };
};

const Tooth = ({ id, procedureCode, isSelected, onClick }) => {
    const { color } = getProcedureData(procedureCode);
    const isUpper = id[0] === '1' || id[0] === '2';

    return (
        <div
            className={cn(
                "flex flex-col items-center min-w-[40px] flex-grow cursor-pointer transition-all duration-200 m-0.5",
                isSelected ? "ring-2 ring-primary rounded" : "ring-0"
            )}
            onClick={() => onClick(id)}
        >
            {isUpper && (
                <div className="w-full text-center text-xs font-bold text-gray-600 bg-gray-200 py-0.5 rounded-t">
                    {id}
                </div>
            )}

            <div className={cn(
                "w-full h-12 flex items-center justify-center font-bold text-gray-800 border",
                isUpper ? "rounded-b" : "rounded-t",
                color
            )}>
                {procedureCode}
            </div>

            {!isUpper && (
                <div className="w-full text-center text-xs font-bold text-gray-600 bg-gray-200 py-0.5 rounded-b">
                    {id}
                </div>
            )}
        </div>
    );
};

export default function ToothMap({
    editable = false,
    value = {},
    onChange
}) {
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempCode, setTempCode] = useState("");

    const handleToothClick = (id) => {
        if (!editable) return;
        setSelectedTooth(id);
        setTempCode(value[id] || "");
    };

    const handleAssign = () => {
        if (!selectedTooth) return;

        const newValue = { ...value };
        if (!tempCode) {
            delete newValue[selectedTooth];
        } else {
            newValue[selectedTooth] = tempCode;
        }

        onChange(newValue);
        setSelectedTooth(null);
        setTempCode("");
    };

    return (
        <div className="max-w-3xl mx-auto p-4 border rounded-xl bg-white shadow-sm">
            <div className="flex flex-col gap-2">
                {/* Upper Arch */}
                <div className="flex flex-col md:flex-row gap-4 border-b pb-4">
                    <div className="flex-1 flex flex-row-reverse border-r pr-2 border-dashed border-gray-300">
                        {QUADRANTS.Q1.map(id => (
                            <Tooth key={id} id={id} procedureCode={value[id]} isSelected={selectedTooth === id} onClick={handleToothClick} />
                        ))}
                    </div>
                    <div className="flex-1 flex pl-2">
                        {QUADRANTS.Q2.map(id => (
                            <Tooth key={id} id={id} procedureCode={value[id]} isSelected={selectedTooth === id} onClick={handleToothClick} />
                        ))}
                    </div>
                </div>

                {/* Lower Arch */}
                <div className="flex flex-col md:flex-row gap-4 pt-2">
                    <div className="flex-1 flex flex-row-reverse border-r pr-2 border-dashed border-gray-300">
                        {QUADRANTS.Q4.map(id => (
                            <Tooth key={id} id={id} procedureCode={value[id]} isSelected={selectedTooth === id} onClick={handleToothClick} />
                        ))}
                    </div>
                    <div className="flex-1 flex pl-2">
                        {QUADRANTS.Q3.map(id => (
                            <Tooth key={id} id={id} procedureCode={value[id]} isSelected={selectedTooth === id} onClick={handleToothClick} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Popover / Modal for Selection */}
            {editable && selectedTooth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-xl w-80 p-4 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-semibold">Tooth {selectedTooth}</h3>
                            <button onClick={() => setSelectedTooth(null)} className="text-gray-500 hover:text-gray-700">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {PROCEDURES.map(p => (
                                <button
                                    key={p.code}
                                    onClick={() => setTempCode(p.code)}
                                    className={cn(
                                        "p-2 text-sm font-medium rounded border transition-colors",
                                        tempCode === p.code
                                            ? "ring-2 ring-primary border-transparent"
                                            : "hover:bg-gray-50 border-gray-200",
                                        p.color
                                    )}
                                >
                                    {p.code} - {p.label}
                                </button>
                            ))}
                            <button
                                onClick={() => setTempCode("")}
                                className={cn(
                                    "p-2 text-sm font-medium rounded border border-gray-200 hover:bg-gray-50 text-gray-500",
                                    tempCode === "" && "ring-2 ring-primary border-transparent bg-gray-100"
                                )}
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedTooth(null)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleAssign}>Assign</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
