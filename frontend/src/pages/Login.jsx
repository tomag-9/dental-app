// Login.jsx — Molaris Login (Option A: Deep Teal)

const GOOGLE_UNKNOWN_ACCOUNT_MESSAGE = 'Tento Google účet nie je priradený k žiadnemu laboratóriu. Požiadajte administrátora o pozvánku.';

function Login({ onLogin }) {
  const [mode, setMode] = React.useState('login'); // 'login' | 'register'
  const [form, setForm] = React.useState({ username: '', password: '', totpCode: '' });
  const [registerForm, setRegisterForm] = React.useState({ labName: '', name: '', email: '', password: '' });
  const [totpRequired, setTotpRequired] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  // Google credential is kept only while the account still owes us a TOTP code,
  // so the second submit can finish the same Google sign-in.
  const [googleCredential, setGoogleCredential] = React.useState('');
  const [googleVisible, setGoogleVisible] = React.useState(true);

  const api = () => window.MolarisAPI || {};

  const applyLoginError = (err) => {
    if (err && err.requiresTotp) {
      setTotpRequired(true);
      setError('Zadajte overovací kód z autentifikačnej aplikácie.');
      return;
    }
    if (err && err.invalidTotp) {
      setError('Neplatný overovací kód.');
      return;
    }
    const { isGoogleUnknownAccountError, isGoogleUnconfiguredError } = api();
    if (isGoogleUnknownAccountError && isGoogleUnknownAccountError(err)) {
      setGoogleCredential('');
      setError(GOOGLE_UNKNOWN_ACCOUNT_MESSAGE);
      return;
    }
    if (isGoogleUnconfiguredError && isGoogleUnconfiguredError(err)) {
      setGoogleCredential('');
      setGoogleVisible(false);
      setError('Prihlásenie cez Google nie je na tomto serveri nakonfigurované.');
      return;
    }
    setError(err && err.status === 401 ? 'Neplatné prihlasovacie údaje' : 'Backend nie je dostupný.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (googleCredential) { finishGoogleLogin(googleCredential, form.totpCode); return; }
    if (!form.username || !form.password) { setError('Vyplňte všetky polia.'); return; }
    if (totpRequired && !form.totpCode) { setError('Zadajte overovací kód.'); return; }
    setLoading(true); setError('');
    try {
      const user = await window.MolarisAPI.login(form.username, form.password, form.totpCode);
      onLogin(user);
    } catch (err) {
      applyLoginError(err);
      setLoading(false);
    }
  };

  const finishGoogleLogin = async (credential, totpCode) => {
    if (totpRequired && !totpCode) { setError('Zadajte overovací kód.'); return; }
    setLoading(true); setError('');
    try {
      const user = await window.MolarisAPI.loginWithGoogle(credential, totpCode || '');
      onLogin(user);
    } catch (err) {
      // A 2FA account must still pass the TOTP step — keep the credential so the
      // user can finish with a code instead of starting over.
      if (err && err.requiresTotp) setGoogleCredential(credential);
      applyLoginError(err);
      setLoading(false);
    }
  };

  const handleGoogleCredential = (credential) => {
    setForm({ username: '', password: '', totpCode: '' });
    finishGoogleLogin(credential, '');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.labName || !registerForm.email || !registerForm.password) {
      setError('Vyplňte všetky povinné polia.');
      return;
    }
    if (registerForm.password.length < 6) {
      setError('Heslo musí mať aspoň 6 znakov.');
      return;
    }
    setLoading(true); setError('');
    try {
      const user = await window.MolarisAPI.signup({
        labName: registerForm.labName,
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
      });
      onLogin(user);
    } catch (err) {
      const detail = err && err.data && err.data.detail;
      setError(typeof detail === 'string' && detail ? detail : 'Registrácia zlyhala. Skúste to prosím znova.');
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    resetCredentials();
  };

  const resetCredentials = () => {
    setTotpRequired(false);
    setError('');
    setGoogleCredential('');
    setForm({ username: '', password: '', totpCode: '' });
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    paddingLeft: 38, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
    border: '1px solid #e4ded4', borderRadius: 8,
    fontSize: 14, fontFamily: 'Manrope,sans-serif', outline: 'none',
    color: '#1a2320', background: 'white',
  };

  return React.createElement('div', {
    style: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 20%, #e8f5f2 0, transparent 55%), linear-gradient(180deg, #f7f6f2 0%, #f4f2ee 100%)'
    }
  },
    React.createElement('div', {
      style: { maxWidth: 400, width: '100%', background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.08)', padding: 36, display: 'flex', flexDirection: 'column', gap: 20, border: '1px solid #e4ded4' }
    },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { marginBottom: 16 } },
          React.createElement(LogoBadge, { size: 56, radius: 14 })
        ),
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 600, color: '#8a9490', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 } }, 'Molaris'),
        React.createElement('h1', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 26, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.02em' } }, mode === 'register' ? 'Vytvorte si laboratórium' : 'Vitajte späť'),
        React.createElement('p', { style: { fontSize: 13, color: '#8a9490', marginTop: 6, marginBottom: 0 } }, mode === 'register' ? 'Registrácia zaberie menej ako minútu' : 'Prihláste sa do svojho účtu')
      ),

      mode === 'login' && googleVisible && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement(GoogleSignInButton, {
          onCredential: handleGoogleCredential,
          onUnavailable: () => setGoogleVisible(false),
          disabled: loading,
          text: 'signin_with',
        }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          React.createElement('span', { style: { flex: 1, height: 1, background: '#ece7dc' } }),
          React.createElement('span', { style: { fontSize: 11, color: '#b0bdb9', textTransform: 'uppercase', letterSpacing: '0.12em' } }, 'alebo'),
          React.createElement('span', { style: { flex: 1, height: 1, background: '#ece7dc' } })
        )
      ),

      mode === 'login' && React.createElement('form', { onSubmit: handleSubmit, noValidate: true, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        error && React.createElement('div', { style: { background: '#fde8e6', border: '1px solid #f5c0bb', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', textAlign: 'center' } }, error),

        !googleCredential && React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Používateľské meno'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'user', size: 16 })
            ),
            React.createElement('input', { type: 'text', value: form.username, onChange: e => setForm({ ...form, username: e.target.value }), placeholder: 'meno', required: true, disabled: totpRequired, style: { ...inputStyle, opacity: totpRequired ? 0.72 : 1 } })
          )
        ),

        !googleCredential && React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Heslo'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'lock', size: 16 })
            ),
            React.createElement('input', { type: 'password', value: form.password, onChange: e => setForm({ ...form, password: e.target.value }), placeholder: '••••••••', required: true, disabled: totpRequired, style: { ...inputStyle, opacity: totpRequired ? 0.72 : 1 } })
          )
        ),

        totpRequired && React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Overovací kód'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'shield', size: 16 })
            ),
            React.createElement('input', { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', value: form.totpCode, onChange: e => setForm({ ...form, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }), placeholder: '123456', required: true, style: inputStyle })
          )
        ),

        React.createElement('button', {
          type: 'submit', disabled: loading,
          style: { width: '100%', height: 44, background: '#0d7c6b', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'Manrope,sans-serif', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background .15s' }
        }, loading ? 'Prihlasujem…' : (totpRequired ? 'Overiť a prihlásiť sa' : 'Prihlásiť sa')),

        totpRequired && React.createElement('button', {
          type: 'button', onClick: resetCredentials, disabled: loading,
          style: { width: '100%', height: 36, background: 'transparent', color: '#0d7c6b', border: '1px solid #cfe4df', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'Manrope,sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }
        }, googleCredential ? 'Prihlásiť sa iným spôsobom' : 'Použiť iné meno alebo heslo'),

        React.createElement('p', { style: { textAlign: 'center', fontSize: 11, color: '#b0bdb9', margin: 0 } },
          'Demo: ', React.createElement('strong', null, 'admin'), ' / ', React.createElement('strong', null, 'admin')
        )
      ),

      mode === 'register' && React.createElement('form', { onSubmit: handleRegisterSubmit, noValidate: true, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        error && React.createElement('div', { style: { background: '#fde8e6', border: '1px solid #f5c0bb', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', textAlign: 'center' } }, error),

        React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Názov laboratória'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'building', size: 16 })
            ),
            React.createElement('input', { type: 'text', value: registerForm.labName, onChange: e => setRegisterForm({ ...registerForm, labName: e.target.value }), placeholder: 'Zubná technika Novák', required: true, style: inputStyle })
          )
        ),

        React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Meno'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'user', size: 16 })
            ),
            React.createElement('input', { type: 'text', value: registerForm.name, onChange: e => setRegisterForm({ ...registerForm, name: e.target.value }), placeholder: 'Jana Nováková', style: inputStyle })
          )
        ),

        React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'E-mail'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'mail', size: 16 })
            ),
            React.createElement('input', { type: 'email', value: registerForm.email, onChange: e => setRegisterForm({ ...registerForm, email: e.target.value }), placeholder: 'jana@laboratorium.sk', required: true, style: inputStyle })
          )
        ),

        React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Heslo'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'lock', size: 16 })
            ),
            React.createElement('input', { type: 'password', value: registerForm.password, onChange: e => setRegisterForm({ ...registerForm, password: e.target.value }), placeholder: 'aspoň 6 znakov', required: true, minLength: 6, style: inputStyle })
          )
        ),

        React.createElement('button', {
          type: 'submit', disabled: loading,
          style: { width: '100%', height: 44, background: '#0d7c6b', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'Manrope,sans-serif', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background .15s' }
        }, loading ? 'Zakladám laboratórium…' : 'Vytvoriť laboratórium'),

        React.createElement('p', { style: { textAlign: 'center', fontSize: 11, color: '#b0bdb9', margin: 0 } },
          `Získate ${'14'} dní skúšobnej doby zadarmo.`
        )
      ),

      React.createElement('p', { style: { textAlign: 'center', fontSize: 12.5, color: '#5a6b66', margin: 0 } },
        mode === 'login' ? 'Nemáte ešte laboratórium? ' : 'Už máte účet? ',
        React.createElement('button', {
          type: 'button',
          onClick: () => switchMode(mode === 'login' ? 'register' : 'login'),
          style: { background: 'none', border: 'none', color: '#0d7c6b', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, fontFamily: 'Manrope,sans-serif', padding: 0, textDecoration: 'underline' }
        }, mode === 'login' ? 'Zaregistrujte sa' : 'Prihláste sa')
      )
    )
  );
}

Object.assign(window, { Login });
