import { createClient } from '@/lib/supabase/client'

export async function searchPatients(pharmacyId: string, query: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .or(`last_name.ilike.%${query}%,first_name.ilike.%${query}%,health_card_number.ilike.%${query}%`)
    .order('last_name')
    .limit(20)
  return data || []
}

export async function createPatient(pharmacyId: string, staffId: string, patient: any) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('patients')
    .insert({
      pharmacy_id: pharmacyId,
      created_by: staffId,
      first_name: patient.firstName,
      last_name: patient.lastName,
      date_of_birth: patient.dob,
      health_card_number: patient.hcn || null,
      phone: patient.phone || null,
      primary_care_provider_name: patient.pcpName || null,
      pcp_fax: patient.pcpFax || null,
      has_pcp: patient.hasPcp !== false,
      allergies: patient.allergies ? [{ allergen: patient.allergies, reaction: '', severity: '' }] : [],
      current_medications: patient.medications ? [{ drug: patient.medications, dose: '', frequency: '' }] : [],
      consent_digital_records: true,
      consent_date: new Date().toISOString(),
    })
    .select()
    .single()
  return { data, error }
}

export async function getAilment(code: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('minor_ailments')
    .select('*')
    .eq('code', code)
    .single()
  return data
}

export async function createAssessment(pharmacyId: string, patientId: string, pharmacistId: string, ailmentId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      pharmacy_id: pharmacyId,
      patient_id: patientId,
      pharmacist_id: pharmacistId,
      ailment_id: ailmentId,
      status: 'draft',
      clinical_data: {},
    })
    .select()
    .single()
  return { data, error }
}

export async function saveDraft(assessmentId: string, clinicalData: any, currentStep: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from('assessments')
    .update({
      clinical_data: { ...clinicalData, _currentStep: currentStep },
      status: 'in_progress',
    })
    .eq('id', assessmentId)
    .eq('is_locked', false)
  return { error }
}

export async function completeAssessment(assessmentId: string, clinicalData: any, outcome: string, impression: string) {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('assessments')
    .update({
      clinical_data: clinicalData,
      status: 'completed',
      outcome,
      clinical_impression: impression,
      completed_at: now,
      is_locked: true,
      locked_at: now,
    })
    .eq('id', assessmentId)
    .eq('is_locked', false)
    .select()
    .single()
  return { data, error }
}

export async function createPrescription(assessmentId: string, pharmacyId: string, patientId: string, pharmacistId: string, drug: any) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      assessment_id: assessmentId,
      pharmacy_id: pharmacyId,
      patient_id: patientId,
      pharmacist_id: pharmacistId,
      drug_name: drug.drugName || drug.drug,
      din: drug.din || null,
      strength: drug.dosageForm || drug.strength || '',
      dosage_form: drug.dosageForm || drug.form || '',
      directions: drug.sig,
      quantity: String(drug.qty),
      days_supply: drug.supplyDays || drug.supply,
      is_odb_eligible: drug.odbEligible ?? drug.odb_eligible ?? true,
    })
    .select()
    .single()
  return { data, error }
}

export async function createPcpNotification(assessmentId: string, patientId: string, pharmacyId: string, pcp: any, content: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pcp_notifications')
    .insert({
      assessment_id: assessmentId,
      patient_id: patientId,
      pharmacy_id: pharmacyId,
      pcp_name: pcp.name,
      pcp_fax: pcp.fax || null,
      notification_method: pcp.fax ? 'fax' : 'printed',
      notification_content: content,
      status: 'pending',
    })
    .select()
    .single()
  return { data, error }
}

export async function createClaim(
  assessmentId: string,
  pharmacyId: string,
  patientId: string,
  ailment: any,
  encounterMode: string,
  rxIssued: boolean,
  isReferral: boolean
) {
  const supabase = createClient()
  const isVirtual = encounterMode !== 'in_person'
  let pin = ''
  let fee = 0

  if (rxIssued && !isVirtual) {
    pin = ailment.pin_rx_in_person
    fee = ailment.fee_in_person_cents || 1900
  } else if (!rxIssued && !isVirtual) {
    pin = ailment.pin_no_rx_in_person
    fee = ailment.fee_in_person_cents || 1900
  } else if (rxIssued && isVirtual) {
    pin = ailment.pin_rx_virtual
    fee = ailment.fee_virtual_cents || 1500
  } else {
    pin = ailment.pin_no_rx_virtual
    fee = ailment.fee_virtual_cents || 1500
  }

  const { data, error } = await supabase
    .from('claims')
    .insert({
      assessment_id: assessmentId,
      pharmacy_id: pharmacyId,
      patient_id: patientId,
      service_code: ailment.odb_service_code,
      pin_code: pin,
      pin_used: pin,
      claim_amount_cents: fee,
      special_service_code: isReferral ? '4' : null,
      prescriber_id_ref: '09',
      status: 'unbilled',
    })
    .select()
    .single()
  return { data, error }
}

