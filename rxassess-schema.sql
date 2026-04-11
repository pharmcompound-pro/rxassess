-- ============================================================================
-- RxAssess — Minor Ailment Clinical Documentation Platform
-- Database Schema v1.0 (Supabase / PostgreSQL)
-- PIPEDA + PHIPA Compliant Design
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('owner', 'pharmacist', 'intern', 'technician');
CREATE TYPE assessment_status AS ENUM ('draft', 'in_progress', 'completed', 'referred', 'voided');
CREATE TYPE assessment_outcome AS ENUM ('prescribed', 'referred_physician', 'referred_er', 'self_care', 'no_treatment');
CREATE TYPE consent_type AS ENUM ('minor_ailment_assessment', 'poct_testing', 'data_collection', 'pcp_notification');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'acknowledged', 'failed');
CREATE TYPE claim_status AS ENUM ('unbilled', 'submitted', 'accepted', 'rejected');
CREATE TYPE poct_result AS ENUM ('positive', 'negative', 'invalid', 'not_performed');
CREATE TYPE sex_at_birth AS ENUM ('male', 'female', 'intersex', 'unknown');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Pharmacy locations (multi-tenant root)
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ocp_accreditation_number VARCHAR(20) NOT NULL UNIQUE,  -- OCP #
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    province VARCHAR(2) NOT NULL DEFAULT 'ON',
    postal_code VARCHAR(7) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    fax VARCHAR(20),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Staff / users (pharmacists, interns, techs)
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    auth_user_id UUID UNIQUE,  -- links to Supabase auth.users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    ocp_registration_number VARCHAR(20),  -- Part A pharmacists
    role user_role NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    can_prescribe BOOLEAN NOT NULL DEFAULT FALSE,  -- Part A pharmacists + interns only
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_staff_per_pharmacy UNIQUE (pharmacy_id, email)
);

CREATE INDEX idx_staff_pharmacy ON staff(pharmacy_id);
CREATE INDEX idx_staff_auth_user ON staff(auth_user_id);

-- ============================================================================
-- PATIENT TABLES
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    
    -- Demographics
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    sex_at_birth sex_at_birth,
    health_card_number VARCHAR(12),  -- Ontario HCN (10 digits + 2-char version)
    health_card_version VARCHAR(2),
    
    -- Contact
    phone VARCHAR(20),
    email VARCHAR(255),
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    postal_code VARCHAR(7),
    
    -- Clinical context
    primary_care_provider_name VARCHAR(255),
    pcp_phone VARCHAR(20),
    pcp_fax VARCHAR(20),
    pcp_email VARCHAR(255),
    has_pcp BOOLEAN DEFAULT TRUE,
    
    -- Allergies & medications stored as JSONB for flexibility
    -- Structure: [{"allergen": "Penicillin", "reaction": "Anaphylaxis", "severity": "severe"}]
    allergies JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{"drug": "Metformin", "dose": "500mg", "frequency": "BID", "prescriber": "Dr. Smith"}]
    current_medications JSONB DEFAULT '[]'::jsonb,
    -- Structure: ["diabetes", "hypertension", "asthma"]
    medical_conditions JSONB DEFAULT '[]'::jsonb,
    
    -- Privacy
    consent_digital_records BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES staff(id),
    
    CONSTRAINT unique_patient_per_pharmacy UNIQUE (pharmacy_id, health_card_number, health_card_version)
);

CREATE INDEX idx_patients_pharmacy ON patients(pharmacy_id);
CREATE INDEX idx_patients_name ON patients(pharmacy_id, last_name, first_name);
CREATE INDEX idx_patients_dob ON patients(pharmacy_id, date_of_birth);
CREATE INDEX idx_patients_hcn ON patients(pharmacy_id, health_card_number);

-- ============================================================================
-- MINOR AILMENT DEFINITIONS (reference data)
-- ============================================================================

