// Logo.jsx — Molaris brand mark + wordmark
//
// Concept: 4 cusps of a molar tooth (occlusal view) — four solid teal dots
// in a 2×2 grid, contained by a subtle rounded square frame. Reads as both
// the chewing surface of a molar (anatomical) and a clean modular grid (tech).
//
// Components (registered to window):
//   <LogoMark size color />               — mark only (transparent bg)
//   <Logo markSize wordmarkSize ... />    — horizontal lockup: mark + "Molaris"
//   <LogoBadge size radius bg markColor/> — mark inside a teal rounded badge,
//                                           for splash / login / app-icon contexts
//
// Always pair the mark with the wordmark in primary marketing. Solo mark is
// reserved for favicons, sidebars in collapsed state, and avatars.

function LogoMark({ size = 22, color = '#0d7c6b' }) {
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 100 100',
    xmlns: 'http://www.w3.org/2000/svg',
    style: { display: 'block', flexShrink: 0 },
    'aria-label': 'Molaris',
  },
    React.createElement('rect', { x: 22, y: 22, width: 56, height: 56, rx: 14, fill: 'none', stroke: color, strokeWidth: 2, opacity: 0.18 }),
    React.createElement('circle', { cx: 32, cy: 32, r: 11, fill: color }),
    React.createElement('circle', { cx: 68, cy: 32, r: 11, fill: color }),
    React.createElement('circle', { cx: 32, cy: 68, r: 11, fill: color }),
    React.createElement('circle', { cx: 68, cy: 68, r: 11, fill: color })
  );
}

function Logo({
  markSize = 22,
  wordmarkSize = 16,
  color = '#0d7c6b',
  textColor = '#1a2320',
  gap = 9,
}) {
  return React.createElement('div', {
    style: { display: 'inline-flex', alignItems: 'center', gap }
  },
    React.createElement(LogoMark, { size: markSize, color }),
    React.createElement('span', {
      style: {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontWeight: 700,
        fontSize: wordmarkSize,
        color: textColor,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }
    }, 'Molaris')
  );
}

// Reversed lockup — for use on dark/teal backgrounds.
function LogoInverse({ markSize = 22, wordmarkSize = 16, gap = 9 }) {
  return React.createElement(Logo, {
    markSize, wordmarkSize, gap,
    color: '#f7f6f2',
    textColor: '#f7f6f2',
  });
}

// Badge — mark inside a filled rounded square. Splash / login / app icon.
function LogoBadge({ size = 52, radius = 14, bg = '#0d7c6b', markColor = '#ffffff' }) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: radius,
      background: bg,
      flexShrink: 0,
    },
    'aria-label': 'Molaris',
  }, React.createElement(LogoMark, { size: Math.round(size * 0.62), color: markColor }));
}

Object.assign(window, { LogoMark, Logo, LogoInverse, LogoBadge });
