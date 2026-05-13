import { useState, useEffect } from 'react';
import { buildDocumentGrid, buildClausePackets } from './utils/buildDocumentGrid.js';
import PasswordGate from './components/PasswordGate.jsx';
import UploadScreen from './components/UploadScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import JurisdictionScreen from './components/JurisdictionScreen.jsx';
import OptionsScreen from './components/OptionsScreen.jsx';
import ReportScreen from './components/ReportScreen.jsx';

// Returns true when the two jurisdiction strings are close enough that the
// confirmation screen should be skipped.
function jurisdictionsMatch(detected, userInput) {
  if (!detected) return true;
  if (!userInput || !userInput.trim()) return true;
  const norm = (s) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const d = norm(detected);
  const u = norm(userInput.trim());
  return d.includes(u) || u.includes(d);
}

const APP_URL = import.meta.env.VITE_APP_URL || 'https://the-lease-lens.vercel.app';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || null;

export default function App() {
  const [accessGranted, setAccessGranted] = useState(false);
  const [demoToken, setDemoToken] = useState(null);
  const [demoStatus, setDemoStatus] = useState(null); // null | 'loading' | 'ok' | 'used' | 'expired' | 'not_approved' | 'not_found'

  useEffect(() => {
    if (localStorage.getItem('ll_access') === 'true') {
      setAccessGranted(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('demo_token');
    if (token) {
      setDemoStatus('loading');
      fetch(`/api/validate-token?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.valid) {
            setDemoToken(token);
            setAccessGranted(true);
            setDemoStatus('ok');
          } else {
            setDemoStatus(data.reason || 'not_found');
          }
        })
        .catch(() => setDemoStatus('not_found'));
    }
  }, []);

  const [screen, setScreen] = useState('upload');
  const [uploadData, setUploadData] = useState(null);
  const [extractedText, setExtractedText] = useState(null);
  const [detectedJurisdiction, setDetectedJurisdiction] = useState('');
  const [confirmedJurisdiction, setConfirmedJurisdiction] = useState('');
  const [clauses, setClauses] = useState([]);
  const [option, setOption] = useState(null);
  const [error, setError] = useState(null);
  const [grid, setGrid] = useState(null);
  const [packets, setPackets] = useState(null);

  const handleUpload = (data) => {
    setUploadData(data);
    setExtractedText(null);
    setDetectedJurisdiction('');
    setConfirmedJurisdiction('');
    setError(null);
    setScreen('loading');
  };

  // Called by LoadingScreen (detection mode) once text is extracted and
  // jurisdiction is detected.
  const handleReadyToAnalyze = async (text, detected) => {
    setExtractedText(text);
    setDetectedJurisdiction(detected);

    let newGrid = null;
    let newPackets = null;
    if (uploadData.file.name.toLowerCase().endsWith('.docx')) {
      try {
        const ab = await uploadData.file.arrayBuffer();
        newGrid = await buildDocumentGrid(ab);
        newPackets = buildClausePackets(newGrid);
      } catch {
        // Grid build failure is non-fatal; proceed without grid
      }
    }
    setGrid(newGrid);
    setPackets(newPackets);

    if (jurisdictionsMatch(detected, uploadData?.location)) {
      setConfirmedJurisdiction(detected || uploadData?.location || '');
      setScreen('analyzing');
    } else {
      setScreen('jurisdiction');
    }
  };

  const handleJurisdictionConfirm = (confirmed) => {
    setConfirmedJurisdiction(confirmed);
    setScreen('analyzing');
  };

  const handleAnalysisComplete = (result) => {
    setClauses(result);
    setScreen('options');
  };

  const handleAnalysisError = (msg) => {
    setError(msg);
    setScreen('upload');
  };

  const handleOptionSelect = (opt) => {
    setOption(opt);
    setScreen('report');
  };

  const handleStartOver = () => {
    setScreen('upload');
    setUploadData(null);
    setExtractedText(null);
    setDetectedJurisdiction('');
    setConfirmedJurisdiction('');
    setClauses([]);
    setOption(null);
    setError(null);
    setGrid(null);
    setPackets(null);
  };

  const handleBackToOptions = () => {
    setScreen('options');
  };

  if (demoStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
        <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
          <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>LeaseLens</span>
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Validating your access link…</p>
        </main>
      </div>
    );
  }

  if (demoStatus === 'used') {
    return (
      <TokenMessage
        title="Demo already used"
        message={`You've already used your demo session.${ADMIN_EMAIL ? ` Want more access? Email ${ADMIN_EMAIL}.` : ' Want more access? Reply to your approval email.'}`}
      />
    );
  }

  if (demoStatus === 'expired') {
    return (
      <TokenMessage
        title="Demo link expired"
        message={`Your demo link has expired. Request a new one at ${APP_URL}.`}
      />
    );
  }

  if (demoStatus === 'not_approved') {
    return (
      <TokenMessage
        title="Not approved yet"
        message="Your access hasn't been approved yet — check back soon."
      />
    );
  }

  if (demoStatus === 'not_found') {
    return (
      <TokenMessage
        title="Invalid link"
        message={`This demo link is invalid or has expired. Request a new one at ${APP_URL}.`}
      />
    );
  }

  if (!accessGranted) {
    return <PasswordGate onSuccess={() => setAccessGranted(true)} />;
  }

  let content = null;

  if (screen === 'upload') {
    content = <UploadScreen onSubmit={handleUpload} externalError={error} onLogoClick={handleStartOver} />;
  } else if (screen === 'loading') {
    content = (
      <LoadingScreen
        key="detection"
        file={uploadData.file}
        location={uploadData.location}
        onReadyToAnalyze={handleReadyToAnalyze}
        onError={handleAnalysisError}
        onLogoClick={handleStartOver}
      />
    );
  } else if (screen === 'jurisdiction') {
    content = (
      <JurisdictionScreen
        detectedJurisdiction={detectedJurisdiction}
        userLocation={uploadData?.location}
        onConfirm={handleJurisdictionConfirm}
        onLogoClick={handleStartOver}
      />
    );
  } else if (screen === 'analyzing') {
    content = (
      <LoadingScreen
        key="analyzing"
        file={uploadData.file}
        location={uploadData.location}
        extractedText={extractedText}
        confirmedJurisdiction={confirmedJurisdiction}
        grid={grid}
        packets={packets}
        demoToken={demoToken}
        onComplete={handleAnalysisComplete}
        onError={handleAnalysisError}
        onLogoClick={handleStartOver}
      />
    );
  } else if (screen === 'options') {
    content = <OptionsScreen clauses={clauses} onSelect={handleOptionSelect} onLogoClick={handleStartOver} />;
  } else if (screen === 'report') {
    content = (
      <ReportScreen
        clauses={clauses}
        option={option}
        file={uploadData.file}
        onStartOver={handleStartOver}
        onChangeOption={handleOptionSelect}
        onLogoClick={handleStartOver}
        onBackToOptions={handleBackToOptions}
      />
    );
  }

  return (
    <>
      {content}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        padding: '7px 20px',
        background: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid #f3f4f6',
        fontSize: '11px',
        color: '#9ca3af',
        lineHeight: '1.5',
        zIndex: 50,
      }}>
        LeaseLens is for informational purposes only and does not constitute legal advice. Always consult a qualified lawyer before acting on this analysis.
      </footer>
    </>
  );
}

function TokenMessage({ title, message }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>LeaseLens</span>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div style={{ background: 'white', borderRadius: '14px', padding: '40px 36px', maxWidth: '440px', width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1B2E4B', marginBottom: '10px' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
        </div>
      </main>
    </div>
  );
}
