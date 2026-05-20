'use client';
import React, { useEffect, useState } from 'react';

export default function QuantumNexusIndex() {
  const [status, setStatus] = useState('BAŞLATILIYOR...');
  const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, network: 'KARARLI' });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        cpu: +(Math.random() * 15 + 5).toFixed(2),
        memory: +(Math.random() * 10 + 40).toFixed(2),
        network: Math.random() > 0.02 ? 'KARARLI' : 'YENİDEN BAĞLANILIYOR'
      });
      setStatus('AKTİF - KOGNİTİF SEVİYE 7 ORKESTRASYON');
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ color: '#00ffcc', fontSize: '2.5rem', letterSpacing: '2px' }}>QUANTUM NEXUS OS</h1>
        <p style={{ color: '#888' }}>Sürüm: 15.5.0 // Core Architecture: Level 7 Cognitive Engine</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 style={{ color: '#ff007f' }}>Sistem Durumu</h3>
          <p style={{ fontSize: '1.2rem', color: '#fff' }}>{status}</p>
        </div>

        <div style={{ background: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 style={{ color: '#00ffcc' }}>Telemetri Verileri</h3>
          <ul style={{ listStyleType: 'none', padding: 0, lineHeight: '2' }}>
            <li><strong>CPU Tüketimi:</strong> %{metrics.cpu}</li>
            <li><strong>Bellek Yükü:</strong> %{metrics.memory}</li>
            <li><strong>Ağ Matrisi:</strong> <span style={{ color: metrics.network === 'KARARLI' ? '#00ff00' : '#ff3333' }}>{metrics.network}</span></li>
          </ul>
        </div>
      </section>

      <footer style={{ marginTop: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem', borderTop: '1px solid #222', paddingTop: '20px' }}>
        ERDEM & AREL EMPIRE © 2026 // Her Hakkı Saklıdır.
      </footer>
    </main>
  );
}