CREATE TABLE minor_ailments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,           -- e.g., 'UTI', 'ACNE', 'GERD'
    name VARCHAR(255) NOT NULL,                  -- e.g., 'Uncomplicated Urinary Tract Infection'
    category VARCHAR(100),                       -- e.g., 'Infectious', 'Dermatological', 'GI'
    odb_service_code VARCHAR(20),                -- ODB PIN code for billing
    max_annual_claims INTEGER NOT NULL DEFAULT 2, -- ODB annual limit per patient
    consultation_fee_cents INTEGER,               -- ODB fee in cents
    effective_date DATE NOT NULL,                 -- When ailment became prescribable
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Clinical reference
    red_flags JSONB DEFAULT '[]'::jsonb,         -- Conditions requiring referral
    eligible_drugs JSONB DEFAULT '[]'::jsonb,    -- ODB-eligible treatment options
    exclusion_criteria JSONB DEFAULT '[]'::jsonb, -- Who cannot be treated
    
    -- Form template definition
    -- Structure defines the dynamic assessment form fields
    assessment_template JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ASSESSMENT (the core clinical encounter)
-- ============================================================================

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    pharmacist_id UUID NOT NULL REFERENCES staff(id),
    ailment_id UUID NOT NULL REFERENCES minor_ailments(id),
    
    -- Status tracking
    status assessment_status NOT NULL DEFAULT 'draft',
    outcome assessment_outcome,
    
    -- Clinical assessment data (structured per ailment template)
    -- This JSONB stores all symptom responses, clinical findings, etc.
    clinical_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Decision & rationale
    clinical_impression TEXT,         -- Pharmacist's assessment summary
    referral_reason TEXT,             -- If referred, why
    self_care_advice TEXT,            -- Advice given if no Rx
    
    -- Red flags identified
    red_flags_checked JSONB DEFAULT '[]'::jsonb,
    red_flags_present BOOLEAN DEFAULT FALSE,
    
    -- POCT results (if applicable)
    poct_performed BOOLEAN DEFAULT FALSE,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Immutability: once completed, record is locked
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES staff(id),
    
    -- Voiding (soft delete with reason — never hard delete PHI)
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES staff(id),
    void_reason TEXT
);

CREATE INDEX idx_assessments_pharmacy ON assessments(pharmacy_id);
CREATE INDEX idx_assessments_patient ON assessments(patient_id);
CREATE INDEX idx_assessments_pharmacist ON assessments(pharmacist_id);
CREATE INDEX idx_assessments_ailment ON assessments(ailment_id);
CREATE INDEX idx_assessments_status ON assessments(pharmacy_id, status);
CREATE INDEX idx_assessments_date ON assessments(pharmacy_id, created_at DESC);

-- ============================================================================
-- PRESCRIPTIONS (generated from assessments)
-- ============================================================================

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    pharmacist_id UUID NOT NULL REFERENCES staff(id),
    
    -- Drug details
    drug_name VARCHAR(255) NOT NULL,
    din VARCHAR(8),                              -- Drug Identification Number
    strength VARCHAR(50),
    dosage_form VARCHAR(100),
    directions TEXT NOT NULL,                     -- Sig
    quantity VARCHAR(50) NOT NULL,
    quantity_unit VARCHAR(50),                    -- tablets, mL, etc.
    days_supply INTEGER,
    refills INTEGER NOT NULL DEFAULT 0,
    
    -- ODB specifics
    is_odb_eligible BOOLEAN DEFAULT FALSE,
    odb_benefit_code VARCHAR(20),
    exceptional_access_required BOOLEAN DEFAULT FALSE,
    
    -- Dispensing
    dispense_at_own_pharmacy BOOLEAN DEFAULT TRUE,
    dispensed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_assessment ON prescriptions(assessment_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);

-- ============================================================================
-- PCP NOTIFICATIONS (OCP requirement)
-- ============================================================================

CREATE TABLE pcp_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    
    pcp_name VARCHAR(255),
    pcp_fax VARCHAR(20),
    pcp_email VARCHAR(255),
    
    notification_method VARCHAR(20),  -- 'fax', 'email', 'printed', 'phone'
    status notification_status NOT NULL DEFAULT 'pending',
    
    -- Content
    notification_content TEXT,        -- Generated letter content
    
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pcp_notifications_assessment ON pcp_notifications(assessment_id);
CREATE INDEX idx_pcp_notifications_status ON pcp_notifications(pharmacy_id, status);

