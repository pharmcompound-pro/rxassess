'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const bg = '#0C0F14'
const surface = '#141820'
const surfaceAlt = '#1A1F2A'
const border = '#252B38'
const text = '#E8ECF4'
const muted = '#7B8499'
const dim = '#4A5268'
const accent = '#3B82F6'
const danger = '#EF4444'
const success = '#22C55E'

export default function Signup() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    ocpNumber: '',
    pharmacyName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const router = useRouter()
  const supabase = createClient()

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.'); return
    }
    if (!form.ocpNumber.trim()) {
      setError('OCP registration number is required.'); return
    }
    if (!form.pharmacyName.trim()) {
      setError('Pharmacy name is required.'); return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.'); return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.'); return
    }

    setLoading(true)

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          ocp_number: form.ocpNumber.trim(),
          pharmacy_name: form.pharmacyName.trim(),
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Signup failed. Please try again.')
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // 2. Check if pharmacy already exists, or create new
    let pharmacyId = ''
    const { data: existingPharmacy } = await supabase
      .from('pharmacies')
      .select('id')
      .ilike('name', form.pharmacyName.trim())
      .limit(1)
      .single()

    if (existingPharmacy) {
      pharmacyId = existingPharmacy.id
    } else {
      const { data: newPharmacy, error: pharmError } = await supabase
        .from('pharmacies')
        .insert({
          name: form.pharmacyName.trim(),
          province: 'ON',
          created_by: userId,
        })
        .select()
        .single()

      if (pharmError || !newPharmacy) {
        setError('Failed to create pharmacy: ' + (pharmError?.message || 'Unknown error'))
        setLoading(false)
        return
      }
      pharmacyId = newPharmacy.id
    }

    // 3. Create staff record
    const { error: staffError } = await supabase
      .from('staff')
      .insert({
        id: userId,
        pharmacy_id: pharmacyId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email,
        role: 'pharmacist',
        ocp_registration_number: form.ocpNumber.trim(),
        is_active: true,
      })

    if (staffError) {
      setError('Failed to create staff record: ' + staffError.message)
      setLoading(false)
      return
    }

    setLoading(false)

    // Check if email confirmation is required
    if (authData.user && !authData.session) {
      setStep('verify')
    } else {
      router.push('/dashboard')
    }
  }

  if (step === 'verify') {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 380, padding: 32, background: surface, borderRadius: 12, border: `1px solid ${border}`, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid rgba(34,197,94,0.3)', fontSize: 28 }}>✉</div>
          <h2 style={{ color: text, fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Check Your Email</h2>
          <p style={{ color: muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: text }}>{form.email}</strong>. Click the link to activate your account.
          </p>
          <button onClick={() => router.push('/login')} style={{ padding: '10px 24px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 420, padding: 32, background: surface, borderRadius: 12, border: `1px solid ${border}` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: text }}>RxAssess</div>
            <div style={{ fontSize: 11, color: dim }}>Create Your Account</div>
          </div>
        </div>

        <form onSubmit={handleSignup}>
          {/* Name row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>First Name <span style={{ color: danger }}>*</span></label>
              <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Last Name <span style={{ color: danger }}>*</span></label>
              <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* OCP Number */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>OCP Registration Number <span style={{ color: danger }}>*</span></label>
          <input type="text" value={form.ocpNumber} onChange={e => update('ocpNumber', e.target.value)} placeholder="e.g., 615561" required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />

          {/* Pharmacy Name */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Pharmacy Name <span style={{ color: danger }}>*</span></label>
          <input type="text" value={form.pharmacyName} onChange={e => update('pharmacyName', e.target.value)} placeholder="e.g., Orleans Community Pharmacy" required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />

          {/* Email */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Email <span style={{ color: danger }}>*</span></label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />

          {/* Password */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Password <span style={{ color: danger }}>*</span></label>
          <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min 8 characters" required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />

          {/* Confirm Password */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Confirm Password <span style={{ color: danger }}>*</span></label>
          <input type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, marginBottom: 20, outline: 'none', boxSizing: 'border-box' }} />

          {/* Error */}
          {error && (
            <div style={{ padding: 10, borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: danger, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${accent}, #8B5CF6)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign In Link */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: muted }}>Already have an account? </span>
          <span onClick={() => router.push('/login')} style={{ fontSize: 13, color: accent, cursor: 'pointer', fontWeight: 600 }}>Sign In</span>
        </div>

        <div style={{ marginTop: 20, fontSize: 10, color: dim, textAlign: 'center' }}>
          RXASSESS — PIPEDA / PHIPA COMPLIANT
        </div>
      </div>
    </div>
  )
}
