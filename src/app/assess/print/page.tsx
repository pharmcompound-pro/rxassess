'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function PrintContent() {
  const searchParams = useSearchParams()
  const assessmentId = searchParams.get('id')
  const mode = searchParams.get('mode') || 'assessment'
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!assessmentId) return
      const supabase = createClient()

      const { data: assessment, error: assessError } = await supabase
        .from('assessments')
        .select('*, patients(*), minor_ailments(*), staff!assessments_pharmacist_id_fkey(*)')
        .eq('id', assessmentId)
        .single()

      if (!assessment) { console.error('Assessment not found:', assessError); return }

      const { data: pharmacy } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('id', assessment.pharmacy_id)
        .single()

      const { data: prescription } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .limit(1)
        .single()

      const { data: claim } = await supabase
        .from('claims')
        .select('*')
        .eq('assessment_id', assessmentId)
        .limit(1)
        .single()

      setData({ assessment, pharmacy, prescription, claim })
      setLoading(false)
    }
    load()
  }, [assessmentId])

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, data])

  if (loading || !data) return <div style={{ padding: 40, fontFamily: 'Arial', fontSize: 14 }}>Loading...</div>

  const { assessment, pharmacy, prescription, claim } = data
  const patient = assessment.patients
  const pharmacist = assessment.staff
  const ailment = assessment.minor_ailments
  const cd = assessment.clinical_data || {}
  const date = new Date(assessment.completed_at || assessment.created_at).toLocaleDateString('en-CA')
  const time = new Date(assessment.completed_at || assessment.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
  const refId = assessment.id.slice(0, 8).toUpperCase()

  // ── Parse clinical_data from wizard's actual structure ──
  // Wizard saves: { patient, sections: { [sectionId]: { [fieldId]: value } }, prescription: { selectedDrug, impression, ... }, encounter: { mode, ... } }
  const sections = ailment?.assessment_template?.sections || []
  const sectionData = cd.sections || {}
  const rxData = cd.prescription || {}
  const encounterData = cd.encounter || {}
  const drugs = ailment?.eligible_drugs || []

  // Get the prescribed drug from the prescriptions table (authoritative),
  // or fall back to eligible_drugs[selectedDrug] from clinical_data
  const selectedDrugIndex = rxData.selectedDrug
  const drugFromDb = prescription // from prescriptions table
  const drugFromTemplate = selectedDrugIndex != null && selectedDrugIndex >= 0 ? drugs[selectedDrugIndex] : null

  // Build red flags list from section data + template field definitions
  const redFlagList: string[] = []
  for (const section of sections) {
    const sd = sectionData[section.id]
    if (!sd || typeof sd !== 'object') continue
    for (const field of (section.fields || [])) {
      if (field.is_red_flag && sd[field.id] === true) {
        redFlagList.push(field.label)
      }
    }
  }

  // Build clinical findings from all sections
  const clinicalFindings: { sectionTitle: string; fields: { label: string; value: string; isRedFlag: boolean }[] }[] = []
  for (const section of sections) {
    const sd = sectionData[section.id]
    if (!sd || typeof sd !== 'object') continue
    const fields: { label: string; value: string; isRedFlag: boolean }[] = []
    for (const field of (section.fields || [])) {
      const val = sd[field.id]
      if (val === undefined || val === '' || val === null) continue
      let display = ''
      if (typeof val === 'boolean') {
        display = val ? 'Yes' : 'No'
      } else {
        display = String(val)
      }
      fields.push({ label: field.label, value: display, isRedFlag: field.is_red_flag && val === true })
    }
    if (fields.length > 0) {
      clinicalFindings.push({ sectionTitle: section.title, fields })
    }
  }

  // ══════════════════════════════════════════════════
  // PCP LETTER MODE
  // ══════════════════════════════════════════════════
  if (mode === 'pcp') {
    const isReferral = rxData.isReferral === true || assessment.outcome === 'referred_physician'

    // Build clinical summary from actual section data
    const clinicalSummaryLines: string[] = []
    for (const finding of clinicalFindings) {
      const positives = finding.fields.filter(f => f.value === 'Yes' || (f.value !== 'No' && f.value !== 'false'))
      if (positives.length > 0) {
        clinicalSummaryLines.push(`${finding.sectionTitle}: ${positives.map(f => `${f.label}${f.isRedFlag ? ' (RED FLAG)' : ''}`).join(', ')}`)
      }
    }

    // Drug info from prescriptions table or template
    const drugName = drugFromDb
      ? `${drugFromDb.drug_name}${drugFromDb.strength ? ` ${drugFromDb.strength}` : ''}`
      : drugFromTemplate
        ? `${drugFromTemplate.drugName || drugFromTemplate.drug}${drugFromTemplate.brandName ? ` (${drugFromTemplate.brandName})` : ''}`
        : null
    const drugSig = drugFromDb?.directions || drugFromTemplate?.sig || ''
    const drugRefills = rxData.refills > 0 ? `\nRefills: ${rxData.refills}` : ''

    // Build treatment section
    let treatmentBlock = ''
    if (isReferral) {
      treatmentBlock = `TREATMENT:\nReferred to: ${rxData.referredTo || 'Another healthcare provider'}`
      if (rxData.noRxRationale) treatmentBlock += `\nReason: ${rxData.noRxRationale}`
    } else if (drugName) {
      treatmentBlock = `TREATMENT:\n${drugName} — ${drugSig}${drugRefills}`
    } else {
      treatmentBlock = `TREATMENT:\nNo prescription issued.`
      if (rxData.noRxReason) treatmentBlock += `\nReason: ${rxData.noRxReason}`
      if (rxData.noRxRationale) treatmentBlock += `\nRationale: ${rxData.noRxRationale}`
      if (rxData.otcRecommendation) treatmentBlock += `\nOTC Recommended: ${rxData.otcRecommendation}`
    }

    const letterContent = [
      `Dear ${patient.primary_care_provider_name || 'Doctor'},`,
      '',
      `RE: ${patient.first_name} ${patient.last_name} (DOB: ${patient.date_of_birth})`,
      '',
      `This letter is to notify you that the above-named patient presented at ${pharmacy.name} on ${date} for assessment of ${ailment.name} under the Ontario Minor Ailments Program (O. Reg. 256/24 under the Pharmacy Act, 1991).`,
      '',
      `Assessment Mode: ${encounterData.mode === 'in_person' ? 'In-Person' : 'Virtual'}`,
      '',
      'ASSESSMENT SUMMARY:',
      clinicalSummaryLines.length > 0
        ? clinicalSummaryLines.join('\n')
        : 'Clinical assessment consistent with uncomplicated presentation.',
      rxData.impression ? `\nClinical Impression: ${rxData.impression}` : '',
      redFlagList.length > 0 ? `\nRed Flags: ${redFlagList.join(', ')}` : 'No red flags identified.',
      '',
      treatmentBlock,
      '',
      `FOLLOW-UP:`,
      rxData.followUpPlan || 'Return if symptoms worsen or do not improve.',
      rxData.followUpTime ? `Timeframe: ${rxData.followUpTime}` : '',
      rxData.urgentCriteria ? `Seek urgent care if: ${rxData.urgentCriteria}` : '',
      '',
      `This notification is provided in accordance with OCP requirements for pharmacist prescribing for minor ailments.${patient.has_pcp === false ? ' Note: This patient does not have a regular primary care provider.' : ''}`,
      '',
      'Please do not hesitate to contact us if you have any questions.',
      '',
      'Respectfully,',
      `${pharmacist.first_name} ${pharmacist.last_name}, RPh`,
      `OCP Registration: ${pharmacist.ocp_registration_number}`,
      pharmacy.name,
      pharmacy.address_line1,
      `${pharmacy.city}, ${pharmacy.province} ${pharmacy.postal_code}`,
      `Tel: ${pharmacy.phone}`,
      pharmacy.fax ? `Fax: ${pharmacy.fax}` : '',
    ].filter(line => line !== undefined).join('\n')

    return (
      <div style={{ fontFamily: 'Arial', fontSize: 12, maxWidth: 700, margin: '0 auto', padding: '40px 60px', lineHeight: 1.8 }}>
        <style>{`@media print { body { margin: 0; } @page { margin: 20mm; } }`}</style>
        <div style={{ marginBottom: 30, borderBottom: '2px solid #333', paddingBottom: 15 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{pharmacy.name}</div>
          <div>{pharmacy.address_line1}</div>
          <div>{pharmacy.city}, {pharmacy.province} {pharmacy.postal_code}</div>
          <div>Tel: {pharmacy.phone} | Fax: {pharmacy.fax || 'N/A'}</div>
          <div>OCP Accreditation #{pharmacy.ocp_accreditation_number}</div>
        </div>
        <div style={{ marginBottom: 20 }}>Date: {date}</div>
        <pre style={{ fontFamily: 'Arial', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{letterContent}</pre>
      </div>
    )
  }

  // ══════════════════════════════════════════════════
  // ASSESSMENT PRINT MODE
  // ══════════════════════════════════════════════════
  const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <tr>
      <td style={{ padding: '4px 12px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee', fontSize: 11 }}>{label}</td>
      <td style={{ padding: '4px 12px', borderBottom: '1px solid #eee', fontSize: 11, color: highlight ? '#c00' : '#000' }}>{value || '—'}</td>
    </tr>
  )

  const Section = ({ title, children }: { title: string; children: any }) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', background: '#f5f5f5', padding: '4px 12px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{children}</tbody></table>
    </div>
  )

  // Billing from claims table or fallback to ailment
  const billingFee = claim
    ? `$${(claim.claim_amount_cents / 100).toFixed(2)}`
    : encounterData.mode === 'in_person' ? '$19.00' : '$15.00'
  const billingPin = claim?.pin_used || '—'
  const billingServiceCode = claim?.service_code || ailment.odb_service_code || '—'

  return (
    <div style={{ fontFamily: 'Arial', fontSize: 11, maxWidth: 700, margin: '0 auto', padding: '30px 50px' }}>
      <style>{`@media print { body { margin: 0; } @page { margin: 15mm; } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold' }}>{pharmacy.name}</div>
          <div>{pharmacy.address_line1}</div>
          <div>{pharmacy.city}, {pharmacy.province} {pharmacy.postal_code}</div>
          <div>Tel: {pharmacy.phone} | Fax: {pharmacy.fax || 'N/A'}</div>
          <div>OCP #{pharmacy.ocp_accreditation_number}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 'bold' }}>Minor Ailment Assessment</div>
          <div>Date: {date} at {time}</div>
          <div>Ref: {refId}</div>
        </div>
      </div>

      {/* Encounter */}
      <Section title="Encounter">
        <Row label="Mode" value={encounterData.mode === 'in_person' ? 'In-Person' : 'Virtual'} />
        <Row label="Consent" value={encounterData.consentObtained ? `Yes (${encounterData.consentMethod || 'Verbal'})` : 'Not documented'} />
        <Row label="Self/Family Check" value={encounterData.selfFamilyCheck ? 'Confirmed' : 'Not documented'} />
        <Row label="Existing Rx Check" value={encounterData.existingRxCheck ? 'Confirmed' : 'Not documented'} />
        {encounterData.techAssisted && <Row label="Tech Assisted" value={`Yes — ${encounterData.techName || 'Name not recorded'}`} />}
      </Section>

      {/* Patient */}
      <Section title="Patient Information">
        <Row label="Name" value={`${patient.first_name} ${patient.last_name}`} />
        <Row label="Date of Birth" value={patient.date_of_birth} />
        <Row label="Health Card" value={patient.health_card_number || 'Not provided'} />
        <Row label="Phone" value={patient.phone || 'N/A'} />
        <Row label="PCP" value={patient.primary_care_provider_name || 'No PCP'} />
        <Row label="Allergies" value={patient.allergies?.map((a: any) => a.allergen).join(', ') || 'NKDA'} />
        <Row label="Medications" value={patient.current_medications?.map((m: any) => m.drug).join(', ') || 'None'} />
      </Section>

      {/* Clinical Sections — Dynamic from assessment_template */}
      {clinicalFindings.length > 0 ? (
        clinicalFindings.map((finding, i) => (
          <Section key={i} title={`${finding.sectionTitle} — ${ailment.name}`}>
            {finding.fields.map((f, j) => (
              <Row key={j} label={f.label} value={f.value} highlight={f.isRedFlag} />
            ))}
          </Section>
        ))
      ) : (
        <Section title={`Clinical Assessment — ${ailment.name}`}>
          <Row label="Findings" value="No clinical data documented" />
        </Section>
      )}

      {/* Red Flags Summary */}
      <Section title="Red Flag Screen">
        <Row
          label="Result"
          value={redFlagList.length > 0 ? `⚠ POSITIVE: ${redFlagList.join(', ')}` : '✓ None identified'}
          highlight={redFlagList.length > 0}
        />
        {redFlagList.length > 0 && rxData.redFlagOverrideReason && (
          <Row label="Override Rationale" value={rxData.redFlagOverrideReason} />
        )}
      </Section>

      {/* Treatment / Prescription */}
      {assessment.outcome === 'referred_physician' || rxData.isReferral ? (
        <Section title="Treatment — Referral">
          <Row label="Decision" value="REFERRAL" highlight />
          <Row label="Referred To" value={rxData.referredTo || '—'} />
          <Row label="Reason" value={rxData.noRxRationale || rxData.noRxReason || '—'} />
        </Section>
      ) : drugFromDb ? (
        <Section title="Prescription">
          <Row label="Drug" value={`${drugFromDb.drug_name}${drugFromDb.strength ? ` ${drugFromDb.strength}` : ''}`} />
          {drugFromDb.dosage_form && <Row label="Form" value={drugFromDb.dosage_form} />}
          <Row label="Directions" value={drugFromDb.directions} />
          <Row label="Quantity" value={drugFromDb.quantity} />
          <Row label="Days Supply" value={String(drugFromDb.days_supply)} />
          <Row label="ODB Eligible" value={drugFromDb.is_odb_eligible ? 'Yes' : 'No'} />
          {rxData.refills > 0 && <Row label="Refills" value={`${rxData.refills}${rxData.refillRationale ? ` — ${rxData.refillRationale}` : ''}`} />}
          {encounterData.dispenseElsewhere && <Row label="Dispensed At" value={encounterData.dispensingPharmacy || 'Another pharmacy'} />}
        </Section>
      ) : drugFromTemplate ? (
        <Section title="Prescription">
          <Row label="Drug" value={`${drugFromTemplate.drugName || drugFromTemplate.drug}${drugFromTemplate.brandName ? ` (${drugFromTemplate.brandName})` : ''}`} />
          {drugFromTemplate.dosageForm && <Row label="Form" value={drugFromTemplate.dosageForm} />}
          <Row label="Directions" value={drugFromTemplate.sig} />
          <Row label="Quantity" value={String(drugFromTemplate.qty)} />
          <Row label="Days Supply" value={String(drugFromTemplate.supplyDays || drugFromTemplate.supply)} />
          {rxData.refills > 0 && <Row label="Refills" value={`${rxData.refills}${rxData.refillRationale ? ` — ${rxData.refillRationale}` : ''}`} />}
        </Section>
      ) : selectedDrugIndex === -1 ? (
        <Section title="Treatment — No Prescription">
          <Row label="Decision" value="No prescription issued" />
          <Row label="Reason" value={rxData.noRxReason || '—'} />
          {rxData.noRxRationale && <Row label="Rationale" value={rxData.noRxRationale} />}
          {rxData.otcRecommendation && <Row label="OTC Recommended" value={rxData.otcRecommendation} />}
        </Section>
      ) : (
        <Section title="Treatment">
          <Row label="Decision" value="No treatment documented" />
        </Section>
      )}

      {/* Clinical Notes */}
      {(rxData.impression || rxData.counselling) && (
        <Section title="Clinical Notes">
          {rxData.impression && <Row label="Impression" value={rxData.impression} />}
          {rxData.counselling && <Row label="Counselling" value={rxData.counselling} />}
        </Section>
      )}

      {/* Follow-Up */}
      <Section title="Follow-Up Plan">
        <Row label="Timeframe" value={rxData.followUpTime || '—'} />
        <Row label="Method" value={rxData.followUpMethod || '—'} />
        <Row label="Plan" value={rxData.followUpPlan || '—'} />
        <Row label="Seek Urgent Care" value={rxData.urgentCriteria || '—'} />
      </Section>

      {/* Billing */}
      <Section title="ODB Billing">
        <Row label="Service Code" value={billingServiceCode} />
        <Row label="PIN" value={billingPin} />
        <Row label="Fee" value={billingFee} />
        <Row label="Intervention Code" value="PS" />
        <Row label="Prescriber ID Ref" value="09" />
        {(assessment.outcome === 'referred_physician' || rxData.isReferral) && <Row label="SSC" value="4 (Referral)" />}
      </Section>

      {/* Authorization */}
      <Section title="Authorization">
        <Row label="Pharmacist" value={`${pharmacist.first_name} ${pharmacist.last_name}, RPh`} />
        <Row label="OCP Registration" value={pharmacist.ocp_registration_number} />
        <Row label="Pharmacy" value={`${pharmacy.name} — OCP #${pharmacy.ocp_accreditation_number}`} />
      </Section>

      <div style={{ marginTop: 30 }}>
        <div style={{ borderBottom: '1px solid #333', width: '50%', marginBottom: 4 }}>&nbsp;</div>
        <div style={{ fontSize: 10, color: '#999' }}>Pharmacist Signature</div>
      </div>

      <div style={{ marginTop: 30, fontSize: 9, color: '#999', borderTop: '1px solid #ddd', paddingTop: 8 }}>
        This is a confidential clinical record protected under PHIPA and PIPEDA. Assessment ID: {assessment.id}
      </div>
    </div>
  )
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: 'Arial' }}>Loading...</div>}>
      <PrintContent />
    </Suspense>
  )
}
