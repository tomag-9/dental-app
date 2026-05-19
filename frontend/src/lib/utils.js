import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function normalizeListResponse(responseData) {
    if (Array.isArray(responseData)) return responseData;
    if (Array.isArray(responseData?.results)) return responseData.results;
    return [];
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeCsvCell(value) {
    const text = String(value ?? '');
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
}

export function getApiErrorMessage(error, fallbackMessage) {
    const payload = error?.response?.data;
    if (typeof payload?.detail === 'string') return payload.detail;
    if (payload && typeof payload === 'object') {
        return Object.entries(payload)
            .map(([field, value]) => {
                const text = Array.isArray(value) ? value.join(', ') : String(value);
                return `${field}: ${text}`;
            })
            .join(' | ');
    }
    return fallbackMessage;
}
