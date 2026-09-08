// GoogleSignIn.jsx — Google Identity Services button (#108).
//
// The GIS script is loaded from accounts.google.com only when the backend
// reports that Google sign-in is configured; otherwise nothing is rendered and
// no third-party request is made, so dev and CI never depend on Google.
// ContentSecurityPolicyMiddleware allows accounts.google.com for script-src,
// style-src, connect-src and frame-src.

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisLoader = null;

function loadGoogleIdentityServices() {
  const ready = () => window.google && window.google.accounts && window.google.accounts.id;
  if (ready()) return Promise.resolve(window.google);
  if (gisLoader) return gisLoader;

  gisLoader = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${GIS_SRC}"]`);
    const attach = () => {
      script.addEventListener('load', () => (ready() ? resolve(window.google) : reject(new Error('GIS unavailable'))));
      script.addEventListener('error', () => {
        gisLoader = null;
        reject(new Error('GIS script blocked'));
      });
    };
    if (script) { attach(); return; }
    script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    attach();
    document.head.appendChild(script);
  });
  return gisLoader;
}

/**
 * Renders the official Google button. Renders nothing at all when Google
 * sign-in is not configured on the backend or when the script cannot load.
 *
 * Props:
 *   onCredential(credential) — called with the Google ID token
 *   onUnavailable()          — called once when the button will not be shown
 *   text                     — GIS button text key ('signin_with' | 'continue_with')
 *   disabled                 — visually disables and blocks clicks
 */
function GoogleSignInButton({ onCredential, onUnavailable, text = 'signin_with', disabled = false }) {
  const containerRef = React.useRef(null);
  const callbackRef = React.useRef(onCredential);
  const unavailableRef = React.useRef(onUnavailable);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => { callbackRef.current = onCredential; }, [onCredential]);
  React.useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);

  React.useEffect(() => {
    let alive = true;
    const api = window.MolarisAPI;

    const hide = () => {
      if (!alive) return;
      setVisible(false);
      if (unavailableRef.current) unavailableRef.current();
    };

    const start = async () => {
      if (!api || !api.fetchGoogleAuthConfig) { hide(); return; }
      const config = await api.fetchGoogleAuthConfig();
      if (!alive) return;
      if (!config.configured) { hide(); return; }

      let google;
      try {
        google = await loadGoogleIdentityServices();
      } catch {
        hide();
        return;
      }
      if (!alive || !containerRef.current) return;

      google.accounts.id.initialize({
        client_id: config.clientId,
        callback: (response) => {
          if (response && response.credential && callbackRef.current) {
            callbackRef.current(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      containerRef.current.innerHTML = '';
      google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text,
        locale: 'sk',
        logo_alignment: 'left',
        width: 320,
      });
      setVisible(true);
    };

    start();
    return () => {
      alive = false;
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [text]);

  return React.createElement('div', {
    ref: containerRef,
    style: {
      display: visible ? 'flex' : 'none',
      justifyContent: 'center',
      minHeight: visible ? 40 : 0,
      opacity: disabled ? 0.6 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    },
  });
}

Object.assign(window, { GoogleSignInButton });
