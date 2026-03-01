import { Button } from './Button';

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmText = 'Potvrdiť',
    cancelText = 'Zrušiť',
    onConfirm,
    onCancel,
    destructive = false,
    loading = false,
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
                <h3 className="text-lg font-semibold">{title}</h3>
                {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={loading}
                        className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
