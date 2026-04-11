'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'
import { getTodayAssessments } from '@/lib/assessments'

const bg = '#0C0F14'
const surface = '#141820'
const surfaceAlt = '#1A1F2A'
const border = '#252B38'
const text = '#E8ECF4'
const muted = '#7B8499'
const dim = '#4A5268'
const accent = '#3B82F6'
const success = '#22C55E'
const danger = '#EF4444'
const warning = '#F59E0B'
const purple = '#A78BFA'

export default function Dashboard() {
  const { staff, loading } = useStaff()
  const [assessments, setAssessments] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, prescribed: 0, referred: 0, pending: 0 })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!staff) return
    async function load() {
      const data = await getTodayAssessments(staff.pharmacy_id)
      setAssessments(data)
      setStats({
        total: data.length,
        prescribed: data.filter((a: any) => a.outcome === 'prescribed').length,
        referred: data.filter((a: any) => a.outcome === 'referred_physician').length,
        pending: data.filter((a: any) => a.status === 'draft' || a.status === 'in_progress').length,
      })
    }
    load()
  }, [staff])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>RxAssess</div>
            <div style={{ fontSize: 11, color: dim }}>{staff.pharmacies?.name || 'Dashboard'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: muted }}>{staff.first_name} {staff.last_name}, RPh</span>
          <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* New Assessment Button */}
        <button onClick={() => router.push('/assess/UTI')} style={{ width: '100%', padding: 16, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${accent}, #8B5CF6)`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 24, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}>
          + New Minor Ailment Assessment
        </button>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: "Today's Total", value: stats.total, color: accent },
            { label: 'Prescribed', value: stats.prescribed, color: success },
            { label: 'Referred', value: stats.referred, color: warning },
            { label: 'In Progress', value: stats.pending, color: purple },
          ].map(s => (
            <div key={s.label} style={{ padding: 16, background: surface, borderRadius: 10, border: `1px solid ${border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Today's Assessments */}
        <div style={{ background: surface, borderRadius: 10, border: `1px solid ${border}` }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Today's Assessments</span>
            <span style={{ fontSize: 12, color: dim }}>{new Date().toLocaleDateString('en-CA', { dateStyle: 'long' })}</span>
          </div>

          {assessments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: dim, fontSize: 14 }}>
              No assessments yet today. Click above to start one.
            </div>
          ) : (
            assessments.map((a: any) => (
              <div key={a.id} style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {a.patients?.last_name}, {a.patients?.first_name}
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                    {a.minor_ailments?.name} — {new Date(a.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: a.status === 'completed' ? 'rgba(34,197,94,0.12)' : a.status === 'in_progress' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
                    color: a.status === 'completed' ? success : a.status === 'in_progress' ? warning : accent,
                    border: `1px solid ${a.status === 'completed' ? 'rgba(34,197,94,0.25)' : a.status === 'in_progress' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.25)'}`,
                  }}>
                    {a.status === 'completed' ? '✓ Complete' : a.status === 'in_progress' ? 'In Progress' : 'Draft'}
                  </span>
                  {a.outcome && (
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: a.outcome === 'prescribed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      color: a.outcome === 'prescribed' ? success : warning,
                      border: `1px solid ${a.outcome === 'prescribed' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    }}>
                      {a.outcome === 'prescribed' ? 'Rx' : 'Referred'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 24, padding: 24, textAlign: 'center', fontSize: 10, color: dim }}>
          RXASSESS v0.1 — PIPEDA / PHIPA COMPLIANT — DATA RESIDENCY: CA-CENTRAL-1 — © XCELRX INC.
        </div>
      </div>
    </div>
  )
}