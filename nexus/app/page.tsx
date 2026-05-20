import dynamic from 'next/dynamic'

const QuantumNexus = dynamic(() => import('@/components/QuantumNexus'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', background: '#02020C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#00FFD4', fontFamily: 'monospace', fontSize: 14, letterSpacing: 4 }}>
        ⬡ QUANTUM NEXUS OS BAŞLATILIYOR...
      </div>
    </div>
  ),
})

export default function Page() {
  return <QuantumNexus />
}
