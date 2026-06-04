import { useState } from 'react';

export default function Dashboard() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setResponse(data.response || data.error);
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{
      background: '#020209',
      color: '#e8e8ff',
      fontFamily: 'Rajdhani, sans-serif',
      minHeight: '100vh',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '24px', fontWeight: 900, color: '#FFD700' }}>⬡ NEXUS OS</h1>
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(0,255,212,0.1)',
        borderRadius: '14px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%'
      }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter command..."
          style={{
            width: '100%',
            height: '100px',
            padding: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(0,255,212,0.2)',
            borderRadius: '8px',
            color: '#e8e8ff',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '16px',
            background: loading ? '#666' : 'linear-gradient(135deg, #00FFD4, #00D4A8)',
            border: 'none',
            borderRadius: '8px',
            color: '#020209',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {loading ? 'Processing...' : 'Execute'}
        </button>
        {response && (
          <div style={{
            background: '#020215',
            border: '1px solid rgba(0,255,212,0.1)',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '20px',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '12px',
            lineHeight: '1.8',
            color: 'rgba(255,255,255,0.7)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {response}
          </div>
        )}
      </div>
    </div>
  );
}
