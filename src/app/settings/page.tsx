'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'

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

export default function Settings() {
  const { staff, loading } = useStaff()
  const router = useRouter()
  const supabase = createClient()
  const [activeSection, setActiveSection] = useState<'pharmacy' | 'profile'>('pharmacy')

  if (loading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>RxAssess</div>
            <div style={{ fontSize: 11, color: dim }}>Settings</div>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>← Dashboard</button>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ background: surface, borderRadius: 10, border: `1px solid ${border}`, padding: 8, height: 'fit-content' }}>
          {[
            { key: 'pharmacy', label: 'Pharmacy', available: true },
            { key: 'profile', label: 'Profile', available: false },
          ].map(item => (
            <div
              key={item.key}
              onClick={() => item.available && setActiveSection(item.key as any)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: item.available ? 'pointer' : 'not-allowed',
                background: activeSection === item.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: activeSection === item.key ? accent : (item.available ? text : dim),
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{item.label}</span>
              {!item.available && <span style={{ fontSize: 10, color: dim, fontWeight: 500 }}>Soon</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeSection === 'pharmacy' && <PharmacySettings staff={staff} />}
        </div>
      </div>
    </div>
  )
}

function PharmacySettings({ staff }: { staff: any }) {
  const supabase = createClient()
  const [pharmacy, setPharmacy] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('pharmacies').select('*').eq('id', staff.pharmacy_id).single()
      setPharmacy(data || {})
    }
    load()
  }, [staff.pharmacy_id])

  function update(field: string, value: string) {
    setPharmacy((prev: any) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('pharmacies')
      .update({
        name: pharmacy.name,
        ocp_accreditation_number: pharmacy.ocp_accreditation_number,
        address_line1: pharmacy.address_line1,
        address_line2: pharmacy.address_line2,
        city: pharmacy.city,
        province: pharmacy.province || 'ON',
        postal_code: pharmacy.postal_code,
        phone: pharmacy.phone,
        fax: pharmacy.fax,
        email: pharmacy.email,
        manager_name: pharmacy.manager_name,
      })
      .eq('id', staff.pharmacy_id)
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: 'Save failed: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Settings saved.' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (!pharmacy) return <div style={{ color: muted }}>Loading pharmacy...</div>

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={pharmacy[key] || ''}
        onChange={e => update(key, e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ background: surface, borderRadius: 10, border: `1px solid ${border}`, padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: text }}>Pharmacy Information</h2>
        <p style={{ fontSize: 13, color: muted, margin: '4px 0 0' }}>
          Required for PCP letters, prescription printing, and ODB claims.
        </p>
      </div>

      {field('Pharmacy Name', 'name', 'text', 'e.g., Orleans Community Pharmacy')}
      {field('OCP Accreditation Number', 'ocp_accreditation_number', 'text', 'e.g., 300123')}
      {field('Manager Name', 'manager_name', 'text', 'e.g., Jane Smith, RPh')}

      <div style={{ marginTop: 24, marginBottom: 12, fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Address</div>

      {field('Address Line 1', 'address_line1', 'text', '123 Main Street')}
      {field('Address Line 2', 'address_line2', 'text', 'Suite 100')}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>City</label>
          <input type="text" value={pharmacy.city || ''} onChange={e => update('city', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Province</label>
          <select value={pharmacy.province || 'ON'} onChange={e => update('province', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none' }}>
            <option value="ON">ON</option>
            <option value="QC">QC</option>
            <option value="BC">BC</option>
            <option value="AB">AB</option>
            <option value="SK">SK</option>
            <option value="MB">MB</option>
            <option value="NS">NS</option>
            <option value="NB">NB</option>
            <option value="PE">PE</option>
            <option value="NL">NL</option>
            <option value="YT">YT</option>
            <option value="NT">NT</option>
            <option value="NU">NU</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Postal Code</label>
          <input type="text" value={pharmacy.postal_code || ''} onChange={e => update('postal_code', e.target.value.toUpperCase())} placeholder="K1K 1K1" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ marginTop: 24, marginBottom: 12, fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Contact</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Phone</label>
          <input type="tel" value={pharmacy.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="613-555-1234" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6 }}>Fax</label>
          <input type="tel" value={pharmacy.fax || ''} onChange={e => update('fax', e.target.value)} placeholder="613-555-1235" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {field('Email', 'email', 'email', 'pharmacy@example.com')}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginTop: 20,
          background: message.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: message.type === 'success' ? success : danger,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {message.type === 'success' ? '✓ ' : '⚠ '}{message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 20,
          padding: '12px 24px',
          borderRadius: 8,
          border: 'none',
          background: `linear-gradient(135deg, ${accent}, #8B5CF6)`,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
