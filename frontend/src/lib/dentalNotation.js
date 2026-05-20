export const FDI_UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
export const FDI_LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
export const FDI_ALL = [...FDI_UPPER, ...FDI_LOWER];

const universalOrder = [
    '18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28',
    '38', '37', '36', '35', '34', '33', '32', '31', '41', '42', '43', '44', '45', '46', '47', '48',
];

export const FDI_TO_UNIVERSAL = Object.fromEntries(universalOrder.map((fdi, index) => [fdi, String(index + 1)]));
export const UNIVERSAL_TO_FDI = Object.fromEntries(universalOrder.map((fdi, index) => [String(index + 1), fdi]));

const PALMER_BRACKET = { 1: '\u2518', 2: '\u2514', 3: '\u250C', 4: '\u2510' };

export function isValidFdi(value) {
    return FDI_ALL.includes(String(value));
}

export function fdiToPalmer(value) {
    const fdi = String(value);
    const quadrant = fdi[0];
    const position = fdi[1];
    if (quadrant === '1') return `${position}${PALMER_BRACKET[1]}`;
    if (quadrant === '2') return `${PALMER_BRACKET[2]}${position}`;
    if (quadrant === '3') return `${PALMER_BRACKET[3]}${position}`;
    if (quadrant === '4') return `${position}${PALMER_BRACKET[4]}`;
    return fdi;
}

export function fdiLabel(value, notation = 'fdi') {
    const fdi = String(value);
    if (notation === 'universal') return FDI_TO_UNIVERSAL[fdi] || fdi;
    if (notation === 'palmer') return fdiToPalmer(fdi);
    return fdi;
}

export function normalizeToFdi(value, notation = 'fdi') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (notation === 'universal') return UNIVERSAL_TO_FDI[raw] || '';
    return isValidFdi(raw) ? raw : '';
}

export function expandFdiRange(value) {
    const raw = String(value || '').trim().replace(/\s+/g, '').replace(/[–—]/g, '-');
    if (!raw) return [];
    if (!raw.includes('-')) return isValidFdi(raw) ? [raw] : [];

    const [from, to] = raw.split('-');
    const arch = FDI_UPPER.includes(from) && FDI_UPPER.includes(to) ? FDI_UPPER : FDI_LOWER.includes(from) && FDI_LOWER.includes(to) ? FDI_LOWER : null;
    if (!arch) return [];
    const start = arch.indexOf(from);
    const end = arch.indexOf(to);
    if (start === -1 || end === -1) return [];
    const [min, max] = start < end ? [start, end] : [end, start];
    return arch.slice(min, max + 1);
}

export function parseQuickEntry(value) {
    const parts = String(value || '').trim().split(/\s+/);
    if (parts.length < 2) return null;
    const [tooth, code, quantity] = parts;
    const normalizedTooth = tooth.replace(/[–—]/g, '-');
    if (!expandFdiRange(normalizedTooth).length) return null;
    return {
        tooth: normalizedTooth,
        price_list_code: code.toUpperCase(),
        quantity: Math.max(1, Number(quantity) || 1),
    };
}
