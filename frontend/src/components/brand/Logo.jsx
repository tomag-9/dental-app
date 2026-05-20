export function LogoMark({ size = 22, color = 'var(--color-primary)' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Molaris"
            role="img"
            className="block shrink-0"
        >
            <rect x="22" y="22" width="56" height="56" rx="14" fill="none" stroke={color} strokeWidth="2" opacity="0.18" />
            <circle cx="32" cy="32" r="11" fill={color} />
            <circle cx="68" cy="32" r="11" fill={color} />
            <circle cx="32" cy="68" r="11" fill={color} />
            <circle cx="68" cy="68" r="11" fill={color} />
        </svg>
    );
}

export function Logo({
    markSize = 22,
    wordmarkSize = 16,
    color = 'var(--color-primary)',
    textColor = 'var(--color-foreground)',
    gap = 9,
}) {
    return (
        <span className="inline-flex items-center" style={{ gap }}>
            <LogoMark size={markSize} color={color} />
            <span
                className="font-bold leading-none"
                style={{
                    color: textColor,
                    fontFamily: 'var(--font-heading)',
                    fontSize: wordmarkSize,
                    letterSpacing: '-0.02em',
                }}
            >
                Molaris
            </span>
        </span>
    );
}

export function LogoInverse({ markSize = 22, wordmarkSize = 16, gap = 9 }) {
    return (
        <Logo
            markSize={markSize}
            wordmarkSize={wordmarkSize}
            gap={gap}
            color="var(--color-background)"
            textColor="var(--color-background)"
        />
    );
}

export function LogoBadge({ size = 52, radius = 14, bg = 'var(--color-primary)', markColor = '#ffffff' }) {
    return (
        <span
            aria-label="Molaris"
            className="inline-flex shrink-0 items-center justify-center"
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                background: bg,
            }}
        >
            <LogoMark size={Math.round(size * 0.62)} color={markColor} />
        </span>
    );
}