-- ============================================================================
-- BILLING / CLAIMS TRACKING
-- ============================================================================

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    
    -- ODB claim details
    service_code VARCHAR(20) NOT NULL,
    pin_code VARCHAR(20),
    claim_amount_cents INTEGER,
    
    status claim_status NOT NULL DEFAULT 'unbilled',
    
    submitted_at TIMESTAMPTZ,
    response_code VARCHAR(20),        -- HNS response
    response_message TEXT,
    
    -- Annual tracking
    claim_count_this_year INTEGER,    -- nth claim for this patient/ailment this year
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_assessment ON claims(assessment_id);
CREATE INDEX idx_claims_status ON claims(pharmacy_id, status);

-- ============================================================================
-- POINT-OF-CARE TESTING (future-ready)
-- ============================================================================

CREATE TABLE poct_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    performed_by UUID NOT NULL REFERENCES staff(id),
    
    test_name VARCHAR(255) NOT NULL,             -- e.g., 'Rapid Strep A', 'Urine Dipstick'
    test_device VARCHAR(255),                    -- Device/kit name
    lot_number VARCHAR(100),
    expiry_date DATE,
    
    result poct_result NOT NULL,
    result_value VARCHAR(255),                   -- Quantitative result if applicable
    result_details JSONB DEFAULT '{}'::jsonb,    -- e.g., dipstick panel results
    
    qc_performed BOOLEAN DEFAULT FALSE,
    qc_date DATE,
    qc_result VARCHAR(255),
    
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poct_assessment ON poct_results(assessment_id);

-- ============================================================================
-- CONSENT RECORDS (PHIPA requirement)
-- ============================================================================

CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    assessment_id UUID REFERENCES assessments(id),
    
    consent_type consent_type NOT NULL,
    granted BOOLEAN NOT NULL,
    
    -- Capture method
    signature_data TEXT,              -- Base64 signature image (optional)
    verbal_consent BOOLEAN DEFAULT FALSE,
    witnessed_by UUID REFERENCES staff(id),
    
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    ip_address INET,                  -- For digital consent audit trail
    user_agent TEXT
);

CREATE INDEX idx_consent_patient ON consent_records(patient_id);
CREATE INDEX idx_consent_assessment ON consent_records(assessment_id);

