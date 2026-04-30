import { useState, useEffect, useRef } from 'react';

export default function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (localStorage.getItem('ll_access') === 'true') {
      onSuccess();
    } else {
      inputRef.current?.focus();
    }
  }, []);

  const submit = () => {
    if (password === import.meta.env.VITE_ACCESS_PASSWORD) {
      localStorage.setItem('ll_access', 'true');
      onSuccess();
    } else {
      setError('Incorrect password.');
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>
          LeaseLens
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div style={{
          background: 'white',
          borderRadius: '14px',
          padding: '40px 36px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '800',
            color: '#1B2E4B',
            marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>
            Welcome to LeaseLens
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
            Enter your password to continue.
          </p>

          <div style={{ marginBottom: error ? '10px' : '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
              Password
            </label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: `1.5px solid ${error ? '#ef4444' : '#d1d5db'}`,
                fontSize: '14px',
                outline: 'none',
                color: '#111827',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { if (!error) e.target.style.borderColor = '#1B2E4B'; }}
              onBlur={(e) => { if (!error) e.target.style.borderColor = '#d1d5db'; }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px' }}>{error}</p>
          )}

          <button
            onClick={submit}
            style={{
              width: '100%',
              padding: '14px',
              background: '#1B2E4B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              letterSpacing: '0.2px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.target.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.target.style.opacity = '1')}
          >
            Sign In
          </button>
        </div>
      </main>
    </div>
  );
}
