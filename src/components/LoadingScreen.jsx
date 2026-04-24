import { useState, useEffect, useRef, useMemo } from 'react';
import { extractText } from '../utils/extractText.js';
import { analyzeWithClaude } from '../utils/analyzeWithClaude.js';

const STATIC_STEPS = [
  'Scanning document & detecting jurisdiction clause',
  'Reviewing clauses against jurisdiction market standards',
  'Assigning bias scores to each clause',
  'Computing overall agreement balance',
  'Generating your report',
];

const STEP_DURATION = 2600;

export default function LoadingScreen({ file, location, onComplete, onError }) {
  const [stepIndex, setStepIndex] = useState(-1);
  const [apiDone, setApiDone] = useState(false);
  const [chunkState, setChunkState] = useState({ current: 0, total: 0 });
  const clausesRef = useRef(null);
  const completedRef = useRef(false);

  const isMultiChunk = chunkState.total > 1;

  const steps = useMemo(() => {
    if (!isMultiChunk) return STATIC_STEPS;
    return [
      ...Array.from({ length: chunkState.total }, (_, i) => `Analysing part ${i + 1} of ${chunkState.total}`),
      'Merging and deduplicating clauses',
      'Generating your report',
    ];
  }, [isMultiChunk, chunkState.total]);

  // Initial step animation kick-off (single-chunk only)
  useEffect(() => {
    if (isMultiChunk) return;
    const t = setTimeout(() => setStepIndex(0), 900);
    return () => clearTimeout(t);
  }, [isMultiChunk]);

  // Timer-based step auto-advance (single-chunk only)
  useEffect(() => {
    if (isMultiChunk) return;
    if (stepIndex < 0 || stepIndex >= steps.length - 1) return;
    const t = setTimeout(() => setStepIndex((s) => s + 1), STEP_DURATION);
    return () => clearTimeout(t);
  }, [stepIndex, isMultiChunk, steps.length]);

  // Progress-based step advance (multi-chunk only)
  useEffect(() => {
    if (!isMultiChunk || chunkState.current === 0) return;
    setStepIndex(chunkState.current - 1);
  }, [chunkState, isMultiChunk]);

  // When API is done in multi-chunk mode, advance to final step
  useEffect(() => {
    if (!isMultiChunk || !apiDone) return;
    setStepIndex(steps.length - 1);
  }, [apiDone, isMultiChunk, steps.length]);

  // Proceed when last step shown AND api done
  useEffect(() => {
    if (stepIndex === steps.length - 1 && apiDone && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(() => onComplete(clausesRef.current), 900);
      return () => clearTimeout(t);
    }
  }, [stepIndex, apiDone, steps.length]);

  // Run extraction + API call
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const text = await extractText(file);
        if (cancelled) return;
        const clauses = await analyzeWithClaude(text, location, (current, total) => {
          if (!cancelled) setChunkState({ current, total });
        });
        if (cancelled) return;
        clausesRef.current = clauses;
        setApiDone(true);
      } catch (e) {
        if (!cancelled) onError(e.message || 'Analysis failed. Please try again.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const fileExt = file.name.split('.').pop().toUpperCase();

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
        <div style={{ maxWidth: '480px', width: '100%' }}>
          {/* File success card */}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                background: '#f0fdf4',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontWeight: '700', color: '#166534', fontSize: '14px', marginBottom: '2px' }}>
                {fileExt} uploaded successfully
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
            <p style={{ fontWeight: '700', fontSize: '14px', color: '#1B2E4B', marginBottom: '20px' }}>
              {isMultiChunk
                ? `Analysing your lease in ${chunkState.total} parts…`
                : 'Analysing your lease…'}
            </p>
            {steps.map((step, i) => {
              const isActive = i === stepIndex && !(i === steps.length - 1 && apiDone);
              const isDone = i < stepIndex || (i === steps.length - 1 && apiDone);
              const isPending = i > stepIndex;

              return (
                <div
                  key={step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '9px 0',
                    borderBottom: i < steps.length - 1 ? '1px solid #f3f4f6' : 'none',
                    opacity: isPending ? 0.35 : 1,
                    transition: 'opacity 0.4s',
                  }}
                >
                  <div style={{ width: '20px', height: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isDone ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="10" fill="#22c55e" />
                        <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isActive ? (
                      <Spinner />
                    ) : (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1.5px solid #d1d5db' }} />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      color: isDone ? '#374151' : isActive ? '#1B2E4B' : '#9ca3af',
                      fontWeight: isActive ? '600' : '400',
                      transition: 'all 0.3s',
                    }}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="10" cy="10" r="8" stroke="#e5e7eb" strokeWidth="2" />
      <path d="M10 2a8 8 0 0 1 8 8" stroke="#1B2E4B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