-- ============================================================================
-- AUDIT LOG (PIPEDA / PHIPA compliance — immutable append-only)
-- ============================================================================

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
    staff_id UUID REFERENCES staff(id),
    
    action VARCHAR(50) NOT NULL,      -- 'view', 'create', 'update', 'export', 'print', 'login'
    entity_type VARCHAR(50) NOT NULL, -- 'patient', 'assessment', 'prescription', etc.
    entity_id UUID,
    
    details JSONB DEFAULT '{}'::jsonb, -- What changed
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition audit log by month for performance (optional for MVP)
CREATE INDEX idx_audit_pharmacy ON audit_log(pharmacy_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_staff ON audit_log(staff_id);
CREATE INDEX idx_audit_date ON audit_log(created_at DESC);

-- ============================================================================
-- ROW-LEVEL SECURITY (Supabase multi-tenancy)
-- ============================================================================

ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE poct_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see data from their own pharmacy
-- (Applied via staff.pharmacy_id linked to auth.users)

CREATE POLICY pharmacy_isolation ON patients
    FOR ALL
    USING (pharmacy_id IN (
        SELECT pharmacy_id FROM staff WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY pharmacy_isolation ON assessments
    FOR ALL
    USING (pharmacy_id IN (
        SELECT pharmacy_id FROM staff WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY pharmacy_isolation ON prescriptions
    FOR ALL
    USING (pharmacy_id IN (
        SELECT pharmacy_id FROM staff WHERE auth_user_id = auth.uid()
    ));

-- (Repeat for all PHI tables)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Count claims for a patient/ailment in the past 365 days (ODB annual max check)
CREATE OR REPLACE FUNCTION get_annual_claim_count(
    p_patient_id UUID,
    p_ailment_id UUID
) RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER
    FROM claims c
    JOIN assessments a ON c.assessment_id = a.id
    WHERE c.patient_id = p_patient_id
      AND a.ailment_id = p_ailment_id
      AND c.status IN ('submitted', 'accepted')
      AND c.created_at >= NOW() - INTERVAL '365 days';
$$ LANGUAGE SQL STABLE;

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pharmacies_timestamp BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_staff_timestamp BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_assessments_timestamp BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_claims_timestamp BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- SEED DATA: UTI Minor Ailment Template
-- ============================================================================

INSERT INTO minor_ailments (
    code, name, category, odb_service_code, max_annual_claims,
    consultation_fee_cents, effective_date, 
    red_flags, eligible_drugs, exclusion_criteria, assessment_template
) VALUES (
    'UTI',
    'Uncomplicated Urinary Tract Infection',
    'Infectious',
    'MA-UTI',
    2,
    1800,  -- $18.00
    '2023-01-01',
    
    -- Red Flags (require referral)
    '[
        "Fever > 38°C or chills",
        "Flank pain or costovertebral angle tenderness",
        "Nausea or vomiting",
        "Symptoms > 7 days or recurrent (≥3 in 12 months)",
        "Vaginal discharge (consider STI/vaginitis)",
        "Pregnant or suspected pregnancy",
        "Male patient",
        "Pediatric patient (< 16 years)",
        "Immunocompromised",
        "Diabetes (poorly controlled)",
        "Known urinary tract abnormality",
        "Indwelling catheter",
        "Recent urinary tract instrumentation",
        "Symptoms recurred within 2 weeks of treatment"
    ]'::jsonb,
    
    -- Eligible Drugs
    '[
        {
            "drug": "Nitrofurantoin",
            "brand": "MacroBID",
            "din": "02163918",
            "strength": "100mg",
            "form": "capsule",
            "sig": "100mg BID x 5 days",
            "quantity": 10,
            "days_supply": 5,
            "first_line": true,
            "odb_eligible": true,
            "notes": "Take with food. Avoid if CrCl < 30 mL/min."
        },
        {
            "drug": "Trimethoprim-Sulfamethoxazole",
            "brand": "Septra DS",
            "din": "00272469",
            "strength": "160/800mg",
            "form": "tablet",
            "sig": "1 tablet BID x 3 days",
            "quantity": 6,
            "days_supply": 3,
            "first_line": false,
            "odb_eligible": true,
            "notes": "Second-line. Check sulfa allergy. Avoid in G6PD deficiency."
        },
        {
            "drug": "Fosfomycin",
            "brand": "Monurol",
            "din": "02242463",
            "strength": "3g",
            "form": "sachet",
            "sig": "3g single dose dissolved in water",
            "quantity": 1,
            "days_supply": 1,
            "first_line": false,
            "odb_eligible": true,
            "notes": "Single dose. Good option for adherence concerns."
        }
    ]'::jsonb,
    
    -- Exclusion Criteria
    '[
        "Male patients",
        "Patients under 16 years of age",
        "Pregnant or breastfeeding",
        "Patients with indwelling catheters",
        "Known urinary tract structural abnormalities",
        "Immunocompromised patients",
        "Recurrent UTI (≥3 in past 12 months or ≥2 in past 6 months)"
    ]'::jsonb,
    
    -- Assessment Template (defines the form fields)
    '{
        "sections": [
            {
                "id": "eligibility",
                "title": "Eligibility Screening",
                "fields": [
                    {"id": "age_check", "type": "boolean", "label": "Patient is ≥ 16 years old", "required": true, "fail_value": false, "fail_action": "exclude"},
                    {"id": "sex_check", "type": "select", "label": "Sex at birth", "options": ["Female", "Male", "Intersex"], "required": true, "fail_value": "Male", "fail_action": "exclude"},
                    {"id": "pregnancy_check", "type": "select", "label": "Pregnancy status", "options": ["Not pregnant", "Pregnant", "Possibly pregnant", "Breastfeeding"], "required": true, "fail_value": ["Pregnant", "Possibly pregnant"], "fail_action": "exclude"},
                    {"id": "catheter_check", "type": "boolean", "label": "No indwelling urinary catheter", "required": true, "fail_value": false, "fail_action": "exclude"},
                    {"id": "recurrence_check", "type": "boolean", "label": "No recurrent UTIs (< 3 in 12 months)", "required": true, "fail_value": false, "fail_action": "refer"}
                ]
            },
            {
                "id": "symptoms",
                "title": "Symptom Assessment",
                "fields": [
                    {"id": "dysuria", "type": "boolean", "label": "Dysuria (painful urination)", "required": true},
                    {"id": "frequency", "type": "boolean", "label": "Urinary frequency", "required": true},
                    {"id": "urgency", "type": "boolean", "label": "Urinary urgency", "required": true},
                    {"id": "suprapubic_pain", "type": "boolean", "label": "Suprapubic pain/pressure", "required": false},
                    {"id": "hematuria", "type": "boolean", "label": "Hematuria (blood in urine)", "required": false},
                    {"id": "cloudy_urine", "type": "boolean", "label": "Cloudy or foul-smelling urine", "required": false},
                    {"id": "symptom_duration", "type": "select", "label": "Symptom duration", "options": ["< 24 hours", "1-3 days", "4-7 days", "> 7 days"], "required": true, "fail_value": "> 7 days", "fail_action": "refer"},
                    {"id": "symptom_notes", "type": "textarea", "label": "Additional symptom notes", "required": false}
                ]
            },
            {
                "id": "red_flags",
                "title": "Red Flag Assessment",
                "description": "Check ALL that apply. Any positive finding requires referral.",
                "fields": [
                    {"id": "fever", "type": "boolean", "label": "Fever > 38°C or chills", "is_red_flag": true},
                    {"id": "flank_pain", "type": "boolean", "label": "Flank pain or CVA tenderness", "is_red_flag": true},
                    {"id": "nausea_vomiting", "type": "boolean", "label": "Nausea or vomiting", "is_red_flag": true},
                    {"id": "vaginal_discharge", "type": "boolean", "label": "Vaginal discharge present", "is_red_flag": true},
                    {"id": "immunocompromised", "type": "boolean", "label": "Immunocompromised", "is_red_flag": true},
                    {"id": "uncontrolled_diabetes", "type": "boolean", "label": "Poorly controlled diabetes", "is_red_flag": true},
                    {"id": "recent_instrumentation", "type": "boolean", "label": "Recent urinary tract instrumentation", "is_red_flag": true},
                    {"id": "recent_treatment_failure", "type": "boolean", "label": "Symptoms recurred within 2 weeks of prior treatment", "is_red_flag": true}
                ]
            },
            {
                "id": "allergies_check",
                "title": "Allergy & Medication Review",
                "fields": [
                    {"id": "allergies_reviewed", "type": "boolean", "label": "Patient allergies reviewed and documented", "required": true},
                    {"id": "medications_reviewed", "type": "boolean", "label": "Current medications reviewed for interactions", "required": true},
                    {"id": "renal_function", "type": "select", "label": "Renal function status", "options": ["Normal/Unknown", "CrCl 30-60 mL/min", "CrCl < 30 mL/min"], "required": true},
                    {"id": "sulfa_allergy", "type": "boolean", "label": "Sulfonamide allergy", "required": true},
                    {"id": "nitrofurantoin_contraindication", "type": "boolean", "label": "Nitrofurantoin contraindication identified", "required": false}
                ]
            },
            {
                "id": "poct",
                "title": "Point-of-Care Testing (if available)",
                "fields": [
                    {"id": "urine_dipstick", "type": "select", "label": "Urine dipstick performed?", "options": ["Not performed", "Performed"], "required": false},
                    {"id": "leukocytes", "type": "select", "label": "Leukocyte esterase", "options": ["Negative", "Trace", "1+", "2+", "3+"], "required": false},
                    {"id": "nitrites", "type": "select", "label": "Nitrites", "options": ["Negative", "Positive"], "required": false},
                    {"id": "blood_urine", "type": "select", "label": "Blood", "options": ["Negative", "Trace", "1+", "2+", "3+"], "required": false}
                ]
            }
        ]
    }'::jsonb
);