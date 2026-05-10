import React, { useState, useEffect, useRef } from 'react';

const QuantumNexusEmpire = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState([]);
  const [threatCount, setThreatCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);

  const addLog = (msg, color = '#00e5ff') => {
    setLogs(prev => [{ msg, color, time: new Date().toLocaleTimeString('tr-TR') }, ...prev].slice(0, 35));
  };

  const callAI = async (provider, prompt) => {
    addLog(`Calling ${provider.toUpperCase()}...`, '#00e5ff');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt, system: "Sen Quantum Nexus OS'sun. Erdem Hasates & Arel Empire için çalışıyorsun. Teknik, vizyoner ve cesur cevap ver." })
      });
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alındı.";
      addLog(`✓ ${provider.toUpperCase()}: ${answer.substring(0, 90)}...`, '#00e676');
      setAiCount(prev => prev + 1);
    } catch (e) {
      addLog(`✗ ${provider} hatası: ${e.message}`, '#ff3d3d');
    }
  };

  // Boot Effect
  useEffect(() => {
    const bootScreen = document.getElementById('boot');
    if (bootScreen) {
      setTimeout(() => bootScreen.style.opacity = '0', 2200);
      setTimeout(() => {
        bootScreen.style.display = 'none';
        document.getElementById('os').style.display = 'flex';
      }, 3000);
    }
    addLog("QUANTUM NEXUS OS v14.1 — LEVEL 20 OMEGA AWAKENED", '#00e5ff');
    addLog("Erdem Hasates & Arel Empire — Sovereign System Online", '#ffb300');
  }, []);

  const tabs = [
    "⬡ CORE", "📡 CSI", "🛡 KALKAN", "💓 BİYO", "🕸 MESH", "₿ DeFi", 
    "🎓 AREL", "👻 GHOST", "🤖 AI", "⚛ OMEGA", "🕵 OSINT", "🤝 AJAN", 
    "🗄 DB", "⚡ GROK", "🌐 URL+IP", "📊 ANALİT", "🔔 ALARM", "🗺 HARİTA", 
    "📰 HABER", "🧬 EVRİM"
  ];

  return (
    <>
      <div id="boot" style={{position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:9999, transition:'opacity 0.8s'}}>
        <div style={{color:'#2a4a60', letterSpacing:'6px', fontSize:'11px'}}>QUANTUM NEXUS RESEARCH LABORATORY</div>
        <h1 style={{fontFamily:'Orbitron', fontSize:'3.2em', fontWeight:'900', color:'#00e5ff', letterSpacing:'12px', textShadow:'0 0 60px #00e5ff'}}>NEXUS OS</h1>
        <div style={{color:'#0a1c28', letterSpacing:'8px', marginTop:'8px'}}>v14.1 — 20 LEVEL OMEGA</div>
        <div style={{width:'380px', height:'3px', background:'#0f2535', marginTop:'40px', borderRadius:'2px', overflow:'hidden'}}>
          <div id="bfil" style={{height:'100%', width:'0%', background:'#00e5ff', boxShadow:'0 0 20px #00e5ff', transition:'width 0.08s linear'}}></div>
        </div>
      </div>

      <div id="os" style={{display:'none', flexDirection:'column', width:'100%', height:'100vh', background:'#000', color:'#a0c0d8', fontFamily:'Share Tech Mono, monospace'}}>
        {/* Senin orijinal Top Bar */}
        <div id="top" style={{height:'42px', background:'#000', borderBottom:'1px solid #163248', display:'flex', alignItems:'center', padding:'0 14px', fontSize:'13px'}}>
          <div style={{fontFamily:'Orbitron', fontWeight:'900', color:'#00e5ff', letterSpacing:'4px'}}>⬡ NEXUS OS v14.1</div>
          <div style={{flex:1}}></div>
          <div style={{color:'#ffb300'}}>ERDEM HASA TES & AREL EMPIRE</div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', background:'#060e18', overflowX:'auto', borderBottom:'1px solid #163248', padding:'4px 0'}}>
          {tabs.map((tab, i) => (
            <div key={i} onClick={() => setActiveTab(i)}
              style={{
                padding: '10px 16px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                color: activeTab === i ? '#00e5ff' : '#2a4a60',
                borderBottom: activeTab === i ? '2px solid #00e5ff' : 'none',
                fontSize: '11px',
                letterSpacing: '1px'
              }}>
              {tab}
            </div>
          ))}
        </div>

        {/* Main Area */}
        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          {/* Sidebar */}
          <div style={{width:'194px', background:'#000', borderRight:'1px solid #163248', overflowY:'auto', padding:'10px 0'}}>
            {tabs.map((tab, i) => (
              <div key={i} onClick={() => setActiveTab(i)}
                style={{
                  padding: '9px 14px',
                  cursor: 'pointer',
                  color: activeTab === i ? '#00e5ff' : '#4a7fa0',
                  borderLeft: activeTab === i ? '3px solid #00e5ff' : 'none',
                  background: activeTab === i ? 'rgba(0,229,255,0.06)' : 'transparent'
                }}>
                {tab}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{flex:1, padding:'18px', overflowY:'auto'}}>
            <h2 style={{color:'#00e5ff', marginBottom:'16px'}}>{tabs[activeTab]}</h2>

            {activeTab === 8 && (
              <div>
                <h3>AI SOVEREIGN CORE</h3>
                <div style={{display:'flex', gap:'12px', flexWrap:'wrap', marginTop:'16px'}}>
                  <button onClick={() => callAI('openrouter', 'Quantum Nexus OS vizyonunu ve gelecek planlarını anlat')} className="btn bc">OpenRouter ile Sor</button>
                  <button onClick={() => callAI('groq', 'Erdem Hasates için stratejik öneriler sun')} className="btn bg2">Groq ile Sor</button>
                  <button onClick={() => callAI('gemini', 'Bu sistemi nasıl dünyayı titretecek seviyeye taşırız?')} className="btn ba">Gemini ile Sor</button>
                </div>
              </div>
            )}

            {activeTab === 5 && <div>₿ DeFi & MEV Engine — Gerçek Jupiter + Jito entegrasyonu yakında aktif</div>}

            <div style={{marginTop:'40px', background:'#000', border:'1px solid #163248', padding:'16px', borderRadius:'3px', minHeight:'220px'}}>
              <strong>SİSTEM LOGU — LIVE</strong><br/><br/>
              {logs.map((l,i) => <div key={i} style={{color: l.color, marginBottom:'4px'}}>[{l.time}] {l.msg}</div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuantumNexusEmpire;
