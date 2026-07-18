// Login.jsx — Molaris Login (Option A: Deep Teal)

function Login({ onLogin }) {
  const [form, setForm] = React.useState({ username: '', password: '', totpCode: '' });
  const [totpRequired, setTotpRequired] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError('Vyplňte všetky polia.'); return; }
    if (totpRequired && !form.totpCode) { setError('Zadajte overovací kód.'); return; }
    setLoading(true); setError('');
    try {
      const user = await window.MolarisAPI.login(form.username, form.password, form.totpCode);
      onLogin(user);
    } catch (err) {
      if (err && err.requiresTotp) {
        setTotpRequired(true);
        setError('Zadajte overovací kód z autentifikačnej aplikácie.');
      } else if (err && err.invalidTotp) {
        setError('Neplatný overovací kód.');
      } else {
        setError(err && err.status === 401 ? 'Neplatné prihlasovacie údaje' : 'Backend nie je dostupný.');
      }
      setLoading(false);
    }
  };

  const resetCredentials = () => {
    setTotpRequired(false);
    setError('');
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
        React.createElement('h1', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 26, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.02em' } }, 'Vitajte späť'),
        React.createElement('p', { style: { fontSize: 13, color: '#8a9490', marginTop: 6, marginBottom: 0 } }, 'Prihláste sa do svojho účtu')
      ),

      React.createElement('form', { onSubmit: handleSubmit, noValidate: true, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        error && React.createElement('div', { style: { background: '#fde8e6', border: '1px solid #f5c0bb', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', textAlign: 'center' } }, error),

        React.createElement('div', null,
          React.createElement('label', { style: { display: 'block', fontSize: 13, fontWeight: 500, color: '#1a2320', marginBottom: 6 } }, 'Používateľské meno'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('span', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
              React.createElement(Icon, { name: 'user', size: 16 })
            ),
            React.createElement('input', { type: 'text', value: form.username, onChange: e => setForm({ ...form, username: e.target.value }), placeholder: 'meno', required: true, disabled: totpRequired, style: { ...inputStyle, opacity: totpRequired ? 0.72 : 1 } })
          )
        ),

        React.createElement('div', null,
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
        }, 'Použiť iné meno alebo heslo'),

        React.createElement('p', { style: { textAlign: 'center', fontSize: 11, color: '#b0bdb9', margin: 0 } },
          'Demo: ', React.createElement('strong', null, 'admin'), ' / ', React.createElement('strong', null, 'admin')
        )
      )
    )
  );
}

Object.assign(window, { Login });
