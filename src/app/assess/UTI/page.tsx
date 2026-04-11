'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'
import {
  getAilment, searchPatients, createPatient, createAssessment,
  saveDraft, completeAssessment, createPrescription,
  createPcpNotification, createClaim
} from '@/lib/assessments'

const DRUGS = [
  { drug: "Nitrofurantoin (MacroBID)", strength: "100mg", form: "capsule", sig: "100mg BID × 5 days", qty: 10, supply: 5, firstLine: true, notes: "Take with food. Avoid if CrCl < 30 mL/min.", contraFlag: "nitrofurantoin_ci" },
  { drug: "TMP-SMX (Septra DS)", strength: "160/800mg", form: "tablet", sig: "1 tab BID × 3 days", qty: 6, supply: 3, firstLine: false, notes: "Check sulfa allergy. Avoid in G6PD deficiency.", contraFlag: "sulfa_allergy" },
  { drug: "Fosfomycin (Monurol)", strength: "3g", form: "sachet", sig: "3g single dose in water", qty: 1, supply: 1, firstLine: false, notes: "Good for adherence concerns.", contraFlag: null },
]

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

function Toggle({ checked, onChange, label, isDanger }: any) {
  const color = isDanger ? danger : success
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 0' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 42, height: 24, borderRadius: 12, background: checked ? color : surfaceAlt, border: `1px solid ${checked ? color : border}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 13.5, color: text }}>{label}</span>
    </label>
  )
}

function Select({ label, value, onChange, options, required }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} {required && <span style={{ color: danger }}>*</span>}
      </label>
      <select value={value || ''} onChange={(e: any) => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none' }}>
        <option value="">— Select —</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type, required }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} {required && <span style={{ color: danger }}>*</span>}
      </label>
      <input type={type || 'text'} value={value || ''} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

function Textarea({ label, value, onChange, placeholder }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <textarea value={value || ''} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
    </div>
  )
}

