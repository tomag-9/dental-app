// Molaris brand mark + wordmark.
// Canonical runtime copy of the mark used by the delivered design UI kit.

function MolarisMark({ size = 22, color = '#0d7c6b' }) {
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 100 100', fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    style: { display: 'block', flexShrink: 0 },
    role: 'img', 'aria-label': 'Molaris',
  }, React.createElement('path', {
    d: 'M 18 82 L 18 32 Q 18 22 28 22 Q 38 22 38 32 L 38 50 Q 38 56 44 56 L 56 56 Q 62 56 62 50 L 62 32 Q 62 22 72 22 Q 82 22 82 32 L 82 82',
    stroke: color, strokeWidth: 10, strokeLinecap: 'round', strokeLinejoin: 'round',
  }));
}

function MolarisLockup({
  markSize = 22, wordmarkSize = 16, color = '#0d7c6b',
  textColor = '#1a2320', gap = 9,
}) {
  return React.createElement('div', {
    style: { display: 'inline-flex', alignItems: 'center', gap },
    'aria-label': 'Molaris',
  },
    React.createElement(MolarisMark, { size: markSize, color }),
    React.createElement('span', {
      style: {
        fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700,
        fontSize: wordmarkSize, color: textColor, letterSpacing: '-0.02em', lineHeight: 1,
      }
    }, 'Molaris')
  );
}

function MolarisInverse({ markSize = 22, wordmarkSize = 16, gap = 9 }) {
  return React.createElement(MolarisLockup, {
    markSize, wordmarkSize, gap, color: '#f7f6f2', textColor: '#f7f6f2',
  });
}

function MolarisBadge({ size = 52, radius = 14, bg = '#0d7c6b', markColor = '#ffffff' }) {
  return React.createElement('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: radius, background: bg, flexShrink: 0,
    },
    'aria-label': 'Molaris',
  }, React.createElement(MolarisMark, { size: Math.round(size * 0.62), color: markColor }));
}

// Backwards-compatible names for production components that still reference Logo*.
const LogoMark = MolarisMark;
const Logo = MolarisLockup;
const LogoInverse = MolarisInverse;
const LogoBadge = MolarisBadge;

Object.assign(window, {
  MolarisMark, MolarisLockup, MolarisInverse, MolarisBadge,
  LogoMark, Logo, LogoInverse, LogoBadge,
});
