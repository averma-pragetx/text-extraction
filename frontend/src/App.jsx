import React, { useState, useRef } from 'react';

// Simple Component to render JSON in a more readable way
const JsonField = ({ label, value }) => {
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="json-node">
        <span className="json-key">{label}:</span>
        <div className="json-children">
          {Object.entries(value).map(([k, v]) => (
            <JsonField key={k} label={k} value={v} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="json-leaf">
      <span className="json-key">{label}:</span>
      <span className={`json-value json-type-${typeof value}`}>{String(value)}</span>
    </div>
  );
};

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const downloadJson = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.extraction, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `extraction_${result.metadata.source.split('.')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Extraction failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Document Text Extraction</h1>
        <p>Intelligent Document Extraction</p>
      </header>
      
      <div className="card">
        <div 
          className={`upload-zone ${file ? 'active' : ''}`}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={triggerFileInput}
        >
          <span className="upload-icon">📄</span>
          {file ? (
            <div>
              <p style={{ fontWeight: 600, color: '#4f46e5' }}>{file.name}</p>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Click or drag to change file</p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 600 }}>Click to upload or drag and drop</p>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>PDF, PNG, JPG (Max 10MB)</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef}
            className="file-input"
            accept=".pdf,.png,.jpg,.jpeg" 
            onChange={handleFileChange}
          />
        </div>

        <button 
          className="btn" 
          onClick={(e) => { e.stopPropagation(); handleUpload(); }} 
          disabled={loading || !file}
        >
          {loading ? 'Processing Document...' : 'Start Extraction'}
        </button>

        {loading && (
          <div className="status-info">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p style={{ color: '#4f46e5', fontWeight: 500 }}>
                Reasoning over document structure...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-msg">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card results-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>
              Extraction Result 
              <span className="badge" style={{ marginLeft: '10px' }}>Success</span>
            </h2>
            <button className="btn-secondary" onClick={downloadJson}>
              Download JSON
            </button>
          </div>
          
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">File Name</span>
              <span className="meta-value">{result.metadata.source}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Pages</span>
              <span className="meta-value">{result.metadata.page_count}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Total Blocks</span>
              <span className="meta-value">{result.metadata.total_blocks}</span>
            </div>
          </div>

          <div className="structured-output">
            {Object.entries(result.extraction.extracted_fields || result.extraction).map(([key, val]) => (
              <JsonField key={key} label={key} value={val} />
            ))}
          </div>
          
          <div style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>RAW JSON</p>
            <div className="json-container">
              <pre style={{ margin: 0 }}>
                {JSON.stringify(result.extraction, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
