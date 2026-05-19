import { cn } from '../../lib/utils';

export function Badge({ className, variant = 'default', ...props }) {
    const variants = {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'border-border bg-white text-foreground',
        new: 'border-transparent bg-[var(--color-status-new-bg)] text-[var(--color-status-new-text)]',
        progress: 'border-transparent bg-[var(--color-status-progress-bg)] text-[var(--color-status-progress-text)]',
        done: 'border-transparent bg-[var(--color-status-done-bg)] text-[var(--color-status-done-text)]',
        factured: 'border-transparent bg-[var(--color-status-factured-bg)] text-[var(--color-status-factured-text)]',
        cancelled: 'border-transparent bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled-text)]',
        draft: 'border-transparent bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]',
        issued: 'border-transparent bg-[var(--color-status-issued-bg)] text-[var(--color-status-issued-text)]',
        paid: 'border-transparent bg-[var(--color-status-paid-bg)] text-[var(--color-status-paid-text)]',
    };

    return (
        <div className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant] || variants.default,
            className
        )} {...props} />
    );
}
