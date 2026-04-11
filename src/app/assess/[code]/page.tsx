'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useStaff } from '@/lib/useStaff'
import { getAilment, searchPatients, createPatient, createAssessment, saveDraft, completeAssessment, createPrescription, createPcpNotification, createClaim } from '@/lib/assessments'

const bg = '#0C0F14', surface = '#141820', surfaceAlt = '#1A1F2A', border = '#252B38'
const text = '#E8ECF4', muted = '#7B8499', dim = '#4A5268'
const accent = '#3B82F6', success = '#22C55E', danger = '#EF4444', warning = '#F59E0B'

function Toggle({ checked, onChange, label, isDanger }: any) {
  const c = isDanger ? danger : success
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 0' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 42, height: 24, borderRadius: 12, background: checked ? c : surfaceAlt, border: `1px solid ${checked ? c : border}`, position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </div>
      <span style={{ fontSize: 13.5, color: text }}>{label}</span>
    </label>
  )
}

function Select({ label, value, onChange, options, required }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label} {required && <span style={{ color: danger }}>*</span>}</label>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label} {required && <span style={{ color: danger }}>*</span>}</label>
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

function DynamicSection({ section, data, setData }: any) {
  const hasRedFlag = section.fields?.some((f: any) => f.is_red_flag && data[f.id] === true)
  return (
    <div>
      <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.title}</div>
        {section.description && <p style={{ fontSize: 13, color: muted, marginBottom: 12 }}>{section.description}</p>}
        {section.fields?.map((field: any) => {
          switch (field.type) {
            case 'boolean':
              return <Toggle key={field.id} checked={data[field.id] === true} onChange={(v: boolean) => setData({ ...data, [field.id]: v })} label={field.label} isDanger={field.is_red_flag} />
            case 'select':
              return <Select key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} options={field.options || []} required={field.required} />
            case 'textarea':
              return <Textarea key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} placeholder="" />
            default:
              return <Input key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} required={field.required} />
          }
        })}
      </div>
      {hasRedFlag && (
        <div style={{ padding: 14, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: danger, fontSize: 14, marginBottom: 4 }}>🚨 Red Flag(s) Identified — Consider Referral</div>
          <div style={{ fontSize: 13, color: text }}>One or more red flags are present. This may be beyond pharmacist prescribing scope.</div>
        </div>
      )}
    </div>
  )
}

