'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generatePcpLetterContent } from '@/lib/pdf-generate'

const DRUGS = [
  { drug: "Nitrofurantoin (MacroBID)", strength: "100mg", sig: "100mg BID × 5 days", qty: 10, supply: 5 },
  { drug: "TMP-SMX (Septra DS)", strength: "160/800mg", sig: "1 tab BID × 3 days", qty: 6, supply: 3 },
  { drug: "Fosfomycin (Monurol)", strength: "3g", sig: "3g single dose in water", qty: 1, supply: 1 },
]

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

      console.log('Assessment:', assessment)
      console.log('Error:', assessError)

      if (!assessment) return

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

      setData({ assessment, pharmacy, prescription })
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

  const { assessment, pharmacy, prescription } = data
  const patient = assessment.patients
  const pharmacist = assessment.staff
  const ailment = assessment.minor_ailments
  const cd = assessment.clinical_data || {}
  const date = new Date(assessment.completed_at || assessment.created_at).toLocaleDateString('en-CA')
  const time = new Date(assessment.completed_at || assessment.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
  const refId = assessment.id.slice(0, 8).toUpperCase()

  const symptoms = []
  if (cd.symptoms?.dysuria) symptoms.push('Dysuria')
  if (cd.symptoms?.frequency) symptoms.push('Urinary frequency')
  if (cd.symptoms?.urgency) symptoms.push('Urinary urgency')
  if (cd.symptoms?.suprapubic) symptoms.push('Suprapubic pain')
  if (cd.symptoms?.hematuria) symptoms.push('Hematuria')
  if (cd.symptoms?.cloudy) symptoms.push('Cloudy/foul-smelling urine')

  const redFlagsList = Object.entries(cd.redFlags || {}).filter(([_, v]) => v === true).map(([k]) => k)
  const drugIndex = cd.prescription?.selectedDrug
  const drug = drugIndex != null ? DRUGS[drugIndex] : null

  if (mode === 'pcp') {
    const letterContent = generatePcpLetterContent(
      patient, pharmacy, pharmacist, ailment, drug,
      cd.prescription?.impression || '', date
    )
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

  const Row = ({ label, value }: { label: string; value: string }) => (
    <tr>
      <td style={{ padding: '4px 12px', fontWeight: 'bold', color: '#555', width: '35%', borderBottom: '1px solid #eee', fontSize: 11 }}>{label}</td>
      <td style={{ padding: '4px 12px', borderBottom: '1px solid #eee', fontSize: 11 }}>{value || '—'}</td>
    </tr>
  )

  const Section = ({ title, children }: { title: string; children: any }) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', background: '#f5f5f5', padding: '4px 12px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{children}</tbody></table>
    </div>
  )

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

      <Section title="Patient Information">
        <Row label="Name" value={`${patient.first_name} ${patient.last_name}`} />
        <Row label="Date of Birth" value={patient.date_of_birth} />
        <Row label="Health Card" value={patient.health_card_number || 'Not provided'} />
        <Row label="Phone" value={patient.phone || 'N/A'} />
        <Row label="PCP" value={patient.primary_care_provider_name || 'No PCP'} />
        <Row label="Allergies" value={patient.allergies?.map((a: any) => a.allergen).join(', ') || 'NKDA'} />
        <Row label="Medications" value={patient.current_medications?.map((m: any) => m.drug).join(', ') || 'None'} />
      </Section>

      <Section title={`Clinical Assessment — ${ailment.name}`}>
        <Row label="Eligibility" value={`Age ≥16: ${cd.eligibility?.age16 ? 'Yes' : '—'} | Sex: ${cd.eligibility?.sex || '—'} | Pregnancy: ${cd.eligibility?.pregnancy || '—'}`} />
        <Row label="Symptoms" value={symptoms.join(', ') || 'None documented'} />
        <Row label="Duration" value={cd.symptoms?.duration || '—'} />
        {cd.symptoms?.notes && <Row label="Notes" value={cd.symptoms.notes} />}
        <Row label="Red Flags" value={redFlagsList.length > 0 ? `⚠ POSITIVE: ${redFlagsList.join(', ')}` : '✓ None identified'} />
      </Section>

      {drug && (
        <Section title="Prescription">
          <Row label="Drug" value={drug.drug} />
          <Row label="Directions" value={drug.sig} />
          <Row label="Quantity" value={`${drug.qty}`} />
          <Row label="Days Supply" value={`${drug.supply}`} />
        </Section>
      )}

      {(cd.prescription?.impression || cd.prescription?.counselling) && (
        <Section title="Clinical Notes">
          {cd.prescription?.impression && <Row label="Impression" value={cd.prescription.impression} />}
          {cd.prescription?.counselling && <Row label="Counselling" value={cd.prescription.counselling} />}
        </Section>
      )}

      <Section title="Billing">
        <Row label="Service Code" value={ailment.odb_service_code} />
        <Row label="Fee" value={`$${(ailment.consultation_fee_cents / 100).toFixed(2)}`} />
      </Section>

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