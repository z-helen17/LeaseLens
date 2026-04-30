import { useState, useEffect, useRef } from 'react';
import { extractText } from '../utils/extractText.js';
import { analyzeWithClaude, detectJurisdiction } from '../utils/analyzeWithClaude.js';

// When onReadyToAnalyze is provided the component runs extraction + jurisdiction
// detection only, then calls onReadyToAnalyze(text, detectedJurisdiction) and stops.
// When extractedText is provided, extraction is skipped.
// confirmedJurisdiction overrides location for the analysis API call.
export default function LoadingScreen({
  file, location, onComplete, onError,
  extractedText, confirmedJurisdiction, onReadyToAnalyze, onLogoClick, grid,
}) {
  const [apiDone, setApiDone] = useState(false);
  const [streamedCount, setStreamedCount] = useState(0);
  const clausesRef = useRef(null);
  const completedRef = useRef(false);

  // Proceed to next screen once analysis is complete
  useEffect(() => {
    if (apiDone && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(() => onComplete(clausesRef.current), 1200);
      return () => clearTimeout(t);
    }
  }, [apiDone]);

  // Run extraction + jurisdiction detection (detection mode) OR full analysis
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const text = extractedText ?? await extractText(file);
        if (cancelled) return;

        if (onReadyToAnalyze) {
          // Detection-only mode: detect jurisdiction then hand control back to App.
          const detected = await detectJurisdiction(text);
          if (!cancelled) onReadyToAnalyze(text, detected);
          return;
        }

        const jurisdiction = confirmedJurisdiction || location;
        const clauses = await analyzeWithClaude(text, jurisdiction, () => {}, (clause) => {
          if (!cancelled) setStreamedCount(c => c + 1);
        }, grid);
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

  // Progress bar calculation
  const docLength = extractedText?.length || 0;
  const baseEstimate = Math.round(docLength / 800);
  const estimatedTotal = Math.max(baseEstimate, streamedCount + 5);
  const barPercent = apiDone ? 100 : Math.min((streamedCount / estimatedTotal) * 100, 95);

  // Detection-only mode: minimal UI while extracting text + detecting jurisdiction
  if (onReadyToAnalyze) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
          <span onClick={onLogoClick} style={{ color: 'white', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}>LeaseLens</span>
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
          <div style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '44px', height: '44px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>✓</div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontWeight: '700', color: '#166534', fontSize: '14px', marginBottom: '2px' }}>{fileExt} uploaded successfully</p>
                <p style={{ fontSize: '13px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Spinner />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1B2E4B' }}>Reading document & detecting jurisdiction…</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>LeaseLens</span>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div style={{ maxWidth: '480px', width: '100%' }}>

          {/* Upload success card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: '#f0fdf4',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}>
              ✓
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontWeight: '700', color: '#166534', fontSize: '14px', marginBottom: '2px' }}>
                {fileExt} uploaded successfully
              </p>
              <p style={{ fontSize: '13px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </p>
            </div>
          </div>

          {/* Jurisdiction badge */}
          {confirmedJurisdiction && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              padding: '7px 14px',
              background: '#f0fdf4',
              borderRadius: '20px',
              border: '1px solid #bbf7d0',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="8" fill="#1B2E4B" />
                <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: '500' }}>
                Jurisdiction detected: {confirmedJurisdiction}
              </span>
            </div>
          )}

          {/* Analysis card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}>
            <p style={{ fontWeight: '700', fontSize: '14px', color: '#1B2E4B', marginBottom: '4px' }}>
              Analysing your lease…
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
              This may take a minute for longer documents
            </p>

            {/* Progress bar */}
            <div style={{
              background: '#e5e7eb',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden',
              marginBottom: '14px',
            }}>
              <div style={{
                height: '100%',
                width: `${barPercent}%`,
                background: '#1B2E4B',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }} />
            </div>

            {/* Live counter */}
            <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', margin: 0 }}>
              {apiDone
                ? `${clausesRef.current?.length ?? streamedCount} clauses found — building your report…`
                : streamedCount > 0
                  ? `${streamedCount} clause${streamedCount !== 1 ? 's' : ''} identified so far…`
                  : 'Reading document…'}
            </p>
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
