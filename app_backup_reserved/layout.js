export const metadata = {
  title: 'Quantum Nexus OS - Pro++',
  description: 'Autonomous AI-Driven Intelligence Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#000', color: '#fff', fontFamily: 'monospace' }}>
        {children}
      </body>
    </html>
  );
}
