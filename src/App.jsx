import { useState, useEffect } from 'react';
import { buildDocumentGrid, findClauseNumber } from './utils/buildDocumentGrid.js';
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

export default function App() {
  const [accessGranted, setAccessGranted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('ll_access') === 'true') setAccessGranted(true);
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
    if (uploadData.file.name.toLowerCase().endsWith('.docx')) {
      try {
        const ab = await uploadData.file.arrayBuffer();
        newGrid = await buildDocumentGrid(ab);
      } catch {
        // Grid build failure is non-fatal; proceed without grid
      }
    }
    setGrid(newGrid);

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
  };

  const handleBackToOptions = () => {
    setScreen('options');
  };

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
