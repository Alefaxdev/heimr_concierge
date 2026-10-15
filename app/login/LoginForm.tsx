'use client'
import { useState } from 'react'
import { colors } from '@/lib/theme'

type Props = { hotels: { id: string; name: string }[]; next: string; initialHotel?: string; initialName?: string }

export default function LoginForm({ hotels, next, initialHotel, initialName }: Props) {
  const [hotel, setHotel] = useState(initialHotel && hotels.some(h => h.id === initialHotel) ? initialHotel : hotels[0]?.id ?? '')
  const [name, setName] = useState(initialName ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel, name, password }),
    })
    if (res.ok) {
      window.location.href = next
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Innlogging feilet')
      setBusy(false)
    }
  }

  const disabled = busy || !name.trim() || !password

  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <div className="head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/heimr-logo.png" alt="HEIMR Collection" className="logo" width={479} height={301} />
          <h1>Concierge</h1>
          <p>Logg inn for å fortsette.</p>
        </div>

        <label className="field">
          <span>Hotell</span>
          <select value={hotel} onChange={e => setHotel(e.target.value)}>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Ditt navn</span>
          <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="F.eks. Celine" />
        </label>
        <label className="field">
          <span>Passord</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error && <div className="error" role="alert">{error}</div>}

        <button type="submit" disabled={disabled} className="submit">
          {busy ? 'Logger inn …' : 'Logg inn'}
        </button>
      </form>

      <style>{`
        .login { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 16px; background: ${colors.bg}; }
        .card {
          width: 100%; max-width: 380px; background: ${colors.surface}; border: 1px solid ${colors.border};
          border-radius: 18px; padding: 36px 28px 28px; display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 16px 50px rgba(0,0,0,.35);
        }
        .head { margin-bottom: 8px; text-align: center; }
        .logo { display: block; width: 150px; height: auto; margin: 4px auto 28px; }
        .head h1 { margin: 0 0 6px; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: ${colors.ink}; }
        .head p { margin: 0; font-size: 14px; color: ${colors.muted}; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field span { font-size: 13px; font-weight: 600; color: ${colors.text}; }
        .field input, .field select {
          width: 100%; box-sizing: border-box; padding: 11px 13px; font-size: 15px; color: ${colors.ink};
          background: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 10px; outline: none;
        }
        .field input:focus, .field select:focus { border-color: ${colors.accent}; }
        .field input::placeholder { color: ${colors.muted}; }
        .error { font-size: 13px; font-weight: 600; color: ${colors.danger}; }
        .submit {
          margin-top: 6px; padding: 13px; font-size: 15px; font-weight: 700; border: none; border-radius: 10px;
          background: ${colors.accent}; color: ${colors.accentText}; cursor: pointer; transition: background .15s, opacity .15s;
        }
        .submit:hover:not(:disabled) { background: ${colors.accentHover}; }
        .submit:disabled { opacity: .35; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
