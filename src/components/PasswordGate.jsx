import { useState, useEffect, useRef } from 'react';

export default function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [email, setEmail] = useState('');
  const [requestStatus, setRequestStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [requestError, setRequestError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (localStorage.getItem('ll_access') === 'true') {
      onSuccess();
    } else {
      inputRef.current?.focus();
    }
  }, []);

  const submitPassword = () => {
    if (password === import.meta.env.VITE_ACCESS_PASSWORD) {
      localStorage.setItem('ll_access', 'true');
      onSuccess();
    } else {
      setPasswordError('Incorrect password.');
      setPassword('');
      inputRef.current?.focus();
    }
  };

  const submitRequest = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRequestError('Please enter a valid email address.');
      return;
    }
    setRequestStatus('loading');
    setRequestError('');
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }
      setRequestStatus('success');
    } catch (e) {
      setRequestError(e.message || 'Something went wrong. Please try again.');
      setRequestStatus(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>
          LeaseLens
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px', maxWidth: '560px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#1B2E4B', marginBottom: '10px', letterSpacing: '-0.4px' }}>
            AI-powered commercial lease analysis
          </h1>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            Upload your lease. Get a clause-by-clause bias report — flagging what's landlord-friendly, what needs changing, and what to watch out for.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0', width: '100%', maxWidth: '760px', alignItems: 'stretch', flexWrap: 'wrap' }}>

          {/* Panel A: Password */}
          <div style={{ flex: '1 1 280px', background: 'white', borderRadius: '14px 0 0 14px', padding: '32px 28px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', borderRight: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>
              I have a password
            </p>
            <div style={{ marginBottom: passwordError ? '8px' : '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                Password
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: `1.5px solid ${passwordError ? '#ef4444' : '#d1d5db'}`,
                  fontSize: '14px',
                  outline: 'none',
                  color: '#111827',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { if (!passwordError) e.target.style.borderColor = '#1B2E4B'; }}
                onBlur={(e) => { if (!passwordError) e.target.style.borderColor = '#d1d5db'; }}
              />
            </div>
            {passwordError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{passwordError}</p>
            )}
            <button
              onClick={submitPassword}
              style={{
                width: '100%',
                padding: '12px',
                background: '#1B2E4B',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.target.style.opacity = '1')}
            >
              Sign In
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: '0 16px' }}>
            <div style={{ width: '1px', flex: 1, background: '#e5e7eb' }} />
            <span style={{ padding: '10px 0', fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>or</span>
            <div style={{ width: '1px', flex: 1, background: '#e5e7eb' }} />
          </div>

          {/* Panel B: Request demo */}
          <div style={{ flex: '1 1 280px', background: 'white', borderRadius: '0 14px 14px 0', padding: '32px 28px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>
              Request demo access
            </p>

            {requestStatus === 'success' ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', fontSize: '14px', color: '#166534', lineHeight: '1.6' }}>
                Request sent! Check your inbox — your access link will arrive within a few hours. It's valid for 7 days and gives you one full analysis.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: '1.6' }}>
                  Get one free lease analysis. Upload your document, receive a full clause-by-clause bias report. Want more? Just reach out.
                </p>
                <div style={{ marginBottom: requestError ? '8px' : '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setRequestError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRequest(); }}
                    placeholder="you@example.com"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: `1.5px solid ${requestError ? '#ef4444' : '#d1d5db'}`,
                      fontSize: '14px',
                      outline: 'none',
                      color: '#111827',
                      transition: 'border-color 0.15s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { if (!requestError) e.target.style.borderColor = '#1B2E4B'; }}
                    onBlur={(e) => { if (!requestError) e.target.style.borderColor = '#d1d5db'; }}
                  />
                </div>
                {requestError && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{requestError}</p>
                )}
                <button
                  onClick={submitRequest}
                  disabled={requestStatus === 'loading'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: requestStatus === 'loading' ? '#9ca3af' : '#1B2E4B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: requestStatus === 'loading' ? 'default' : 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { if (requestStatus !== 'loading') e.target.style.opacity = '0.88'; }}
                  onMouseLeave={(e) => (e.target.style.opacity = '1')}
                >
                  {requestStatus === 'loading' ? 'Sending…' : 'Request Access'}
                </button>
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
