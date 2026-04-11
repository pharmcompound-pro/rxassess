export function generateAssessmentText(assessment: any, patient: any, pharmacy: any, pharmacist: any, ailment: any, prescription: any, drug: any) {
  const date = new Date(assessment.completed_at || assessment.created_at).toLocaleDateString('en-CA')
  const time = new Date(assessment.completed_at || assessment.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
  const refId = assessment.id.slice(0, 8).toUpperCase()
  const cd = assessment.clinical_data || {}

  const symptoms = []
  if (cd.symptoms?.dysuria) symptoms.push('Dysuria')
  if (cd.symptoms?.frequency) symptoms.push('Urinary frequency')
  if (cd.symptoms?.urgency) symptoms.push('Urinary urgency')
  if (cd.symptoms?.suprapubic) symptoms.push('Suprapubic pain')
  if (cd.symptoms?.hematuria) symptoms.push('Hematuria')
  if (cd.symptoms?.cloudy) symptoms.push('Cloudy/foul-smelling urine')

  const redFlagsList = Object.entries(cd.redFlags || {}).filter(([_, v]) => v === true).map(([k]) => k)

  return {
    date, time, refId, symptoms, redFlagsList,
    eligibility: cd.eligibility || {},
    symptomDuration: cd.symptoms?.duration || '',
    impression: cd.prescription?.impression || '',
    counselling: cd.prescription?.counselling || '',
  }
}

export function generatePcpLetterContent(patient: any, pharmacy: any, pharmacist: any, ailment: any, drug: any, impression: string, date: string) {
  return `Dear ${patient.primary_care_provider_name || 'Doctor'},

RE: ${patient.first_name} ${patient.last_name} (DOB: ${patient.date_of_birth})

This letter is to notify you that the above-named patient presented at ${pharmacy.name} on ${date} for assessment of ${ailment.name} under the Ontario Minor Ailments Program (O. Reg. 256/24 under the Pharmacy Act, 1991).

ASSESSMENT SUMMARY:
${impression || 'Clinical assessment consistent with uncomplicated presentation. No red flags identified.'}

TREATMENT:
${drug ? `${drug.drug} — ${drug.sig}` : 'No prescription issued.'}

This notification is provided in accordance with OCP requirements for pharmacist prescribing for minor ailments. The patient was advised to follow up with their primary care provider if symptoms do not improve within 48-72 hours or if symptoms worsen.

Please do not hesitate to contact us if you have any questions.

Respectfully,

${pharmacist.first_name} ${pharmacist.last_name}, RPh
OCP Registration: ${pharmacist.ocp_registration_number}
${pharmacy.name}
${pharmacy.address_line1}
${pharmacy.city}, ${pharmacy.province} ${pharmacy.postal_code}
Tel: ${pharmacy.phone}
Fax: ${pharmacy.fax || 'N/A'}`
}