export default function DynamicAssessment() {
  const params = useParams()
  const code = params.code as string
  const { staff, loading: staffLoading } = useStaff()
  const router = useRouter()

  const [ailment, setAilment] = useState<any>(null)
  const [step, setStep] = useState(0)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  const [patient, setPatient] = useState<any>({})
  const [sectionData, setSectionData] = useState<Record<string, any>>({})
  const [rx, setRx] = useState<any>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isNewPatient, setIsNewPatient] = useState(false)

  useEffect(() => { async function load() { const d = await getAilment(code); setAilment(d) }; load() }, [code])

  useEffect(() => {
    if (!staff || !searchQuery || searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => { const r = await searchPatients(staff.pharmacy_id, searchQuery); setSearchResults(r) }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, staff])

  const template = ailment?.assessment_template
  const sections = template?.sections || []
  const drugs = ailment?.eligible_drugs || []

  // Steps: Patient, ...template sections, Prescribe, Review
  const stepNames = ['Patient', ...sections.map((s: any) => s.title), 'Prescribe', 'Review']
  const stepIcons = ['👤', ...sections.map(() => '📋'), '💊', '✓']
  const totalSteps = stepNames.length
  const isLast = step === totalSteps - 1
  const isPatientStep = step === 0
  const isPrescribeStep = step === totalSteps - 2
  const isReviewStep = step === totalSteps - 1
  const sectionIndex = step - 1

  async function handleSelectPatient(p: any) {
    setPatientId(p.id)
    setPatient({ firstName: p.first_name, lastName: p.last_name, dob: p.date_of_birth, hcn: p.health_card_number, phone: p.phone, pcpName: p.primary_care_provider_name, pcpFax: p.pcp_fax, hasPcp: p.has_pcp, allergies: p.allergies?.map((a: any) => a.allergen).join(', ') || '', medications: p.current_medications?.map((m: any) => m.drug).join(', ') || '' })
    setSearchQuery(''); setSearchResults([])
    if (ailment && staff) { const { data } = await createAssessment(staff.pharmacy_id, p.id, staff.id, ailment.id); if (data) setAssessmentId(data.id) }
  }

  async function handleNewPatient() {
    if (!staff || !ailment) return; setSaving(true)
    const { data: np, error } = await createPatient(staff.pharmacy_id, staff.id, patient)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setPatientId(np.id)
    const { data: a } = await createAssessment(staff.pharmacy_id, np.id, staff.id, ailment.id)
    if (a) setAssessmentId(a.id)
    setIsNewPatient(false); setSaving(false)
  }

  async function handleStepChange(n: number) {
    if (assessmentId) await saveDraft(assessmentId, { patient, sections: sectionData, prescription: rx }, n)
    setStep(n)
  }

  async function handleComplete() {
    if (!assessmentId || !staff || !ailment) return; setSaving(true)
    const allData = { patient, sections: sectionData, prescription: rx }
    const hasRedFlags = Object.values(sectionData).some((sec: any) => sec && typeof sec === 'object' && Object.entries(sec).some(([_, v]) => v === true))
    const outcome = hasRedFlags ? 'referred_physician' : rx.selectedDrug != null ? 'prescribed' : 'self_care'

    await completeAssessment(assessmentId, allData, outcome, rx.impression || '')

    if (rx.selectedDrug != null && outcome !== 'referred_physician') {
      const drug = drugs[rx.selectedDrug]
      await createPrescription(assessmentId, staff.pharmacy_id, patientId!, staff.id, drug)
    }

    if (patient.hasPcp !== false && patient.pcpName) {
      const drug = rx.selectedDrug != null ? drugs[rx.selectedDrug] : null
      const content = `Dear ${patient.pcpName},\n\nThis letter is to notify you that your patient ${patient.firstName} ${patient.lastName} (DOB: ${patient.dob}) presented at ${staff.pharmacies?.name || 'our pharmacy'} on ${new Date().toLocaleDateString('en-CA')} for assessment of ${ailment.name}.\n\n${rx.impression || ''}\n\n${drug ? `Treatment: ${drug.drug} — ${drug.sig}` : 'No prescription issued.'}\n\nRespectfully,\n${staff.first_name} ${staff.last_name}, RPh\nOCP #${staff.ocp_registration_number}`
      await createPcpNotification(assessmentId, patientId!, staff.pharmacy_id, { name: patient.pcpName, fax: patient.pcpFax }, content)
    }

    await createClaim(assessmentId, staff.pharmacy_id, patientId!, ailment.odb_service_code, ailment.consultation_fee_cents)
    setSaving(false); setCompleted(true)
  }

  if (staffLoading || !ailment) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  if (completed) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid rgba(34,197,94,0.3)', fontSize: 36 }}>✓</div>
          <h2 style={{ color: text, fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: muted, fontSize: 14, margin: '0 0 8px' }}>{ailment.name}</p>
          <p style={{ color: dim, fontSize: 13, margin: '0 0 24px' }}>Record locked. PCP notification generated. Claim ready.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['RECORD LOCKED', 'CLAIM CREATED', 'PCP LETTER PENDING'].map(t => (
              <span key={t} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>{t}</span>
            ))}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.open(`/assess/print?id=${assessmentId}&mode=assessment`, '_blank')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print Assessment</button>
            <button onClick={() => window.open(`/assess/print?id=${assessmentId}&mode=pcp`, '_blank')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Print PCP Letter</button>
            <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dashboard</button>
            <button onClick={() => router.push('/assess/start')} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>New Assessment</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>Rx</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>RxAssess</div>
            <div style={{ fontSize: 10, color: dim }}>MINOR AILMENT DOCUMENTATION</div>
          </div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}>{ailment.code} — {ailment.name}</span>
      </div>

      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {stepNames.map((s, i) => (
          <button key={s} onClick={() => patientId && handleStepChange(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: i === step ? 'rgba(59,130,246,0.12)' : 'transparent', color: i === step ? accent : i < step ? success : dim, fontSize: 12, fontWeight: i === step ? 700 : 500, cursor: patientId ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            <span>{i < step ? '✓' : stepIcons[i]}</span>{s}
          </button>
        ))}
      </div>

      <div style={{ margin: '12px 24px 0', height: 3, background: surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((step + 1) / totalSteps) * 100}%`, background: `linear-gradient(90deg, ${accent}, #8B5CF6)`, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{stepIcons[step]} {stepNames[step]}</h2>
        <p style={{ fontSize: 12, color: dim, margin: '0 0 20px' }}>Step {step + 1} of {totalSteps}</p>

        {/* Patient Step */}
        {isPatientStep && !patientId && (
          <div>
            <Input label="Search Existing Patient" value={searchQuery} onChange={setSearchQuery} placeholder="Type last name or health card #..." />
            {searchResults.length > 0 && (
              <div style={{ background: surfaceAlt, borderRadius: 8, border: `1px solid ${border}`, marginBottom: 16 }}>
                {searchResults.map((p: any) => (
                  <div key={p.id} onClick={() => handleSelectPatient(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                    <strong>{p.last_name}, {p.first_name}</strong> — DOB: {p.date_of_birth}
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', padding: '16px 0', color: dim, fontSize: 13 }}>— or —</div>
            <button onClick={() => setIsNewPatient(true)} style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px dashed ${border}`, background: 'transparent', color: accent, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Create New Patient</button>
            {isNewPatient && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="First Name" value={patient.firstName} onChange={(v: string) => setPatient({ ...patient, firstName: v })} required />
                  <Input label="Last Name" value={patient.lastName} onChange={(v: string) => setPatient({ ...patient, lastName: v })} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="Date of Birth" value={patient.dob} onChange={(v: string) => setPatient({ ...patient, dob: v })} required type="date" />
                  <Input label="Health Card #" value={patient.hcn} onChange={(v: string) => setPatient({ ...patient, hcn: v })} />
                </div>
                <Input label="Phone" value={patient.phone} onChange={(v: string) => setPatient({ ...patient, phone: v })} />
                <Toggle checked={patient.hasPcp !== false} onChange={(v: boolean) => setPatient({ ...patient, hasPcp: v })} label="Has a primary care provider" />
                {patient.hasPcp !== false && (
                  <>
                    <Input label="PCP Name" value={patient.pcpName} onChange={(v: string) => setPatient({ ...patient, pcpName: v })} />
                    <Input label="PCP Fax" value={patient.pcpFax} onChange={(v: string) => setPatient({ ...patient, pcpFax: v })} />
                  </>
                )}
                <Textarea label="Allergies" value={patient.allergies} onChange={(v: string) => setPatient({ ...patient, allergies: v })} />
                <Textarea label="Current Medications" value={patient.medications} onChange={(v: string) => setPatient({ ...patient, medications: v })} />
                <button onClick={handleNewPatient} disabled={saving || !patient.firstName || !patient.lastName || !patient.dob} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 12, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Creating...' : 'Create Patient & Start Assessment'}
                </button>
              </div>
            )}
          </div>
        )}
        {isPatientStep && patientId && (
          <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{patient.firstName} {patient.lastName}</div>
            <div style={{ fontSize: 13, color: muted }}>DOB: {patient.dob} {patient.hcn && `| HCN: ${patient.hcn}`}</div>
            <div style={{ fontSize: 13, color: muted }}>Allergies: {patient.allergies || 'NKDA'}</div>
            <div style={{ marginTop: 8, padding: '4px 10px', display: 'inline-block', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>✓ Patient Selected</div>
          </div>
        )}

        {/* Dynamic Template Sections */}
        {!isPatientStep && !isPrescribeStep && !isReviewStep && sectionIndex >= 0 && sectionIndex < sections.length && (
          <DynamicSection
            section={sections[sectionIndex]}
            data={sectionData[sections[sectionIndex].id] || {}}
            setData={(d: any) => setSectionData({ ...sectionData, [sections[sectionIndex].id]: d })}
          />
        )}

        {/* Prescribe Step */}
        {isPrescribeStep && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 16, textTransform: 'uppercase' }}>Select Treatment</div>
            {drugs.map((d: any, i: number) => {
              const selected = rx.selectedDrug === i
              return (
                <div key={i} onClick={() => setRx({ ...rx, selectedDrug: i })} style={{ padding: 16, borderRadius: 10, cursor: 'pointer', background: selected ? 'rgba(59,130,246,0.12)' : surfaceAlt, border: `2px solid ${selected ? accent : border}`, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{d.drug}</span>
                    {d.firstLine && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>1st LINE</span>}
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginBottom: 4 }}>{d.sig}</div>
                  <div style={{ fontSize: 12, color: dim }}>{d.notes}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: muted }}>
                    <span>Qty: {d.qty}</span><span>Days: {d.supply}</span>{d.odb_eligible && <span>ODB eligible</span>}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 16, padding: 12, background: surfaceAlt, borderRadius: 8, border: `1px solid ${border}`, cursor: 'pointer', textAlign: 'center', color: rx.selectedDrug === -1 ? accent : muted, fontWeight: 600 }} onClick={() => setRx({ ...rx, selectedDrug: -1 })}>
              No prescription — self-care advice only
            </div>
            <div style={{ marginTop: 16 }}>
              <Textarea label="Clinical Impression / Rationale" value={rx.impression} onChange={(v: string) => setRx({ ...rx, impression: v })} placeholder="Document your clinical assessment and rationale..." />
              <Textarea label="Counselling Notes" value={rx.counselling} onChange={(v: string) => setRx({ ...rx, counselling: v })} placeholder="Patient education and follow-up advice..." />
            </div>
          </div>
        )}

        {/* Review Step */}
        {isReviewStep && (
          <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Patient</div>
            {[['Name', `${patient.firstName} ${patient.lastName}`], ['DOB', patient.dob], ['HCN', patient.hcn || 'N/A'], ['PCP', patient.pcpName || 'No PCP'], ['Allergies', patient.allergies || 'NKDA']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                <span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}

            {sections.map((sec: any) => {
              const secData = sectionData[sec.id] || {}
              return (
                <div key={sec.id}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>{sec.title}</div>
                  {sec.fields?.filter((f: any) => secData[f.id] !== undefined && secData[f.id] !== '' && secData[f.id] !== false).map((f: any) => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                      <span style={{ color: muted, fontWeight: 600 }}>{f.label}</span>
                      <span style={{ color: f.is_red_flag && secData[f.id] === true ? danger : text }}>{String(secData[f.id])}</span>
                    </div>
                  ))}
                </div>
              )
            })}

            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Treatment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
              <span style={{ color: muted, fontWeight: 600 }}>Drug</span>
              <span style={{ color: text }}>{rx.selectedDrug >= 0 ? drugs[rx.selectedDrug]?.drug : rx.selectedDrug === -1 ? 'Self-care only' : 'Not selected'}</span>
            </div>
            {rx.selectedDrug >= 0 && drugs[rx.selectedDrug] && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
                <span style={{ color: muted, fontWeight: 600 }}>Sig</span>
                <span style={{ color: text }}>{drugs[rx.selectedDrug].sig}</span>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Billing</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
              <span style={{ color: muted, fontWeight: 600 }}>Code</span><span style={{ color: text }}>{ailment.odb_service_code}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
              <span style={{ color: muted, fontWeight: 600 }}>Fee</span><span style={{ color: text }}>${(ailment.consultation_fee_cents / 100).toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 20, padding: 14, background: 'rgba(245,158,11,0.12)', borderRadius: 8, fontSize: 12, color: text, border: '1px solid rgba(245,158,11,0.25)' }}>
              <strong style={{ color: warning }}>PCP Notification Required</strong> — A notification letter will be auto-generated upon completion.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${border}` }}>
          <button onClick={() => step === 0 ? router.push('/assess/start') : handleStepChange(step - 1)} style={{ padding: '12px 24px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          {isLast ? (
            <button onClick={handleComplete} disabled={saving} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${success}, #16A34A)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Complete & Lock Record ✓'}
            </button>
          ) : (
            <button onClick={() => handleStepChange(step + 1)} disabled={isPatientStep && !patientId} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (isPatientStep && !patientId) ? 0.5 : 1 }}>Continue →</button>
          )}
        </div>
      </div>

      <div style={{ padding: 24, textAlign: 'center', borderTop: `1px solid ${border}`, marginTop: 40, fontSize: 10, color: dim }}>
        RXASSESS v0.1 — PIPEDA / PHIPA COMPLIANT — DATA RESIDENCY: CA-CENTRAL-1 — © XCELRX INC.
      </div>
    </div>
  )
}