import { useState, useRef } from 'react';

export default function UploadScreen({ onSubmit, externalError }) {
  const [file, setFile] = useState(null);
  const [location, setLocation] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const validateAndSet = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setError('Only PDF and DOCX files are accepted.');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files[0]);
  };

  const handleSubmit = () => {
    if (!file) {
      setError('Please upload a lease agreement to continue.');
      return;
    }
    onSubmit({ file, location });
  };

  const displayError = error || externalError;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1B2E4B', padding: '14px 28px', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>
          LeaseLens
        </span>
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
        <div style={{ maxWidth: '540px', width: '100%' }}>
          <h1
            style={{
              fontSize: '34px',
              fontWeight: '800',
              color: '#1B2E4B',
              lineHeight: '1.15',
              marginBottom: '14px',
              letterSpacing: '-0.5px',
            }}
          >
            Look at your Lease<br />through the Lens.
          </h1>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.65', marginBottom: '36px' }}>
            Upload any lease agreement, get a detailed, clause-by-clause report on which party they
            favour, together with suggestions to improve.
          </p>

          <div style={{ marginBottom: '18px' }}>
            <label
              style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: '#374151' }}
            >
              Property Location / Jurisdiction
            </label>
            <input
              type="text"
              placeholder="e.g. London, England  /  New York, NY  /  Sydney, NSW"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: '1.5px solid #d1d5db',
                fontSize: '14px',
                outline: 'none',
                color: '#111827',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#1B2E4B')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#1B2E4B' : file ? '#22c55e' : '#d1d5db'}`,
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              background: isDragging ? '#f0f4f8' : file ? '#f0fdf4' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '14px',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => validateAndSet(e.target.files[0])}
              style={{ display: 'none' }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✓</div>
                <p style={{ fontWeight: '700', color: '#166534', fontSize: '15px' }}>{file.name}</p>
                <p style={{ fontSize: '13px', color: '#16a34a', marginTop: '4px' }}>
                  {(file.size / 1024).toFixed(0)} KB
                  &nbsp;·&nbsp;
                  <span
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    Remove
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.4 }}>📄</div>
                <p style={{ fontWeight: '600', color: '#374151', fontSize: '15px' }}>
                  Drag & drop your lease agreement
                </p>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '5px' }}>
                  or click to browse · PDF or DOCX only
                </p>
              </div>
            )}
          </div>

          {displayError && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>{displayError}</p>
          )}

          <button
            onClick={handleSubmit}
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
            Analyse Lease
          </button>
        </div>
      </main>
    </div>
  );
}
