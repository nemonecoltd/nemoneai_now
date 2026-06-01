'use client'

export default function GlobalError({ reset }: { error: Error | null; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
          <p style={{ color: '#71717a', fontSize: '14px' }}>잠시 후 다시 시도해 주세요.</p>
          <button onClick={reset} style={{ padding: '8px 20px', background: '#18181b', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
