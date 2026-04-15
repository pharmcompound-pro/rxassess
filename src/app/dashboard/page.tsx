'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'
import { getTodayAssessments, getFollowUps, completeFollowUp } from '@/lib/assessments'

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
  const [followUps, setFollowUps] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, prescribed: 0, referred: 0, pending: 0 })
  const [completing, setCompleting] = useState<string | null>(null)
  const [completeForm, setCompleteForm] = useState<{ outcome: string; notes: string }>({ outcome: '', notes: '' })
  const [filter, setFilter] = useState<string | null>(null)
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
      const fups = await getFollowUps(staff.pharmacy_id)
      setFollowUps(fups)
    }
    load()
  }, [staff])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleCompleteFollowUp(id: string) {
    if (!completeForm.outcome || !staff) return
    await completeFollowUp(id, staff.id, completeForm.outcome, completeForm.notes)
    setFollowUps(prev => prev.filter(f => f.id !== id))
    setCompleting(null)
    setCompleteForm({ outcome: '', notes: '' })
  }

  if (loading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  // Categorize follow-ups
  const now = new Date()
  const overdue = followUps.filter(f => new Date(f.due_date) < now)
  const dueToday = followUps.filter(f => {
    const d = new Date(f.due_date)
    return d >= now && d.toDateString() === now.toDateString()
  })
  const upcoming = followUps.filter(f => {
    const d = new Date(f.due_date)
    return d > now && d.toDateString() !== now.toDateString()
  })
  const followUpCount = overdue.length + dueToday.length + upcoming.length

  function formatDue(dateStr: string) {
    const d = new Date(dateStr)
    const diff = d.getTime() - now.getTime()
    const hours = Math.round(diff / (1000 * 60 * 60))
    const days = Math.round(diff / (1000 * 60 * 60 * 24))
    if (hours < 0) {
      const absH = Math.abs(hours)
      return absH < 24 ? `${absH}h overdue` : `${Math.abs(days)}d overdue`
    }
    if (hours < 24) return `in ${hours}h`
    return `in ${days}d`
  }

  function FollowUpRow({ f, tag }: { f: any; tag: 'overdue' | 'today' | 'upcoming' }) {
    const tagColors: any = {
      overdue: { bg: 'rgba(239,68,68,0.12)', color: danger, border: 'rgba(239,68,68,0.25)', label: 'OVERDUE' },
      today: { bg: 'rgba(245,158,11,0.12)', color: warning, border: 'rgba(245,158,11,0.25)', label: 'DUE TODAY' },
      upcoming: { bg: 'rgba(59,130,246,0.12)', color: accent, border: 'rgba(59,130,246,0.25)', label: 'UPCOMING' },
    }
    const t = tagColors[tag]
    const isCompleting = completing === f.id

    return (
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: text }}>
              {f.patients?.last_name}, {f.patients?.first_name}
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {f.assessments?.minor_ailments?.name} — {f.follow_up_method || 'Method TBD'}
            </div>
            {f.follow_up_plan && <div style={{ fontSize: 11, color: dim, marginTop: 2 }}>{f.follow_up_plan}</div>}
            {f.patients?.phone && <div style={{ fontSize: 11, color: dim, marginTop: 2 }}>Tel: {f.patients.phone}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
              {t.label}
            </span>
            <span style={{ fontSize: 11, color: t.color, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
              {formatDue(f.due_date)}
            </span>
          </div>
        </div>

        {/* Complete button */}
        {!isCompleting && (
          <button onClick={() => setCompleting(f.id)} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: `1px solid ${border}`, background: surfaceAlt, color: muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Document Follow-Up
          </button>
        )}

        {/* Completion form */}
        {isCompleting && (
          <div style={{ marginTop: 10, padding: 12, background: surfaceAlt, borderRadius: 8, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Follow-Up Outcome</div>
            <select
              value={completeForm.outcome}
              onChange={(e) => setCompleteForm({ ...completeForm, outcome: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, marginBottom: 8 }}
            >
              <option value="">— Select outcome —</option>
              <option value="improved">Improved — continue current therapy</option>
              <option value="resolved">Resolved — discontinue therapy</option>
              <option value="no_change">No change — adjust therapy</option>
              <option value="worsened">Worsened — escalate/refer</option>
              <option value="referred">Referred to physician/NP/ED</option>
              <option value="unable_to_reach">Unable to reach patient</option>
              <option value="patient_no_show">Patient did not attend</option>
            </select>
            <textarea
              value={completeForm.notes}
              onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
              placeholder="Clinical notes..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => handleCompleteFollowUp(f.id)}
                disabled={!completeForm.outcome}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: success, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: completeForm.outcome ? 1 : 0.5 }}
              >
                Complete ✓
              </button>
              <button
                onClick={() => { setCompleting(null); setCompleteForm({ outcome: '', notes: '' }) }}
                style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

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
        <button onClick={() => router.push('/assess/start')} style={{ width: '100%', padding: 16, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${accent}, #8B5CF6)`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 24, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}>
          + New Minor Ailment Assessment
        </button>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: "Today's Total", value: stats.total, color: accent, key: 'total' },
            { label: 'Prescribed', value: stats.prescribed, color: success, key: 'prescribed' },
            { label: 'Referred', value: stats.referred, color: warning, key: 'referred' },
            { label: 'In Progress', value: stats.pending, color: purple, key: 'pending' },
            { label: 'Follow-Ups', value: followUpCount, color: overdue.length > 0 ? danger : accent, key: 'followups' },
          ].map(s => (
            <div key={s.label} onClick={() => setFilter(filter === s.key ? null : s.key)} style={{ padding: 16, background: filter === s.key ? 'rgba(59,130,246,0.08)' : surface, borderRadius: 10, border: `1px solid ${filter === s.key ? accent : border}`, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: filter === s.key ? accent : muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}{filter === s.key ? ' ✕' : ''}</div>
            </div>
          ))}
        </div>

        {/* ==================== FOLLOW-UP WIDGET ==================== */}
        {followUpCount > 0 && (
          <div style={{ background: surface, borderRadius: 10, border: `1px solid ${overdue.length > 0 ? 'rgba(239,68,68,0.4)' : border}`, marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Follow-Up Queue</span>
                {overdue.length > 0 && (
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: danger, border: '1px solid rgba(239,68,68,0.3)' }}>
                    {overdue.length} OVERDUE
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: dim }}>{followUpCount} pending</span>
            </div>

            {/* Overdue */}
            {overdue.map(f => <FollowUpRow key={f.id} f={f} tag="overdue" />)}
            {/* Due Today */}
            {dueToday.map(f => <FollowUpRow key={f.id} f={f} tag="today" />)}
            {/* Upcoming (show max 5) */}
            {upcoming.slice(0, 5).map(f => <FollowUpRow key={f.id} f={f} tag="upcoming" />)}
            {upcoming.length > 5 && (
              <div style={{ padding: '10px 20px', textAlign: 'center', fontSize: 12, color: dim }}>
                + {upcoming.length - 5} more upcoming follow-ups
              </div>
            )}
          </div>
        )}

        {/* ==================== TODAY'S ASSESSMENTS ==================== */}
        {(() => {
          const filterLabels: Record<string, string> = { total: "All Today's Assessments", prescribed: 'Prescribed', referred: 'Referred', pending: 'In Progress / Draft' }
          const filtered = !filter || filter === 'total' || filter === 'followups' ? assessments : assessments.filter((a: any) => {
            if (filter === 'prescribed') return a.outcome === 'prescribed'
            if (filter === 'referred') return a.outcome === 'referred_physician'
            if (filter === 'pending') return a.status === 'draft' || a.status === 'in_progress'
            return true
          })
          const title = filter && filter !== 'total' && filter !== 'followups' ? filterLabels[filter] || "Today's Assessments" : "Today's Assessments"

          return (
        <div style={{ background: surface, borderRadius: 10, border: `1px solid ${border}` }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
              {filter && filter !== 'total' && filter !== 'followups' && (
                <button onClick={(e) => { e.stopPropagation(); setFilter(null) }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.12)', color: accent, border: `1px solid rgba(59,130,246,0.25)`, cursor: 'pointer' }}>Clear filter ✕</button>
              )}
            </div>
            <span style={{ fontSize: 12, color: dim }}>{new Date().toLocaleDateString('en-CA', { dateStyle: 'long' })} — {filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: dim, fontSize: 14 }}>
              {filter ? `No ${title.toLowerCase()} found.` : 'No assessments yet today. Click above to start one.'}
            </div>
          ) : (
            filtered.map((a: any) => (
              <div key={a.id} onClick={() => {
                if (a.status === 'completed') {
                  // Show both print and PCP letter options
                  const action = window.confirm('View assessment record?\n\nOK = View Record\nCancel = Print PCP Letter')
                  if (action) window.open(`/assess/print?id=${a.id}&mode=assessment`, '_blank')
                  else window.open(`/assess/print?id=${a.id}&mode=pcp`, '_blank')
                }
                else if (a.status === 'in_progress' || a.status === 'draft') router.push(`/assess/${a.minor_ailments?.code}?resume=${a.id}`)
              }} style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.background = surfaceAlt} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
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
                  {a.status === 'completed' && (
                    <span style={{ fontSize: 11, color: dim }}>View →</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
          )
        })()}

        <div style={{ marginTop: 24, padding: 24, textAlign: 'center', fontSize: 10, color: dim }}>
          RXASSESS v0.2 — PIPEDA / PHIPA COMPLIANT — DATA RESIDENCY: CA-CENTRAL-1 — © XCELRX INC.
        </div>
      </div>
    </div>
  )
}
