'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0C0F14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 380,
        padding: 32,
        background: '#141820',
        borderRadius: 12,
        border: '1px solid #252B38',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 15, color: '#fff',
          }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#E8ECF4' }}>RxAssess</div>
            <div style={{ fontSize: 11, color: '#4A5268' }}>Minor Ailment Documentation</div>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7B8499', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #252B38', background: '#1A1F2A', color: '#E8ECF4', fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#7B8499', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #252B38', background: '#1A1F2A', color: '#E8ECF4', fontSize: 14, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }} />

          {error && (
            <div style={{ padding: 10, borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 10, color: '#4A5268', textAlign: 'center' }}>
          PIPEDA / PHIPA COMPLIANT — DATA RESIDENCY: CA-CENTRAL-1
        </div>
      </div>
    </div>
  )
}