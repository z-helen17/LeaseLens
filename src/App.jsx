import { useState } from 'react';
import UploadScreen from './components/UploadScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import OptionsScreen from './components/OptionsScreen.jsx';
import ReportScreen from './components/ReportScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState('upload');
  const [uploadData, setUploadData] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [option, setOption] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = (data) => {
    setUploadData(data);
    setError(null);
    setScreen('loading');
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
    setClauses([]);
    setOption(null);
    setError(null);
  };

  if (screen === 'upload') {
    return <UploadScreen onSubmit={handleUpload} externalError={error} />;
  }
  if (screen === 'loading') {
    return (
      <LoadingScreen
        file={uploadData.file}
        location={uploadData.location}
        onComplete={handleAnalysisComplete}
        onError={handleAnalysisError}
      />
    );
  }
  if (screen === 'options') {
    return <OptionsScreen clauses={clauses} onSelect={handleOptionSelect} />;
  }
  if (screen === 'report') {
    return (
      <ReportScreen
        clauses={clauses}
        option={option}
        file={uploadData.file}
        onStartOver={handleStartOver}
        onChangeOption={handleOptionSelect}
      />
    );
  }
  return null;
}
