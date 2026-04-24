import { computeOverallScore, BIAS_LABELS } from '../utils/scoring.js';

const OPTIONS = [
  {
    id: 1,
    icon: '📋',
    title: 'Full Report',
    subtitle: 'No changes',
    desc: 'See every clause with bias scores. No suggested changes — just the full picture.',
  },
  {
    id: 2,
    icon: '🏢',
    title: 'Make it Landlord-Friendly',
    subtitle: 'Tenant-biased clauses only',
    desc: 'Show only clauses that favour the tenant, with suggested changes to rebalance them.',
  },
  {
    id: 3,
    icon: '🏠',
    title: 'Make it Tenant-Friendly',
    subtitle: 'Landlord-biased clauses only',
    desc: 'Show only clauses that favour the landlord, with suggested changes to rebalance them.',
  },
  {
    id: 4,
    icon: '🏦',
    title: 'Make it Lender-Friendly',
    subtitle: 'Lender-relevant clauses',
    desc: "Show only clauses relevant to a landlord's lender, with suggested changes.",
  },
];

export default function OptionsScreen({ clauses, onSelect }) {
  const { display } = computeOverallScore(clauses);
  const biasLabel = BIAS_LABELS[display];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>LeaseLens</span>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 20px',
        }}
      >
        <div style={{ maxWidth: '700px', width: '100%' }}>
          {/* Score banner */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Overall Balance
              </p>
              <p style={{ fontSize: '24px', fontWeight: '800', color: '#1B2E4B' }}>
                {display} / 5
                <span style={{ fontSize: '15px', fontWeight: '500', color: '#6b7280', marginLeft: '10px' }}>
                  {biasLabel}
                </span>
              </p>
            </div>
            <ScoreDots display={display} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1B2E4B', marginBottom: '8px', letterSpacing: '-0.3px' }}>
            How would you like to view your report?
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
            Choose a perspective. You can change this any time from the report.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '14px',
            }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                style={{
                  background: 'white',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '22px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1B2E4B';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(27,46,75,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{opt.icon}</div>
                <p style={{ fontWeight: '700', fontSize: '15px', color: '#1B2E4B', marginBottom: '3px' }}>
                  {opt.title}
                </p>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {opt.subtitle}
                </p>
                <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.55' }}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function ScoreDots({ display }) {
  const COLORS = { 1: '#4c1d95', 2: '#7c3aed', 3: '#eab308', 4: '#f97316', 5: '#c2410c' };
  return (
    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: i <= display ? COLORS[display] : '#f3f4f6',
            border: i <= display ? 'none' : '1.5px solid #e5e7eb',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}