// ============================================================
// DRAFT RESUME & ADDENDUM FUNCTIONS
// ============================================================

/**
 * Load a specific assessment by ID with all related data.
 * Used for resuming drafts and viewing completed records.
 */
export async function getAssessmentById(assessmentId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('assessments')
    .select('*, patients(*), minor_ailments(*)')
    .eq('id', assessmentId)
    .single()
  if (error) console.error('Assessment load error:', error)
  return data
}

/**
 * Add an addendum to a completed (locked) assessment.
 * Does not modify the original clinical_data — appends to a separate addenda array.
 */
export async function addAddendum(assessmentId: string, staffId: string, staffName: string, note: string) {
  const supabase = createClient()
  // First get current addenda
  const { data: current } = await supabase
    .from('assessments')
    .select('clinical_data')
    .eq('id', assessmentId)
    .single()

  const existingAddenda = current?.clinical_data?.addenda || []
  const newAddendum = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    staffId,
    staffName,
    note,
  }

  // Update only the addenda array inside clinical_data (does not touch other fields)
  const { data, error } = await supabase
    .from('assessments')
    .update({
      clinical_data: {
        ...current?.clinical_data,
        addenda: [...existingAddenda, newAddendum],
      },
    })
    .eq('id', assessmentId)
    .select()
    .single()

  return { data, error }
}

// ============================================================
// FOLLOW-UP FUNCTIONS
// ============================================================

/**
 * Calculate a due date from a follow-up timeframe string.
 * Maps common timeframe values to actual dates from now.
 */
export function calculateFollowUpDueDate(timeframe: string): Date {
  const now = new Date()
  const lower = timeframe.toLowerCase().trim()

  // Map timeframe strings to hours
  const mappings: Record<string, number> = {
    '24-48 hours': 48,
    '48-72 hours': 72,
    '3-5 days': 4 * 24,       // midpoint: 4 days
    '7 days': 7 * 24,
    '2 weeks': 14 * 24,
    '4 weeks': 28 * 24,
    '4-8 weeks': 6 * 7 * 24,  // midpoint: 6 weeks
    '8-12 weeks': 10 * 7 * 24,// midpoint: 10 weeks
    '3 months': 90 * 24,
    '30 days': 30 * 24,
    'as needed': 14 * 24,      // default to 2 weeks
  }

  const hours = mappings[lower] || 72 // default: 72 hours if unrecognized
  const dueDate = new Date(now.getTime() + hours * 60 * 60 * 1000)
  return dueDate
}

/**
 * Create a follow-up record after assessment completion.
 * Auto-calculates due date from the follow-up timeframe.
 */
export async function createFollowUp(
  assessmentId: string,
  pharmacyId: string,
  patientId: string,
  pharmacistId: string,
  followUpData: {
    timeframe?: string
    method?: string
    plan?: string
    urgentCriteria?: string
  }
) {
  const supabase = createClient()
  const timeframe = followUpData.timeframe || '48-72 hours'
  const dueDate = calculateFollowUpDueDate(timeframe)

  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      assessment_id: assessmentId,
      pharmacy_id: pharmacyId,
      patient_id: patientId,
      pharmacist_id: pharmacistId,
      due_date: dueDate.toISOString(),
      follow_up_timeframe: timeframe,
      follow_up_method: followUpData.method || null,
      follow_up_plan: followUpData.plan || null,
      urgent_criteria: followUpData.urgentCriteria || null,
      status: 'pending',
    })
    .select()
    .single()
  return { data, error }
}

/**
 * Get pending and overdue follow-ups for the dashboard.
 * Returns follow-ups ordered by due date (overdue first, then upcoming).
 */
export async function getFollowUps(pharmacyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*, patients(first_name, last_name, phone), assessments(minor_ailments(name, code))')
    .eq('pharmacy_id', pharmacyId)
    .in('status', ['pending'])
    .order('due_date', { ascending: true })
    .limit(50)

  if (error) console.error('Follow-up fetch error:', error)
  return data || []
}

/**
 * Complete a follow-up with outcome documentation.
 */
export async function completeFollowUp(
  followUpId: string,
  staffId: string,
  outcome: string,
  notes: string
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('follow_ups')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: staffId,
      outcome,
      outcome_notes: notes,
    })
    .eq('id', followUpId)
    .select()
    .single()
  return { data, error }
}

// ============================================================
// DASHBOARD FUNCTIONS
// ============================================================

export async function getTodayAssessments(pharmacyId: string) {
  const supabase = createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from('assessments')
    .select('id, status, outcome, created_at, patient_id, patients(first_name, last_name), minor_ailments(name, code)')
    .eq('pharmacy_id', pharmacyId)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .order('created_at', { ascending: false })

  if (error) console.error('Assessment fetch error:', error)
  return data || []
}
