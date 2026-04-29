import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  BIAS_COLORS,
  BIAS_LABELS,
  computeOverallScore,
  filterAndSort,
  getBarChartData,
} from '../utils/scoring.js';
import { downloadPDF, downloadWord } from '../utils/downloadUtils.js';

const OPTION_LABELS = {
  1: 'Full Report',
  2: 'Landlord-Friendly View',
  3: 'Tenant-Friendly View',
  4: 'Lender-Friendly View',
};

export default function ReportScreen({ clauses, option, file, onStartOver, onChangeOption, onLogoClick, onBackToOptions }) {
  const { display, mean } = computeOverallScore(clauses);
  const filtered = filterAndSort(clauses, option);
  const barData = getBarChartData(clauses, option, mean);
  const showChanges = option !== 1;
  const [downloading, setDownloading] = useState(null);

  const handleBarClick = (data) => {
    const id = `clause-${encodeURIComponent(data.fullName)}`;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDownloadPDF = async () => {
    setDownloading('pdf');
    try {
      downloadPDF(filtered, option, clauses, file.name);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadWord = async () => {
    setDownloading('word');
    try {
      await downloadWord(filtered, option, clauses, file);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          background: '#1B2E4B',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <span onClick={onLogoClick} style={{ color: 'white', fontSize: '18px', fontWeight: '700', marginRight: 'auto', cursor: 'pointer' }}>
          LeaseLens
        </span>
        <select
          value={option}
          onChange={(e) => onChangeOption(Number(e.target.value))}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {[1, 2, 3, 4].map((o) => (
            <option key={o} value={o} style={{ background: '#1B2E4B' }}>
              {OPTION_LABELS[o]}
            </option>
          ))}
        </select>
        <button
          onClick={handleDownloadPDF}
          disabled={downloading !== null}
          style={headerBtn()}
        >
          {downloading === 'pdf' ? 'Generating…' : '↓ PDF'}
        </button>
        <button
          onClick={handleDownloadWord}
          disabled={downloading !== null}
          style={headerBtn()}
        >
          {downloading === 'word' ? 'Generating…' : '↓ Word'}
        </button>
        <button
          onClick={onBackToOptions}
          style={{
            background: 'white',
            color: '#1B2E4B',
            border: '1.5px solid white',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1B2E4B'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#1B2E4B'; }}
        >
          Change Perspective
        </button>
        <button
          onClick={onStartOver}
          style={{ ...headerBtn(), background: 'transparent', border: '1px solid rgba(255,255,255,0.3)' }}
        >
          New Lease
        </button>
      </header>

      <main style={{ maxWidth: '880px', margin: '0 auto', padding: '36px 20px 60px', width: '100%' }}>
        {/* Overall Score */}
        <OverallScore display={display} mean={mean} />

        {/* Bar Chart */}
        {barData.length > 0 && (
          <section style={card()}>
            <h2 style={sectionTitle()}>Key Impact Clauses</h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              Top {barData.length} clauses by deviation from mean · click a bar to jump to clause
            </p>
            <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 48)}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 'dataMax + 5']} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ fontWeight: '700', color: '#1B2E4B', marginBottom: '4px' }}>{d.fullName}</p>
                        <p style={{ color: BIAS_COLORS[d.bias] }}>{BIAS_LABELS[d.bias]}</p>
                        <p style={{ color: '#6b7280' }}>Score: {d.score}/100</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="deviation" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleBarClick}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* Scoring Key */}
        <section style={{ ...card(), padding: '18px 24px' }}>
          <h2 style={{ ...sectionTitle(), marginBottom: '14px' }}>Scoring Key</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {[1, 2, 3, 4, 5, 'x'].map((b) => (
              <div
                key={b}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e5e7eb',
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '13px',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: BIAS_COLORS[b],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#374151', fontWeight: '500' }}>
                  {b === 'x' ? 'X' : b} — {BIAS_LABELS[b]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Clause Breakdown */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
            <h2 style={sectionTitle()}>Clause Breakdown</h2>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              {filtered.length} clause{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ ...card(), padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
              No clauses match this filter.
            </div>
          ) : (
            filtered.map((clause, i) => (
              <ClauseCard key={i} clause={clause} showChanges={showChanges} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function OverallScore({ display, mean }) {
  const [showTip, setShowTip] = useState(false);
  const COLORS = { 1: '#4c1d95', 2: '#7c3aed', 3: '#eab308', 4: '#f97316', 5: '#c2410c' };
  const color = COLORS[display] || '#eab308';

  return (
    <section style={{ ...card(), marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Overall Balance Score
          </p>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'help', position: 'relative' }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <span style={{ fontSize: '48px', fontWeight: '800', color, lineHeight: 1 }}>{display}</span>
            <span style={{ fontSize: '24px', color: '#d1d5db', fontWeight: '300' }}>/</span>
            <span style={{ fontSize: '24px', fontWeight: '600', color: '#9ca3af' }}>5</span>
            <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '4px' }}>ⓘ</span>

            {showTip && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  background: '#1B2E4B',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  lineHeight: '1.7',
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}
              >
                <p style={{ fontWeight: '700', marginBottom: '6px' }}>Score mapping (mean of all clause scores):</p>
                <p>1 = Very Landlord-Friendly (mean 1–20)</p>
                <p>2 = Leans Landlord (21–40)</p>
                <p>3 = Neutral (41–60)</p>
                <p>4 = Leans Tenant (61–80)</p>
                <p>5 = Very Tenant-Friendly (81–100)</p>
                <p style={{ marginTop: '6px', color: '#94a3b8' }}>Mean clause score: {Math.round(mean)}/100</p>
              </div>
            )}
          </div>
          <p style={{ fontSize: '15px', fontWeight: '600', color, marginTop: '4px' }}>
            {BIAS_LABELS[display]}
          </p>
        </div>

        {/* Dot display */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: i <= display ? color : '#f3f4f6',
                border: i <= display ? 'none' : '1.5px solid #e5e7eb',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ClauseCard({ clause, showChanges }) {
  const color = BIAS_COLORS[clause.bias] || '#6b7280';
  const label = clause.bias === 'x' ? 'Error / Unclear' : `Bias ${clause.bias}`;
  const hasChange = showChanges && clause.change;
  const hasGenClause = showChanges && clause.genClause;

  return (
    <div
      id={`clause-${encodeURIComponent(clause.name)}`}
      style={{
        background: 'white',
        borderRadius: '10px',
        borderLeft: `4px solid ${color}`,
        marginBottom: '10px',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: `1px solid #f1f5f9`,
        borderLeftColor: color,
        borderLeftWidth: '4px',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <h3 style={{ flex: 1, fontSize: '15px', fontWeight: '700', color: '#1B2E4B', lineHeight: '1.4', minWidth: '160px' }}>
          {clause.name}
        </h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <span
            style={{
              background: color,
              color: 'white',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.2px',
            }}
          >
            {label}
          </span>
          {clause.score !== null && clause.score !== undefined && (
            <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f8fafc', padding: '3px 8px', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
              {clause.score}/100
            </span>
          )}
          {clause.lenderFlag && (
            <span style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
              Lender
            </span>
          )}
        </div>
      </div>

      {/* Note */}
      <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>{clause.note}</p>

      {/* Suggested change */}
      {hasChange && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: '#fffbeb',
            borderRadius: '6px',
            borderLeft: '3px solid #f59e0b',
          }}
        >
          <p style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Suggested Change
          </p>
          <p style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.55' }}>{clause.change}</p>
        </div>
      )}

      {/* Drafted clause */}
      {hasGenClause && (
        <details style={{ marginTop: '10px' }}>
          <summary
            style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#1d4ed8',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              userSelect: 'none',
              listStyle: 'none',
            }}
          >
            ▸ View Drafted Replacement Clause
          </summary>
          <div
            style={{
              marginTop: '8px',
              padding: '14px',
              background: '#eff6ff',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#1e3a8a',
              lineHeight: '1.65',
              whiteSpace: 'pre-wrap',
              fontFamily: 'Georgia, serif',
            }}
          >
            {clause.genClause}
          </div>
        </details>
      )}
    </div>
  );
}

function card() {
  return {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    border: '1px solid #f1f5f9',
  };
}

function sectionTitle() {
  return {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1B2E4B',
    marginBottom: '4px',
    letterSpacing: '-0.2px',
  };
}

function headerBtn() {
  return {
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
