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

function InfoBox({ color, icon, title, children }: any) {
  const colors: any = {
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: warning },
    danger: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: danger },
    accent: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', text: accent },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', text: success },
  }
  const c = colors[color] || colors.accent
  return (
    <div style={{ padding: 14, background: c.bg, borderRadius: 10, border: `1px solid ${c.border}`, marginBottom: 16, fontSize: 13, color: text, lineHeight: 1.6 }}>
      <strong style={{ color: c.text }}>{icon} {title}</strong>
      <div style={{ marginTop: 4 }}>{children}</div>
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
            case 'boolean': return <Toggle key={field.id} checked={data[field.id] === true} onChange={(v: boolean) => setData({ ...data, [field.id]: v })} label={field.label} isDanger={field.is_red_flag} />
            case 'select': return <Select key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} options={field.options || []} required={field.required} />
            case 'textarea': return <Textarea key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} placeholder="" />
            default: return <Input key={field.id} label={field.label} value={data[field.id]} onChange={(v: string) => setData({ ...data, [field.id]: v })} required={field.required} />
          }
        })}
      </div>
      {hasRedFlag && (
        <InfoBox color="danger" icon="🚨" title="Red Flag(s) Identified — Consider Referral">One or more red flags are present. This may be beyond pharmacist prescribing scope.</InfoBox>
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
  const [encounter, setEncounter] = useState<any>({ mode: 'in_person', dispenseElsewhere: false })
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
  const stepNames = ['Patient', ...sections.map((s: any) => s.title), 'Prescribe', 'Follow-Up', 'Review']
  const stepIcons = ['👤', ...sections.map(() => '📋'), '💊', '📅', '✓']
  const totalSteps = stepNames.length
  const isLast = step === totalSteps - 1
  const isPatientStep = step === 0
  const isPrescribeStep = step === totalSteps - 3
  const isFollowUpStep = step === totalSteps - 2
  const isReviewStep = step === totalSteps - 1
  const sectionIndex = step - 1

  // Compute red flags from section data
  function getRedFlagInfo() {
    const redFlagList: string[] = []
    for (const [secId, secData] of Object.entries(sectionData)) {
      const section = sections.find((s: any) => s.id === secId)
      if (!section || !secData || typeof secData !== 'object') continue
      for (const field of (section.fields || [])) {
        if (field.is_red_flag && (secData as any)[field.id] === true) {
          redFlagList.push(field.label)
        }
      }
    }
    return { hasRedFlags: redFlagList.length > 0, redFlagList }
  }

  function getBillingInfo() {
    const isVirtual = encounter.mode !== 'in_person'
    const rxIssued = rx.selectedDrug != null && rx.selectedDrug >= 0
    const isReferral = rx.isReferral === true
    const pin = rxIssued
      ? (isVirtual ? ailment?.pin_rx_virtual : ailment?.pin_rx_in_person)
      : (isVirtual ? ailment?.pin_no_rx_virtual : ailment?.pin_no_rx_in_person)
    const fee = isVirtual ? '$15.00' : '$19.00'
    const pinType = `${rxIssued ? 'Rx Issued' : 'No Rx Issued'} (${isVirtual ? 'Virtual' : 'In-Person'})`
    return { pin, fee, pinType, isReferral }
  }

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
    if (assessmentId) await saveDraft(assessmentId, { patient, sections: sectionData, prescription: rx, encounter }, n)
    setStep(n)
  }

  async function handleComplete() {
    if (!assessmentId || !staff || !ailment) return; setSaving(true)
    const allData = { patient, sections: sectionData, prescription: rx, encounter }
    const { hasRedFlags } = getRedFlagInfo()
    const outcome = (rx.isReferral || (hasRedFlags && !rx.redFlagAcknowledged)) ? 'referred_physician' : rx.selectedDrug != null && rx.selectedDrug >= 0 ? 'prescribed' : 'self_care'
    await completeAssessment(assessmentId, allData, outcome, rx.impression || '')
    if (rx.selectedDrug != null && rx.selectedDrug >= 0 && outcome !== 'referred_physician') {
      await createPrescription(assessmentId, staff.pharmacy_id, patientId!, staff.id, drugs[rx.selectedDrug])
    }
    if (patient.hasPcp !== false && patient.pcpName) {
      const drug = rx.selectedDrug != null && rx.selectedDrug >= 0 ? drugs[rx.selectedDrug] : null
      const noRxInfo = rx.selectedDrug === -1 ? `\nReason: ${rx.noRxReason || 'See notes'}${rx.noRxRationale ? `\nRationale: ${rx.noRxRationale}` : ''}${rx.otcRecommendation ? `\nOTC: ${rx.otcRecommendation}` : ''}` : ''
      const referralInfo = rx.isReferral ? `\nReferred to: ${rx.referredTo || 'Another healthcare provider'}` : ''
      const content = `Dear ${patient.pcpName},\n\nRE: ${patient.firstName} ${patient.lastName} (DOB: ${patient.dob})\n\nThis letter is to notify you that the above-named patient presented at ${staff.pharmacies?.name || 'our pharmacy'} on ${new Date().toLocaleDateString('en-CA')} for assessment of ${ailment.name} under the Ontario Minor Ailments Program (O. Reg. 256/24).\n\nAssessment Mode: ${encounter.mode === 'in_person' ? 'In-Person' : 'Virtual'}\n\nClinical Assessment:\n${rx.impression || 'No red flags identified.'}\n\n${drug ? `Treatment: ${drug.drug} — ${drug.sig}${rx.refills > 0 ? `\nRefills: ${rx.refills}` : ''}` : `No prescription issued.${noRxInfo}`}${referralInfo}\n\nFollow-Up: ${rx.followUpPlan || 'Return if symptoms worsen.'}\n\nRespectfully,\n${staff.first_name} ${staff.last_name}, RPh\nOCP #${staff.ocp_registration_number}\n${staff.pharmacies?.name}\nTel: ${staff.pharmacies?.phone}`
      await createPcpNotification(assessmentId, patientId!, staff.pharmacy_id, { name: patient.pcpName, fax: patient.pcpFax }, content)
    }
    const rxIssued = rx.selectedDrug != null && rx.selectedDrug >= 0 && outcome !== 'referred_physician'
    const isReferral = outcome === 'referred_physician' || rx.isReferral === true
    await createClaim(assessmentId, staff.pharmacy_id, patientId!, ailment, encounter.mode, rxIssued, isReferral)
    setSaving(false); setCompleted(true)
  }

  if (staffLoading || !ailment) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: text }}>Loading...</div>
  if (!staff) { router.push('/login'); return null }

  if (completed) {
    const billing = getBillingInfo()
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid rgba(34,197,94,0.3)', fontSize: 36 }}>✓</div>
          <h2 style={{ color: text, fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: muted, fontSize: 14, margin: '0 0 8px' }}>{ailment.name}</p>
          <p style={{ color: dim, fontSize: 13, margin: '0 0 24px' }}>Record locked and saved.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['RECORD LOCKED', `PIN: ${billing.pin}`, `FEE: ${billing.fee}`, ...(billing.isReferral ? ['SSC: 4'] : []), patient.hasPcp !== false ? 'PCP LETTER PENDING' : 'NO PCP'].map(t => (
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

  const { hasRedFlags, redFlagList } = getRedFlagInfo()

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text }}>
      {/* HEADER */}
      <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>Rx</div>
          <div><div style={{ fontWeight: 800, fontSize: 15 }}>RxAssess</div><div style={{ fontSize: 10, color: dim }}>MINOR AILMENT DOCUMENTATION</div></div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}>{ailment.code} — {ailment.name}</span>
      </div>

      {/* STEP TABS */}
      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {stepNames.map((s, i) => (
          <button key={i} onClick={() => patientId && handleStepChange(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: i === step ? 'rgba(59,130,246,0.12)' : 'transparent', color: i === step ? accent : i < step ? success : dim, fontSize: 12, fontWeight: i === step ? 700 : 500, cursor: patientId ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
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

        {/* ==================== PATIENT STEP ==================== */}
        {isPatientStep && !patientId && (
          <div>
            {/* Assessment Mode */}
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Mode</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ value: 'in_person', label: 'In-Person', fee: '$19' }, { value: 'virtual_video', label: 'Virtual (Video)', fee: '$15' }, { value: 'virtual_phone', label: 'Virtual (Phone)', fee: '$15' }].map(m => (
                  <button key={m.value} onClick={() => setEncounter({ ...encounter, mode: m.value })} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: `2px solid ${encounter.mode === m.value ? accent : border}`, background: encounter.mode === m.value ? 'rgba(59,130,246,0.12)' : 'transparent', color: encounter.mode === m.value ? accent : muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                    {m.label}<br /><span style={{ fontSize: 10, color: dim }}>{m.fee}</span>
                  </button>
                ))}
              </div>
              {encounter.mode !== 'in_person' && (
                <InfoBox color="accent" icon="ℹ" title="Virtual Care Policy">Virtual minor ailment services must be provided from an eligible pharmacy location per OCP Virtual Care Policy.</InfoBox>
              )}
            </div>

            {/* Pre-Assessment Checks */}
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pre-Assessment Checks (EO Notice)</div>
              <Toggle checked={encounter.consentObtained === true} onChange={(v: boolean) => setEncounter({ ...encounter, consentObtained: v })} label="Informed consent obtained from patient or substitute decision-maker" />
              <Select label="Consent method" value={encounter.consentMethod} onChange={(v: string) => setEncounter({ ...encounter, consentMethod: v })} options={['Verbal', 'Written']} required />
              <Toggle checked={encounter.selfFamilyCheck === true} onChange={(v: boolean) => setEncounter({ ...encounter, selfFamilyCheck: v })} label="Confirmed: Patient is NOT the pharmacist or a family member" />
              <Toggle checked={encounter.existingRxCheck === true} onChange={(v: boolean) => setEncounter({ ...encounter, existingRxCheck: v })} label="Confirmed: Patient does NOT have an existing Rx for this ailment" />
              {encounter.selfFamilyCheck === false && encounter.selfFamilyCheck !== undefined && (
                <InfoBox color="danger" icon="⊘" title="Cannot Proceed">Pharmacists cannot conduct minor ailment services for themselves or a family member.</InfoBox>
              )}
              {encounter.existingRxCheck === false && encounter.existingRxCheck !== undefined && (
                <InfoBox color="danger" icon="⊘" title="Cannot Bill">Cannot claim if patient has an existing Rx that could be filled, adapted, or extended.</InfoBox>
              )}
            </div>

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
                {patient.hasPcp === false && (<InfoBox color="warning" icon="⚠" title="No PCP">As the prescriber you assume responsibility for monitoring and follow-up.</InfoBox>)}
                {patient.hasPcp !== false && (<><Input label="PCP Name" value={patient.pcpName} onChange={(v: string) => setPatient({ ...patient, pcpName: v })} /><Input label="PCP Fax" value={patient.pcpFax} onChange={(v: string) => setPatient({ ...patient, pcpFax: v })} /></>)}
                <Textarea label="Allergies" value={patient.allergies} onChange={(v: string) => setPatient({ ...patient, allergies: v })} placeholder="e.g., Sulfonamides – rash; NKDA" />
                <Textarea label="Current Medications" value={patient.medications} onChange={(v: string) => setPatient({ ...patient, medications: v })} placeholder="e.g., Metformin 500mg BID" />
                <button onClick={handleNewPatient} disabled={saving || !patient.firstName || !patient.lastName || !patient.dob} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 12, opacity: saving ? 0.7 : 1 }}>{saving ? 'Creating...' : 'Create Patient & Start Assessment'}</button>
              </div>
            )}
          </div>
        )}

        {isPatientStep && patientId && (
          <div>
            <div style={{ padding: 12, background: surfaceAlt, borderRadius: 8, border: `1px solid ${border}`, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: muted }}>Assessment Mode</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{encounter.mode === 'in_person' ? 'In-Person ($19)' : 'Virtual ($15)'}</span>
            </div>
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{patient.firstName} {patient.lastName}</div>
              <div style={{ fontSize: 13, color: muted }}>DOB: {patient.dob} {patient.hcn && `| HCN: ${patient.hcn}`}</div>
              <div style={{ fontSize: 13, color: muted }}>PCP: {patient.hasPcp !== false ? patient.pcpName || 'Not specified' : 'No PCP'}</div>
              <div style={{ fontSize: 13, color: muted }}>Allergies: {patient.allergies || 'NKDA'}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>✓ Patient Selected</span>
                {encounter.consentObtained && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>✓ Consent</span>}
              </div>
            </div>
            {patient.hasPcp === false && (<InfoBox color="warning" icon="⚠" title="No PCP — Pharmacist Monitoring">You are responsible for follow-up until care can be transitioned.</InfoBox>)}
          </div>
        )}

        {/* ==================== DYNAMIC SECTIONS ==================== */}
        {!isPatientStep && !isPrescribeStep && !isFollowUpStep && !isReviewStep && sectionIndex >= 0 && sectionIndex < sections.length && (
          <DynamicSection section={sections[sectionIndex]} data={sectionData[sections[sectionIndex].id] || {}} setData={(d: any) => setSectionData({ ...sectionData, [sections[sectionIndex].id]: d })} />
        )}

        {/* ==================== PRESCRIBE STEP ==================== */}
        {isPrescribeStep && (
          <div>
            {/* Red Flag Gate */}
            {hasRedFlags && !rx.redFlagAcknowledged && (
              <div style={{ padding: 20, background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '2px solid rgba(239,68,68,0.4)', marginBottom: 20 }}>
                <div style={{ fontWeight: 800, color: danger, fontSize: 16, marginBottom: 8 }}>🚨 Red Flag(s) Identified</div>
                <div style={{ fontSize: 13, color: text, lineHeight: 1.6, marginBottom: 12 }}>Per OCP guidelines, consider whether referral is appropriate.</div>
                <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 16 }}>
                  {redFlagList.map((flag, i) => (<div key={i} style={{ fontSize: 13, color: danger, padding: '4px 0' }}>⚠ {flag}</div>))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => setRx({ ...rx, selectedDrug: -1, noRxReason: 'Red flags identified - referral', isReferral: true, redFlagAcknowledged: true })} style={{ padding: 14, borderRadius: 10, border: `2px solid ${warning}`, background: 'rgba(245,158,11,0.12)', color: text, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ color: warning, fontWeight: 700 }}>→ Refer Patient</span>
                    <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Refer to physician, NP, or ED. Claim includes SSC 4.</div>
                  </button>
                  <button onClick={() => setRx({ ...rx, redFlagAcknowledged: true })} style={{ padding: 14, borderRadius: 10, border: `1px solid ${border}`, background: surfaceAlt, color: text, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    <span>→ Proceed with Clinical Judgment</span>
                    <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Red flags assessed — treatment appropriate. Documentation required.</div>
                  </button>
                </div>
              </div>
            )}

            {hasRedFlags && rx.redFlagAcknowledged && !rx.isReferral && (
              <InfoBox color="warning" icon="⚠" title="Proceeding Despite Red Flags">Document your clinical rationale below.</InfoBox>
            )}

            {(!hasRedFlags || rx.redFlagAcknowledged) && (
              <>
                {/* Referral path */}
                {rx.isReferral && (
                  <div style={{ padding: 16, background: 'rgba(245,158,11,0.12)', borderRadius: 10, border: `1px solid rgba(245,158,11,0.3)`, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: warning, fontSize: 14, marginBottom: 8 }}>Referral Selected</div>
                    <Input label="Referred to" value={rx.referredTo} onChange={(v: string) => setRx({ ...rx, referredTo: v })} placeholder="e.g., Family physician, Walk-in clinic, ED" />
                    <Textarea label="Referral reason" value={rx.noRxRationale} onChange={(v: string) => setRx({ ...rx, noRxRationale: v })} placeholder="Document reason for referral..." />
                    <InfoBox color="accent" icon="ℹ" title="SSC 4 — Referral by Pharmacist">HNS claim will include Special Service Code 4.</InfoBox>
                    <button onClick={() => setRx({ ...rx, isReferral: false, selectedDrug: undefined, noRxReason: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 12, cursor: 'pointer' }}>← Change decision</button>
                  </div>
                )}

                {/* Drug selection (not shown if referral) */}
                {!rx.isReferral && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 16, textTransform: 'uppercase' }}>Select Treatment</div>
                    {drugs.map((d: any, i: number) => (
                      <div key={i} onClick={() => setRx({ ...rx, selectedDrug: i })} style={{ padding: 16, borderRadius: 10, cursor: 'pointer', background: rx.selectedDrug === i ? 'rgba(59,130,246,0.12)' : surfaceAlt, border: `2px solid ${rx.selectedDrug === i ? accent : border}`, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{d.drug}</span>
                          {d.firstLine && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: success, border: '1px solid rgba(34,197,94,0.25)' }}>1st LINE</span>}
                        </div>
                        <div style={{ fontSize: 13, color: muted, marginBottom: 4 }}>{d.sig}</div>
                        <div style={{ fontSize: 12, color: dim }}>{d.notes}</div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: muted }}><span>Qty: {d.qty}</span><span>Days: {d.supply}</span>{d.odb_eligible && <span>ODB eligible</span>}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, padding: 14, background: surfaceAlt, borderRadius: 10, border: `2px solid ${rx.selectedDrug === -1 ? accent : border}`, cursor: 'pointer', textAlign: 'center', color: rx.selectedDrug === -1 ? accent : muted, fontWeight: 600, fontSize: 14 }} onClick={() => setRx({ ...rx, selectedDrug: -1, isReferral: false })}>
                      No prescription — self-care / OTC
                    </div>

                    {/* No Rx Documentation */}
                    {rx.selectedDrug === -1 && (
                      <div style={{ marginTop: 16, padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: warning, marginBottom: 12, textTransform: 'uppercase' }}>No Rx Issued — Documentation Required</div>
                        <Select label="Reason" value={rx.noRxReason} onChange={(v: string) => setRx({ ...rx, noRxReason: v })} options={['OTC medication recommended', 'Non-pharmacological therapy', 'Patient declined treatment', 'Condition self-limiting', 'Referral to physician/NP required']} required />
                        {rx.noRxReason === 'OTC medication recommended' && (<Textarea label="OTC Details" value={rx.otcRecommendation} onChange={(v: string) => setRx({ ...rx, otcRecommendation: v })} placeholder="e.g., Recommended acetaminophen 500mg q4-6h PRN." />)}
                        {rx.noRxReason === 'Referral to physician/NP required' && (<><Toggle checked={rx.isReferral === true} onChange={(v: boolean) => setRx({ ...rx, isReferral: v })} label="Referral made" />{rx.isReferral && <Input label="Referred to" value={rx.referredTo} onChange={(v: string) => setRx({ ...rx, referredTo: v })} placeholder="e.g., Family physician" />}</>)}
                        <Textarea label="Rationale" value={rx.noRxRationale} onChange={(v: string) => setRx({ ...rx, noRxRationale: v })} placeholder="Document clinical rationale..." />
                      </div>
                    )}
                  </>
                )}

                {/* Red Flag Override Rationale */}
                {hasRedFlags && rx.redFlagAcknowledged && !rx.isReferral && (
                  <div style={{ marginTop: 16, padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: `1px solid rgba(245,158,11,0.25)` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: warning, marginBottom: 12, textTransform: 'uppercase' }}>Red Flag Override — Rationale Required</div>
                    <Textarea label="Why is treatment appropriate despite red flag(s)?" value={rx.redFlagOverrideReason} onChange={(v: string) => setRx({ ...rx, redFlagOverrideReason: v })} placeholder="e.g., Mild fever resolved. No systemic signs. Proceeding with close follow-up." />
                  </div>
                )}

                {/* Refills */}
                {rx.selectedDrug >= 0 && (
                  <div style={{ marginTop: 20, padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase' }}>Refills</div>
                    <Select label="Number of refills" value={rx.refills != null ? String(rx.refills) : '0'} onChange={(v: string) => setRx({ ...rx, refills: parseInt(v) || 0 })} options={['0', '1', '2', '3']} />
                    {rx.refills > 0 && (<><Textarea label="Refill Rationale (OCP)" value={rx.refillRationale} onChange={(v: string) => setRx({ ...rx, refillRationale: v })} placeholder="Document rationale for refills..." /><InfoBox color="accent" icon="ℹ" title="OCP Refill Guidance">Minor ailments are usually short-term. Document rationale.</InfoBox></>)}
                  </div>
                )}

                {/* Dispensing Location */}
                {rx.selectedDrug >= 0 && (
                  <div style={{ marginTop: 16, padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase' }}>Dispensing Location</div>
                    <Toggle checked={encounter.dispenseElsewhere === true} onChange={(v: boolean) => setEncounter({ ...encounter, dispenseElsewhere: v })} label="Patient chose another pharmacy" />
                    {encounter.dispenseElsewhere && <Input label="Pharmacy Name" value={encounter.dispensingPharmacy} onChange={(v: string) => setEncounter({ ...encounter, dispensingPharmacy: v })} placeholder="Name of pharmacy" />}
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <Textarea label="Clinical Impression / Rationale" value={rx.impression} onChange={(v: string) => setRx({ ...rx, impression: v })} placeholder="Document your clinical assessment..." />
                  <Textarea label="Counselling Notes" value={rx.counselling} onChange={(v: string) => setRx({ ...rx, counselling: v })} placeholder="Patient education provided..." />
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================== FOLLOW-UP STEP ==================== */}
        {isFollowUpStep && (() => {
          const defaults = ailment?.follow_up_defaults
          // Auto-populate on first visit to this step
          if (defaults && !rx._followUpInitialized) {
            setTimeout(() => setRx((prev: any) => ({
              ...prev,
              followUpTime: prev.followUpTime || defaults.timeframe || '',
              followUpMethod: prev.followUpMethod || defaults.method || '',
              followUpPlan: prev.followUpPlan || defaults.plan || '',
              urgentCriteria: prev.urgentCriteria || defaults.urgent_criteria || '',
              _followUpInitialized: true,
            })), 0)
          }
          return (
          <div>
            {defaults && (
              <InfoBox color="accent" icon="📋" title={`${ailment.name} — medSask Follow-Up Protocol`}>
                Recommended follow-up: <strong>{defaults.timeframe}</strong> via <strong>{defaults.method?.toLowerCase()}</strong>. Fields below have been pre-populated from evidence-based guidelines. Adjust as clinically appropriate.
              </InfoBox>
            )}
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase' }}>Monitoring & Follow-Up Plan</div>
              <Select label="Follow-up timeframe" value={rx.followUpTime} onChange={(v: string) => setRx({ ...rx, followUpTime: v })} options={['24-48 hours', '48-72 hours', '3-5 days', '7 days', '2 weeks', '4 weeks', '4-8 weeks', '8-12 weeks', '3 months', '30 days', 'As needed']} required />
              <Select label="Follow-up method" value={rx.followUpMethod} onChange={(v: string) => setRx({ ...rx, followUpMethod: v })} options={['In-person', 'Phone call', 'Patient to return if needed', 'Patient to contact if symptoms worsen']} required />
              <Textarea label="Follow-Up Plan Details" value={rx.followUpPlan} onChange={(v: string) => setRx({ ...rx, followUpPlan: v })} placeholder="e.g., Return if symptoms do not improve within 48-72 hours." />
              <Textarea label="When to Seek Urgent Care" value={rx.urgentCriteria} onChange={(v: string) => setRx({ ...rx, urgentCriteria: v })} placeholder="e.g., Seek emergency care if: high fever, severe pain." />
            </div>

            {defaults?.adverse_effects && (
              <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: warning, marginBottom: 12, textTransform: 'uppercase' }}>Adverse Effects Monitoring</div>
                <div style={{ fontSize: 13, color: text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{defaults.adverse_effects}</div>
              </div>
            )}

            {patient.hasPcp === false && (<InfoBox color="warning" icon="⚠" title="No PCP — Enhanced Monitoring">You are responsible for ongoing monitoring. Consider proactive follow-up.</InfoBox>)}
            <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 12, textTransform: 'uppercase' }}>Information Gathering</div>
              <Toggle checked={encounter.techAssisted === true} onChange={(v: boolean) => setEncounter({ ...encounter, techAssisted: v })} label="Patient info gathered by pharmacy technician" />
              {encounter.techAssisted && <Input label="Technician Name" value={encounter.techName} onChange={(v: string) => setEncounter({ ...encounter, techName: v })} placeholder="Name" />}
              <div style={{ fontSize: 11, color: dim, marginTop: 4, lineHeight: 1.5 }}>Clinical assessment and prescribing remains the pharmacist&#39;s responsibility.</div>
            </div>
          </div>
          )
        })()}

        {/* ==================== REVIEW STEP ==================== */}
        {isReviewStep && (() => {
          const billing = getBillingInfo()
          return (
          <div style={{ padding: 16, background: surfaceAlt, borderRadius: 10, border: `1px solid ${border}` }}>
            {/* Encounter */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Encounter</div>
            {[['Mode', encounter.mode === 'in_person' ? 'In-Person' : 'Virtual'], ['Consent', encounter.consentObtained ? `Yes (${encounter.consentMethod || ''})` : '⚠ NOT OBTAINED'], ['Self/Family', encounter.selfFamilyCheck ? '✓' : '⚠'], ['Existing Rx', encounter.existingRxCheck ? '✓' : '⚠'], ['Tech', encounter.techAssisted ? `Yes — ${encounter.techName || ''}` : 'No']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: (v as string).includes('⚠') ? warning : text }}>{v}</span></div>
            ))}

            {/* Patient */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Patient</div>
            {[['Name', `${patient.firstName} ${patient.lastName}`], ['DOB', patient.dob], ['HCN', patient.hcn || 'N/A'], ['PCP', patient.hasPcp !== false ? patient.pcpName || 'Not specified' : '⚠ No PCP'], ['Allergies', patient.allergies || 'NKDA']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: (v as string).includes('⚠') ? warning : text, textAlign: 'right', maxWidth: '60%' }}>{v}</span></div>
            ))}

            {/* Clinical */}
            {sections.map((sec: any) => {
              const sd = sectionData[sec.id] || {}
              const filled = sec.fields?.filter((f: any) => sd[f.id] !== undefined && sd[f.id] !== '' && sd[f.id] !== false)
              if (!filled?.length) return null
              return (<div key={sec.id}>
                <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>{sec.title}</div>
                {filled.map((f: any) => (<div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{f.label}</span><span style={{ color: f.is_red_flag && sd[f.id] === true ? danger : text }}>{String(sd[f.id])}</span></div>))}
              </div>)
            })}

            {/* Treatment */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Treatment</div>
            {rx.isReferral ? (
              <>{[['Decision', 'REFERRAL'], ['Referred to', rx.referredTo || '—'], ['Reason', rx.noRxRationale || '—']].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: warning }}>{v}</span></div>))}</>
            ) : rx.selectedDrug >= 0 && drugs[rx.selectedDrug] ? (
              <>{[['Drug', drugs[rx.selectedDrug].drug], ['Sig', drugs[rx.selectedDrug].sig], ['Qty', String(drugs[rx.selectedDrug].qty)], ['Refills', String(rx.refills || 0)], ...(rx.refills > 0 ? [['Refill Rationale', rx.refillRationale || '—']] : []), ['Dispense', encounter.dispenseElsewhere ? encounter.dispensingPharmacy || 'Another' : staff.pharmacies?.name || 'This pharmacy']].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{v}</span></div>))}</>
            ) : rx.selectedDrug === -1 ? (
              <>{[['Decision', 'No Rx Issued'], ['Reason', rx.noRxReason || '—'], ...(rx.noRxRationale ? [['Rationale', rx.noRxRationale]] : []), ...(rx.otcRecommendation ? [['OTC', rx.otcRecommendation]] : [])].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{v}</span></div>))}</>
            ) : (<div style={{ padding: '5px 0', fontSize: 13, color: warning }}>⚠ No treatment selected</div>)}
            {rx.impression && (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>Impression</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{rx.impression}</span></div>)}
            {hasRedFlags && rx.redFlagOverrideReason && (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: warning, fontWeight: 600 }}>Red Flag Override</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{rx.redFlagOverrideReason}</span></div>)}

            {/* Follow-Up */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Follow-Up</div>
            {[['Timeframe', rx.followUpTime || '—'], ['Method', rx.followUpMethod || '—'], ['Plan', rx.followUpPlan || '—'], ['Urgent', rx.urgentCriteria || '—']].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: text, textAlign: 'right', maxWidth: '60%' }}>{v}</span></div>))}

            {/* HNS Billing */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>HNS Billing</div>
            {[['PIN', billing.pin || '—'], ['Type', billing.pinType], ['Fee', billing.fee], ['Intervention', 'PS'], ['Prescriber ID Ref', '09'], ...(billing.isReferral ? [['SSC', '4 (Referral)']] : [])].map(([l, v]) => (<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>{l}</span><span style={{ color: text }}>{v}</span></div>))}

            {/* PCP */}
            {patient.hasPcp !== false ? (<InfoBox color="warning" icon="📬" title="PCP Notification Required">Letter to {patient.pcpName || 'PCP'} will be auto-generated.</InfoBox>) : (<InfoBox color="warning" icon="⚠" title="No PCP">You are responsible for monitoring.</InfoBox>)}

            {/* Auth */}
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${accent}` }}>Authorization</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${border}`, fontSize: 13 }}><span style={{ color: muted, fontWeight: 600 }}>Pharmacist</span><span style={{ color: text }}>{staff.first_name} {staff.last_name}, RPh — OCP #{staff.ocp_registration_number}</span></div>
          </div>
          )
        })()}

        {/* ==================== NAVIGATION ==================== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${border}` }}>
          <button onClick={() => step === 0 ? router.push('/assess/start') : handleStepChange(step - 1)} style={{ padding: '12px 24px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
          {isLast ? (
            <button onClick={handleComplete} disabled={saving} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${success}, #16A34A)`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Complete & Lock Record ✓'}</button>
          ) : (
            <button onClick={() => handleStepChange(step + 1)} disabled={isPatientStep && !patientId} style={{ padding: '12px 28px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (isPatientStep && !patientId) ? 0.5 : 1 }}>Continue →</button>
          )}
        </div>
      </div>

      <div style={{ padding: 24, textAlign: 'center', borderTop: `1px solid ${border}`, marginTop: 40, fontSize: 10, color: dim }}>RXASSESS v0.3 — PIPEDA / PHIPA COMPLIANT — CA-CENTRAL-1 — © XCELRX INC.</div>
    </div>
  )
}
