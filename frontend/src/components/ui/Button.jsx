import { cn } from '../../lib/utils';

export function Button({ className, variant = 'primary', size = 'md', ...props }) {
    const variants = {
        primary: 'bg-primary text-primary-foreground hover:bg-[var(--color-primary-light)] shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-[#e7e2d4]',
        outline: 'border border-border bg-white text-foreground hover:bg-[#fbfaf6]',
        ghost: 'text-[var(--color-sidebar-text)] hover:bg-secondary hover:text-primary',
        destructive: 'border border-[#f5c0bb] bg-[#fde8e6] text-destructive hover:bg-destructive hover:text-destructive-foreground',
    };

    const sizes = {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-md text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        />
    );
}