export default function AssessUTI() {
  const { staff, loading: staffLoading } = useStaff()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [ailment, setAilment] = useState<any>(null)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form data
  const [patient, setPatient] = useState<any>({})
  const [elig, setElig] = useState<any>({})
  const [symptoms, setSymptoms] = useState<any>({})
  const [redFlags, setRedFlags] = useState<any>({})
  const [rx, setRx] = useState<any>({})

  // Patient search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isNewPatient, setIsNewPatient] = useState(false)

  useEffect(() => {
    async function load() {
      const data = await getAilment('UTI')
      setAilment(data)
    }
    load()
  }, [])

  useEffect(() => {
    if (!staff || !searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await searchPatients(staff.pharmacy_id, searchQuery)
      setSearchResults(results)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, staff])

  async function handleSelectPatient(p: any) {
    setPatientId(p.id)
    setPatient({
      firstName: p.first_name,
      lastName: p.last_name,
      dob: p.date_of_birth,
      hcn: p.health_card_number,
      phone: p.phone,
      pcpName: p.primary_care_provider_name,
      pcpFax: p.pcp_fax,
      hasPcp: p.has_pcp,
      allergies: p.allergies?.map((a: any) => a.allergen).join(', ') || '',
      medications: p.current_medications?.map((m: any) => m.drug).join(', ') || '',
    })
    setSearchQuery('')
    setSearchResults([])

    if (ailment && staff) {
      const { data } = await createAssessment(staff.pharmacy_id, p.id, staff.id, ailment.id)
      if (data) setAssessmentId(data.id)
    }
  }

  async function handleNewPatient() {
    if (!staff || !ailment) return
    setSaving(true)
    const { data: newPatient, error } = await createPatient(staff.pharmacy_id, staff.id, patient)
    if (error) {
      alert('Error creating patient: ' + error.message)
      setSaving(false)
      return
    }
    setPatientId(newPatient.id)
    const { data: assess } = await createAssessment(staff.pharmacy_id, newPatient.id, staff.id, ailment.id)
    if (assess) setAssessmentId(assess.id)
    setIsNewPatient(false)
    setSaving(false)
  }

  async function handleStepChange(newStep: number) {
    if (assessmentId) {
      await saveDraft(assessmentId, { patient, eligibility: elig, symptoms, redFlags, prescription: rx }, newStep)
    }
    setStep(newStep)
  }

  async function handleComplete() {
    if (!assessmentId || !staff || !ailment) return
    setSaving(true)

    const allData = { patient, eligibility: elig, symptoms, redFlags, prescription: rx }
    const outcome = Object.values(redFlags).some((v: any) => v === true) ? 'referred_physician' : 'prescribed'

    await completeAssessment(assessmentId, allData, outcome, rx.impression || '')

    if (rx.selectedDrug != null && outcome === 'prescribed') {
      const drug = DRUGS[rx.selectedDrug]
      await createPrescription(assessmentId, staff.pharmacy_id, patientId!, staff.id, drug)
    }

    if (patient.hasPcp !== false && patient.pcpName) {
      const letterContent = `Dear ${patient.pcpName},\n\nThis letter is to notify you that your patient ${patient.firstName} ${patient.lastName} (DOB: ${patient.dob}) presented at Orleans Community Pharmacy on ${new Date().toLocaleDateString('en-CA')} for assessment of Uncomplicated Urinary Tract Infection.\n\n${rx.impression || ''}\n\nRespectfully,\n${staff.first_name} ${staff.last_name}, RPh\nOCP #${staff.ocp_registration_number}`
      await createPcpNotification(assessmentId, patientId!, staff.pharmacy_id, { name: patient.pcpName, fax: patient.pcpFax }, letterContent)
    }

    await createClaim(assessmentId, staff.pharmacy_id, patientId!, ailment.odb_service_code, ailment.consultation_fee_cents)

    setSaving(false)
    setCompleted(true)
  }

  if (staffLoading) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  if (completed) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid rgba(34,197,94,0.3)', fontSize: 36 }}>✓</div>
          <h2 style={{ color: text, fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>Record locked and saved. PCP notification generated. ODB claim ready.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['RECORD LOCKED', 'CLAIM CREATED', 'PCP LETTER PENDING'].map(t => (
              <span key={t} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>{t}</span>
            ))}
          </div>
         <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.open(`/assess/print?id=${assessmentId}&mode=assessment`, '_blank')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print Assessment</button>
            <button onClick={() => window.open(`/assess/print?id=${assessmentId}&mode=pcp`, '_blank')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print PCP Letter</button>
            <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dashboard</button>
            <button onClick={() => { setCompleted(false); setStep(0); setPatient({}); setElig({}); setSymptoms({}); setRedFlags({}); setRx({}); setAssessmentId(null); setPatientId(null); }} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>New Assessment</button>
          </div>
        </div>
      </div>
    )
  }

  const steps = ['Patient', 'Eligibility', 'Symptoms', 'Red Flags', 'Prescribe', 'Review']
  const icons = ['👤', '☑', '🔍', '🚩', '💊', '📋']
  const isLast = step === steps.length - 1
  const eligExcluded = (elig.sex === 'Male') || (elig.age16 === false) || ['Pregnant', 'Possibly pregnant'].includes(elig.pregnancy) || (elig.catheter === true) || (elig.recurrent === true)
  const anyRedFlag = Object.values(redFlags).some((v: any) => v === true)
  const hasSulfa = (patient.allergies || '').toLowerCase().includes('sulfa')

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      {/* Header */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>RxAssess</div>
            <div style={{ fontSize: 10, color: dim }}>MINOR AILMENT DOCUMENTATION</div>
          </div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}>UTI — Uncomplicated UTI</span>
      </div>

      {/* Steps */}
      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {steps.map((s, i) => (
          <button key={s} onClick={() => patientId && handleStepChange(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: i === step ? 'rgba(59,130,246,0.12)' : 'transparent', color: i === step ? accent : i < step ? success : dim, fontSize: 12, fontWeight: i === step ? 700 : 500, cursor: patientId ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            <span>{i < step ? '✓' : icons[i]}</span>{s}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div style={{ margin: '12px 24px 0', height: 3, background: surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((step + 1) / steps.length) * 100}%`, background: `linear-gradient(90deg, ${accent}, #8B5CF6)`, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{icons[step]} {steps[step]}</h2>
        <p style={{ fontSize: 12, color: dim, margin: '0 0 20px' }}>Step {step + 1} of {steps.length}</p>

        {/* STEP 0: Patient */}
        {step === 0 && !patientId && (
          <div>
            <Input label="Search Existing Patient" value={searchQuery} onChange={setSearchQuery} placeholder="Type last name or health card #..." />
            {searchResults.length > 0 && (
              <div style={{ background: surfaceAlt, borderRadius: 8, border: `1px solid ${border}`, marginBottom: 16 }}>
                {searchResults.map((p: any) => (
                  <div key={p.id} onClick={() => handleSelectPatient(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                    <strong>{p.last_name}, {p.first_name}</strong> — DOB: {p.date_of_birth} {p.health_card_number && `— HCN: ${p.health_card_number}`}
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', padding: '16px 0', color: dim, fontSize: 13 }}>— or —</div>
            <button onClick={() => setIsNewPatient(true)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px dashed ${border}`, background: 'transparent', color: accent, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Create New Patient</button>

            {isNewPatient && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="First Name" value={patient.firstName} onChange={(v: string) => setPatient({ ...patient, firstName: v })} required placeholder="Jane" />
                  <Input label="Last Name" value={patient.lastName} onChange={(v: string) => setPatient({ ...patient, lastName: v })} required placeholder="Doe" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="Date of Birth" value={patient.dob} onChange={(v: string) => setPatient({ ...patient, dob: v })} required type="date" />
                  <Input label="Health Card #" value={patient.hcn} onChange={(v: string) => setPatient({ ...patient, hcn: v })} placeholder="1234567890" />
                </div>
                <Input label="Phone" value={patient.phone} onChange={(v: string) => setPatient({ ...patient, phone: v })} placeholder="(613) 555-0123" />
                <Toggle checked={patient.hasPcp !== false} onChange={(v: boolean) => setPatient({ ...patient, hasPcp: v })} label="Has a primary care provider" />
                {patient.hasPcp !== false && (
                  <div>
                    <Input label="PCP Name" value={patient.pcpName} onChange={(v: string) => setPatient({ ...patient, pcpName: v })} placeholder="Dr. Smith" />
                    <Input label="PCP Fax" value={patient.pcpFax} onChange={(v: string) => setPatient({ ...patient, pcpFax: v })} placeholder="(613) 555-0199" />
                  </div>
                )}
                <Textarea label="Allergies" value={patient.allergies} onChange={(v: string) => setPatient({ ...patient, allergies: v })} placeholder="e.g., Sulfonamides – rash" />
                <Textarea label="Current Medications" value={patient.medications} onChange={(v: string) => setPatient({ ...patient, medications: v })} placeholder="e.g., Metformin 500mg BID" />
                <button onClick={handleNewPatient} disabled={saving || !patient.firstName || !patient.lastName || !patient.dob} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 12, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Creating...' : 'Create Patient & Start Assessment'}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 0 && patientId && (
          <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 8 }}>{patient.firstName} {patient.lastName}</div>
            <div style={{ fontSize: 13, color: muted }}>DOB: {patient.dob} {patient.hcn && `| HCN: ${patient.hcn}`}</div>
            <div style={{ fontSize: 13, color: muted }}>PCP: {patient.hasPcp !== false ? patient.pcpName || 'Not specified' : 'No PCP'}</div>
            <div style={{ fontSize: 13, color: muted }}>Allergies: {patient.allergies || 'NKDA'}</div>
            <div style={{ marginTop: 8, padding: '4px 10px', display: 'inline-block', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>✓ Patient Selected</div>
          </div>
        )}

        {/* STEP 1: Eligibility */}
        {step === 1 && (
          <div>
            <Toggle checked={elig.age16 === true} onChange={(v: boolean) => setElig({ ...elig, age16: v })} label="Patient is ≥ 16 years of age" />
            <Select label="Sex at birth" value={elig.sex} onChange={(v: string) => setElig({ ...elig, sex: v })} options={['Female', 'Male', 'Intersex']} required />
            <Select label="Pregnancy status" value={elig.pregnancy} onChange={(v: string) => setElig({ ...elig, pregnancy: v })} options={['Not pregnant', 'Pregnant', 'Possibly pregnant', 'Breastfeeding']} required />
            <Toggle checked={elig.catheter === false} onChange={(v: boolean) => setElig({ ...elig, catheter: !v })} label="No indwelling urinary catheter" />
            <Toggle checked={elig.recurrent === false} onChange={(v: boolean) => setElig({ ...elig, recurrent: !v })} label="Not recurrent (< 3 episodes in 12 months)" />
            {eligExcluded && (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontWeight: 700, color: danger, fontSize: 14, marginBottom: 4 }}>⊘ Patient Excluded</div>
                <div style={{ fontSize: 13, color: text }}>Does not meet eligibility criteria. Refer to physician.</div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Symptoms */}
        {step === 2 && (
          <div>
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Lower Urinary Tract Symptoms</div>
              <Toggle checked={symptoms.dysuria} onChange={(v: boolean) => setSymptoms({ ...symptoms, dysuria: v })} label="Dysuria (painful/burning urination)" />
              <Toggle checked={symptoms.frequency} onChange={(v: boolean) => setSymptoms({ ...symptoms, frequency: v })} label="Urinary frequency" />
              <Toggle checked={symptoms.urgency} onChange={(v: boolean) => setSymptoms({ ...symptoms, urgency: v })} label="Urinary urgency" />
            </div>
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Additional Symptoms</div>
              <Toggle checked={symptoms.suprapubic} onChange={(v: boolean) => setSymptoms({ ...symptoms, suprapubic: v })} label="Suprapubic pain or pressure" />
              <Toggle checked={symptoms.hematuria} onChange={(v: boolean) => setSymptoms({ ...symptoms, hematuria: v })} label="Hematuria (blood in urine)" />
              <Toggle checked={symptoms.cloudy} onChange={(v: boolean) => setSymptoms({ ...symptoms, cloudy: v })} label="Cloudy or foul-smelling urine" />
            </div>
            <Select label="Symptom duration" value={symptoms.duration} onChange={(v: string) => setSymptoms({ ...symptoms, duration: v })} options={['< 24 hours', '1–3 days', '4–7 days', '> 7 days']} required />
            {symptoms.duration === '> 7 days' && (
              <div style={{ padding: 14, background: 'rgba(245,158,11,0.12)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', fontSize: 13, color: warning }}>⚠ Symptoms &gt; 7 days — consider referral.</div>
            )}
            <Textarea label="Additional Notes" value={symptoms.notes} onChange={(v: string) => setSymptoms({ ...symptoms, notes: v })} placeholder="Any other relevant details..." />
          </div>
        )}

        {/* STEP 3: Red Flags */}
        {step === 3 && (
          <div>
            <div style={{ padding: 14, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', marginBottom: 20, fontSize: 13, color: text }}>
              <strong style={{ color: danger }}>⚠ Red Flag Screen</strong> — Any positive finding requires referral. Toggle ON only if PRESENT.
            </div>
            {[
              ['fever', 'Fever > 38°C or chills'],
              ['flankPain', 'Flank pain or CVA tenderness'],
              ['nauseaVomiting', 'Nausea or vomiting'],
              ['vaginalDischarge', 'Vaginal discharge present'],
              ['immunocompromised', 'Immunocompromised status'],
              ['uncontrolledDM', 'Poorly controlled diabetes'],
              ['recentInstrumentation', 'Recent urinary tract instrumentation'],
              ['treatmentFailure', 'Symptoms recurred within 2 weeks of prior treatment'],
            ].map(([id, label]) => (
              <Toggle key={id} checked={redFlags[id] === true} onChange={(v: boolean) => setRedFlags({ ...redFlags, [id]: v })} label={label} isDanger />
            ))}
            {anyRedFlag ? (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontWeight: 700, color: danger, fontSize: 14, marginBottom: 4 }}>🚨 Red Flag(s) — Refer Patient</div>
                <div style={{ fontSize: 13, color: text }}>Beyond pharmacist prescribing scope. Refer to physician or ED.</div>
              </div>
            ) : (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(34,197,94,0.12)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, color: success, fontSize: 14 }}>✓ No red flags identified</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Prescribe */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 16, textTransform: 'uppercase' }}>Select Treatment</div>
            {DRUGS.map((d, i) => {
              const selected = rx.selectedDrug === i
              const ci = (d.contraFlag === 'sulfa_allergy' && hasSulfa)
              return (
                <div key={i} onClick={() => !ci && setRx({ ...rx, selectedDrug: i })} style={{ padding: 16, borderRadius: 10, cursor: ci ? 'not-allowed' : 'pointer', background: selected ? 'rgba(59,130,246,0.12)' : surfaceAlt, border: `2px solid ${selected ? accent : ci ? 'rgba(239,68,68,0.3)' : border}`, opacity: ci ? 0.5 : 1, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{d.drug}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {d.firstLine && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>1st LINE</span>}
                      {ci && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: danger, border: '1px solid rgba(239,68,68,0.25)' }}>CI</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginBottom: 4 }}>{d.sig}</div>
                  <div style={{ fontSize: 12, color: dim }}>{d.notes}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: muted }}>
                    <span>Qty: {d.qty}</span><span>Days: {d.supply}</span><span>ODB eligible</span>
                  </div>
                </div>
              )
            })}
            <Textarea label="Clinical Impression / Rationale" value={rx.impression} onChange={(v: string) => setRx({ ...rx, impression: v })} placeholder="e.g., 24-year-old female with 2-day dysuria and frequency. No red flags. Consistent with uncomplicated lower UTI." />
            <Textarea label="Counselling Notes" value={rx.counselling} onChange={(v: string) => setRx({ ...rx, counselling: v })} placeholder="Complete full course. Increase fluids. Return if symptoms worsen in 48–72h." />
          </div>
        )}

        {/* STEP 5: Review */}
        {step === 5 && (
          <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
            {[
              { title: 'Patient', rows: [['Name', `${patient.firstName} ${patient.lastName}`], ['DOB', patient.dob], ['HCN', patient.hcn || 'N/A'], ['PCP', patient.pcpName || 'No PCP'], ['Allergies', patient.allergies || 'NKDA']] },
              { title: 'Eligibility', rows: [['Age ≥ 16', elig.age16 ? 'Yes' : '—'], ['Sex', elig.sex], ['Pregnancy', elig.pregnancy], ['Catheter', elig.catheter === false ? 'No' : 'Yes'], ['Recurrent', elig.recurrent === false ? 'No' : 'Yes']] },
              { title: 'Symptoms', rows: [[' ', [symptoms.dysuria && 'Dysuria', symptoms.frequency && 'Frequency', symptoms.urgency && 'Urgency', symptoms.suprapubic && 'Suprapubic pain', symptoms.hematuria && 'Hematuria', symptoms.cloudy && 'Cloudy urine'].filter(Boolean).join(', ') || 'None'], ['Duration', symptoms.duration]] },
              { title: 'Red Flags', rows: [['Status', anyRedFlag ? '⚠ POSITIVE' : '✓ None']] },
              { title: 'Treatment', rows: rx.selectedDrug != null ? [['Drug', DRUGS[rx.selectedDrug].drug], ['Sig', DRUGS[rx.selectedDrug].sig], ['Qty', DRUGS[rx.selectedDrug].qty], ['Days', DRUGS[rx.selectedDrug].supply]] : [['Drug', 'Not selected']] },
              { title: 'Billing', rows: [['Code', 'MA-UTI'], ['Fee', '$18.00']] },
              { title: 'Pharmacist', rows: [[' ', `${staff?.first_name} ${staff?.last_name}, RPh — OCP #${staff?.ocp_registration_number}`]] },
            ].map(section => (
              <div key={section.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 6, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>{section.title}</div>
                {section.rows.map(([label, value], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                    <span style={{ color: muted, fontWeight: 600 }}>{label}</span>
                    <span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ marginTop: 20, padding: 14, background: 'rgba(245,158,11,0.12)', borderRadius: 8, fontSize: 12, color: text, border: '1px solid rgba(245,158,11,0.25)' }}>
              <strong style={{ color: warning }}>PCP Notification Required</strong> — A notification letter will be auto-generated upon completion.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${border}` }}>
          <button onClick={() => handleStepChange(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: '12px 24px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: step === 0 ? dim : text, fontSize: 14, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.3 : 1 }}>← Back</button>
          {isLast ? (
            <button onClick={handleComplete} disabled={saving} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${success}, #16A34A)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.3)', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Complete & Lock Record ✓'}
            </button>
          ) : (
            <button onClick={() => handleStepChange(step + 1)} disabled={step === 0 && !patientId} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', opacity: (step === 0 && !patientId) ? 0.5 : 1 }}>Continue →</button>
          )}
        </div>
      </div>

      <div style={{ padding: 24, textAlign: 'center', borderTop: `1px solid ${border}`, marginTop: 40, fontSize: 10, color: dim }}>
        RXASSESS v0.1 — PIPEDA / PHIPA COMPLIANT — DATA RESIDENCY: CA-CENTRAL-1 — © XCELRX INC.
      </div>
    </div>
  )
}