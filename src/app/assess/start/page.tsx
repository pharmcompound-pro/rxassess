'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'
import { createClient } from '@/lib/supabase/client'

const bg = '#0C0F14'
const surface = '#141820'
const surfaceAlt = '#1A1F2A'
const border = '#252B38'
const text = '#E8ECF4'
const muted = '#7B8499'
const dim = '#4A5268'
const accent = '#3B82F6'

const categoryColors: Record<string, string> = {
  'Dermatological': '#F59E0B',
  'ENT': '#8B5CF6',
  'Oral': '#EC4899',
  'Ophthalmological': '#06B6D4',
  'Gastrointestinal': '#22C55E',
  'Gynecological': '#F43F5E',
  'Infectious': '#EF4444',
  'Musculoskeletal': '#3B82F6',
  'Obstetric': '#A78BFA',
}

export default function StartAssessment() {
  const { staff, loading } = useStaff()
  const [ailments, setAilments] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('minor_ailments')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setAilments(data || [])
    }
    load()
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  const filtered = ailments.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    (a.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const categories = [...new Set(filtered.map(a => a.category))].sort()

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>RxAssess</div>
            <div style={{ fontSize: 10, color: dim }}>SELECT MINOR AILMENT</div>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer' }}>← Dashboard</button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>New Assessment</h2>
        <p style={{ fontSize: 13, color: muted, margin: '0 0 20px' }}>Select the minor ailment to begin clinical documentation.</p>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ailments..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', marginBottom: 24, boxSizing: 'border-box' }}
        />

        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: categoryColors[cat] || muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${categoryColors[cat] || border}` }}>
              {cat}
            </div>
            {filtered.filter(a => a.category === cat).map(a => (
              <div
                key={a.id}
                onClick={() => router.push(`/assess/${a.code}`)}
                style={{ padding: '14px 16px', background: surface, borderRadius: 8, border: `1px solid ${border}`, marginBottom: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: dim, marginTop: 2 }}>
                    ODB: {a.odb_service_code} · Max {a.max_annual_claims} claims/year · ${(a.consultation_fee_cents / 100).toFixed(2)}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: dim }}>→</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}