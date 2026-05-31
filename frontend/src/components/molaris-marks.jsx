// ─────────────────────────────────────────────────────────────
// Molaris — logo mark variations
// All marks render at any size via props { size, color }.
// Concept: latin "dens molaris" — molar tooth with 4 cusps + 2 roots.
// ─────────────────────────────────────────────────────────────

// MA — Quattro cusps (signature). 4 circles in a 2×2 grid = chewing surface.
function MarkA({ size = 140, color = '#0d7c6b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="22" y="22" width="56" height="56" rx="14" fill="none" stroke={color} strokeWidth="2" opacity="0.18"/>
      <circle cx="32" cy="32" r="11" fill={color}/>
      <circle cx="68" cy="32" r="11" fill={color}/>
      <circle cx="32" cy="68" r="11" fill={color}/>
      <circle cx="68" cy="68" r="11" fill={color}/>
    </svg>
  );
}

// MB — Cusp M monogram. Custom M with rounded peaks (cusps) and straight legs (roots).
function MarkB({ size = 140, color = '#0d7c6b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path
        d="M 18 82 L 18 32 Q 18 22 28 22 Q 38 22 38 32 L 38 50 Q 38 56 44 56 L 56 56 Q 62 56 62 50 L 62 32 Q 62 22 72 22 Q 82 22 82 32 L 82 82"
        stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

// MC — Occlusal grid. Rounded square divided by a thin cross into 4 quadrants.
// References the central fissure pattern of a real molar viewed from above.
function MarkC({ size = 140, color = '#0d7c6b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect x="16" y="16" width="68" height="68" rx="16" stroke={color} strokeWidth="6"/>
      <line x1="50" y1="22" x2="50" y2="78" stroke={color} strokeWidth="3" opacity="0.35"/>
      <line x1="22" y1="50" x2="78" y2="50" stroke={color} strokeWidth="3" opacity="0.35"/>
      <circle cx="34" cy="34" r="4.5" fill={color}/>
      <circle cx="66" cy="34" r="4.5" fill={color}/>
      <circle cx="34" cy="66" r="4.5" fill={color}/>
      <circle cx="66" cy="66" r="4.5" fill={color}/>
    </svg>
  );
}

// MD — Anatomical molar silhouette. Crown (rounded top) + 2 roots tapering down.
function MarkD({ size = 140, color = '#0d7c6b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Crown body */}
      <path
        d="M 22 18 Q 22 10 32 10 L 68 10 Q 78 10 78 18 L 78 52 Q 78 60 70 60 L 30 60 Q 22 60 22 52 Z"
        fill={color}
      />
      {/* Two roots */}
      <path
        d="M 30 60 L 26 88 Q 26 92 32 90 L 42 60 Z"
        fill={color}
      />
      <path
        d="M 70 60 L 74 88 Q 74 92 68 90 L 58 60 Z"
        fill={color}
      />
      {/* Cusp notches on top */}
      <path d="M 38 10 Q 42 4 46 10 Z" fill="var(--cream, #f7f6f2)"/>
      <path d="M 54 10 Q 58 4 62 10 Z" fill="var(--cream, #f7f6f2)"/>
    </svg>
  );
}

// Wordmark variants
function WordmarkPlain({ size = 64, color = 'var(--ink)' }) {
  return (
    <span className="ml-wm" style={{ fontSize: size, color }}>
      Molaris
    </span>
  );
}

function WordmarkUpper({ size = 36, color = 'var(--ink)' }) {
  return (
    <span className="ml-wm upper" style={{ fontSize: size, color }}>
      MOLARIS
    </span>
  );
}

function WordmarkMono({ size = 56, color = 'var(--ink)' }) {
  return (
    <span className="ml-wm mono" style={{ fontSize: size, color }}>
      molaris
    </span>
  );
}

// Wordmark where the "o" is replaced by Mark A (4 cusps) — visual easter egg.
function WordmarkWithMark({ size = 64, color = 'var(--ink)', markColor = '#0d7c6b' }) {
  const oSize = size * 0.88;
  return (
    <span className="ml-wm" style={{ fontSize: size, color, display: 'inline-flex', alignItems: 'center', gap: 0 }}>
      <span>M</span>
      <span style={{ display: 'inline-flex', margin: `0 ${size*0.02}px`, transform: `translateY(${size*0.04}px)` }}>
        <MarkA size={oSize} color={markColor}/>
      </span>
      <span>laris</span>
    </span>
  );
}

Object.assign(window, {
  MarkA, MarkB, MarkC, MarkD,
  WordmarkPlain, WordmarkUpper, WordmarkMono, WordmarkWithMark,
});
