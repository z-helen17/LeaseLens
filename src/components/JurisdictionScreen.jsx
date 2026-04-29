export default function JurisdictionScreen({ detectedJurisdiction, userLocation, onConfirm, onLogoClick }) {
  const hasUser = userLocation && userLocation.trim().length > 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
        <span onClick={onLogoClick} style={{ color: 'white', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}>LeaseLens</span>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div style={{ maxWidth: '540px', width: '100%' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1B2E4B', marginBottom: '10px', letterSpacing: '-0.3px' }}>
            Confirm Jurisdiction
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.65', marginBottom: '28px' }}>
            The governing law clause in your document specifies a different jurisdiction from the one you entered. Please choose which jurisdiction to use for the analysis.
          </p>

          {/* Jurisdiction comparison */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '28px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '120px', paddingTop: '2px' }}>
                In document
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1B2E4B' }}>
                {detectedJurisdiction}
              </span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: '120px', paddingTop: '2px' }}>
                Your input
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1B2E4B' }}>
                {hasUser ? userLocation : <span style={{ color: '#9ca3af', fontWeight: '400' }}>Not entered</span>}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <JurisdictionButton
              primary
              label="Use document jurisdiction"
              sub={detectedJurisdiction}
              onClick={() => onConfirm(detectedJurisdiction)}
            />
            {hasUser && (
              <JurisdictionButton
                label="Use my input"
                sub={userLocation}
                onClick={() => onConfirm(userLocation)}
              />
            )}
            {hasUser && (
              <JurisdictionButton
                label="Use both"
                sub={`${detectedJurisdiction} and ${userLocation}`}
                onClick={() => onConfirm(`${detectedJurisdiction} and ${userLocation}`)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function JurisdictionButton({ label, sub, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 18px',
        background: primary ? '#1B2E4B' : 'white',
        color: primary ? 'white' : '#1B2E4B',
        border: primary ? 'none' : '1.5px solid #d1d5db',
        borderRadius: '8px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.88';
        if (!primary) e.currentTarget.style.borderColor = '#1B2E4B';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
        if (!primary) e.currentTarget.style.borderColor = '#d1d5db';
      }}
    >
      <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '12px', opacity: 0.7, fontWeight: '400' }}>{sub}</p>
    </button>
  );
}
