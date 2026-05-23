import type { NumericRange, ParameterCatalogEntry, RangeDefinition } from '@medical-tracker/shared-types';

/**
 * SOURCE OF TRUTH for the parameter taxonomy. Transcribed verbatim from the
 * MVP PRD §12 (80 parameters across 12 clinical panels). Do NOT hardcode
 * parameters anywhere else — the API seeds the DB from this, the worker
 * normalizes against it, and mobile reads display labels from it.
 *
 * Reference ranges are the PRD's "Typical Adult Range" values. Where the PRD
 * marks a parameter as Age-variant but only prints a single adult value, we
 * encode that single value as the default (the catalog can't invent age bands
 * the PRD doesn't specify). Sex-variant ranges are encoded precisely. Critical
 * thresholds are not given by the PRD, so criticalLow/criticalHigh are null.
 */

export const PANELS = {
  CBC: 'Complete Blood Count (CBC)',
  LIPID: 'Lipid Profile',
  LFT: 'Liver Function Test (LFT)',
  KFT: 'Kidney Function Test (KFT)',
  THYROID: 'Thyroid Profile',
  DIABETES: 'Diabetes Panel',
  VITAMIN_MINERAL: 'Vitamin & Mineral Panel',
  URINE: 'Urine Routine',
  CARDIAC: 'Cardiac Markers',
  ELECTROLYTES: 'Electrolytes',
  VITALS: 'Vitals',
  ADDITIONAL: 'Additional Common Markers',
} as const;

// --- range helpers ---
const r = (min: number | null, max: number | null): NumericRange => ({ min, max });
const def = (range: NumericRange): RangeDefinition => ({ default: range });
const sex = (male: NumericRange, female: NumericRange): RangeDefinition => ({
  default: null,
  bySex: { male, female },
});
const qual = (qualitativeNormal: string): RangeDefinition => ({ default: null, qualitativeNormal });
const NONE: RangeDefinition = { default: null };

/** Compact builder; critical thresholds default to null (not specified by PRD). */
function p(
  id: string,
  canonicalName: string,
  aliases: string[],
  unit: string,
  panel: string,
  rangeDefault: RangeDefinition,
): ParameterCatalogEntry {
  return { id, canonicalName, aliases, unit, panel, rangeDefault, criticalLow: null, criticalHigh: null };
}

export const PARAMETER_SEED: ParameterCatalogEntry[] = [
  // --- Complete Blood Count (CBC) ---
  p('hemoglobin', 'Hemoglobin', ['Hb', 'HGB'], 'g/dL', PANELS.CBC, sex(r(13.5, 17.5), r(12.0, 15.5))),
  p('total-rbc-count', 'Total RBC Count', ['RBC'], 'million/µL', PANELS.CBC, sex(r(4.7, 6.1), r(4.2, 5.4))),
  p('hematocrit-pcv', 'Hematocrit / PCV', ['HCT', 'PCV'], '%', PANELS.CBC, sex(r(41, 53), r(36, 46))),
  p('mcv', 'Mean Corpuscular Volume', ['MCV'], 'fL', PANELS.CBC, def(r(80, 100))),
  p('mch', 'Mean Corpuscular Hemoglobin', ['MCH'], 'pg', PANELS.CBC, def(r(27, 33))),
  p('mchc', 'MCH Concentration', ['MCHC'], 'g/dL', PANELS.CBC, def(r(32, 36))),
  p('total-wbc-count', 'Total WBC Count', ['WBC', 'TLC', 'Leukocytes'], 'cells/µL', PANELS.CBC, def(r(4000, 11000))),
  p('platelet-count', 'Platelet Count', ['PLT'], 'cells/µL', PANELS.CBC, def(r(150000, 450000))),
  p('neutrophils', 'Neutrophils (Differential)', ['NEUT%'], '%', PANELS.CBC, def(r(40, 70))),
  p('lymphocytes', 'Lymphocytes (Differential)', ['LYMPH%'], '%', PANELS.CBC, def(r(20, 45))),

  // --- Lipid Profile ---
  p('total-cholesterol', 'Total Cholesterol', ['TC', 'Cholesterol'], 'mg/dL', PANELS.LIPID, def(r(null, 200))),
  p('ldl-cholesterol', 'LDL Cholesterol', ['LDL-C', 'LDL'], 'mg/dL', PANELS.LIPID, def(r(null, 100))),
  p('hdl-cholesterol', 'HDL Cholesterol', ['HDL-C', 'HDL'], 'mg/dL', PANELS.LIPID, sex(r(40, null), r(50, null))),
  p('triglycerides', 'Triglycerides', ['TG', 'TGL'], 'mg/dL', PANELS.LIPID, def(r(null, 150))),
  p('vldl-cholesterol', 'VLDL Cholesterol', ['VLDL'], 'mg/dL', PANELS.LIPID, def(r(5, 40))),
  p('total-hdl-ratio', 'Total / HDL Ratio', ['TC:HDL'], 'ratio', PANELS.LIPID, def(r(null, 5))),

  // --- Liver Function Test (LFT) ---
  p('total-bilirubin', 'Total Bilirubin', ['T.Bil'], 'mg/dL', PANELS.LFT, def(r(0.1, 1.2))),
  p('direct-bilirubin', 'Direct Bilirubin', ['D.Bil', 'Conjugated'], 'mg/dL', PANELS.LFT, def(r(0.0, 0.3))),
  p('indirect-bilirubin', 'Indirect Bilirubin', ['I.Bil', 'Unconjugated'], 'mg/dL', PANELS.LFT, def(r(0.1, 0.9))),
  p('ast-sgot', 'AST / SGOT', ['AST', 'SGOT'], 'U/L', PANELS.LFT, def(r(null, 40))),
  p('alt-sgpt', 'ALT / SGPT', ['ALT', 'SGPT'], 'U/L', PANELS.LFT, def(r(null, 45))),
  p('alkaline-phosphatase', 'Alkaline Phosphatase', ['ALP'], 'U/L', PANELS.LFT, def(r(44, 147))),
  p('gamma-gt', 'Gamma GT', ['GGT'], 'U/L', PANELS.LFT, sex(r(8, 61), r(5, 36))),
  p('total-protein', 'Total Protein', ['TP'], 'g/dL', PANELS.LFT, def(r(6.0, 8.3))),
  p('serum-albumin', 'Serum Albumin', ['Albumin'], 'g/dL', PANELS.LFT, def(r(3.5, 5.0))),

  // --- Kidney Function Test (KFT) ---
  p('serum-creatinine', 'Serum Creatinine', ['Creatinine', 'Cr'], 'mg/dL', PANELS.KFT, sex(r(0.7, 1.3), r(0.6, 1.1))),
  p('blood-urea-nitrogen', 'Blood Urea Nitrogen', ['BUN'], 'mg/dL', PANELS.KFT, def(r(7, 20))),
  p('blood-urea', 'Blood Urea', ['Urea'], 'mg/dL', PANELS.KFT, def(r(15, 45))),
  p('uric-acid', 'Uric Acid', ['UA'], 'mg/dL', PANELS.KFT, sex(r(3.4, 7.0), r(2.4, 6.0))),
  p('egfr', 'eGFR (Estimated GFR)', ['eGFR', 'GFR'], 'mL/min/1.73m²', PANELS.KFT, def(r(90, null))),
  p('serum-calcium', 'Serum Calcium', ['Ca'], 'mg/dL', PANELS.KFT, def(r(8.5, 10.5))),
  p('serum-phosphorus', 'Serum Phosphorus', ['PO4'], 'mg/dL', PANELS.KFT, def(r(2.5, 4.5))),

  // --- Thyroid Profile ---
  p('tsh', 'Thyroid Stimulating Hormone', ['TSH'], 'µIU/mL', PANELS.THYROID, def(r(0.4, 4.0))),
  p('free-t3', 'Free T3', ['FT3'], 'pg/mL', PANELS.THYROID, def(r(2.3, 4.2))),
  p('free-t4', 'Free T4', ['FT4'], 'ng/dL', PANELS.THYROID, def(r(0.8, 1.8))),
  p('total-t3', 'Total T3', ['T3'], 'ng/dL', PANELS.THYROID, def(r(80, 200))),
  p('total-t4', 'Total T4', ['T4'], 'µg/dL', PANELS.THYROID, def(r(5.1, 14.1))),

  // --- Diabetes Panel ---
  p('fasting-blood-glucose', 'Fasting Blood Glucose', ['FBS', 'FPG'], 'mg/dL', PANELS.DIABETES, def(r(70, 99))),
  p('postprandial-blood-glucose', 'Postprandial Blood Glucose', ['PPBS', '2-hr PG'], 'mg/dL', PANELS.DIABETES, def(r(null, 140))),
  p('random-blood-sugar', 'Random Blood Sugar', ['RBS'], 'mg/dL', PANELS.DIABETES, def(r(null, 200))),
  p('hba1c', 'HbA1c (Glycated Hemoglobin)', ['HbA1c', 'A1C'], '%', PANELS.DIABETES, def(r(null, 5.7))),
  p('fasting-insulin', 'Fasting Insulin', ['Insulin'], 'µU/mL', PANELS.DIABETES, def(r(2.6, 24.9))),

  // --- Vitamin & Mineral Panel ---
  p('vitamin-d', 'Vitamin D (25-OH)', ['Vit D', '25-OH-D'], 'ng/mL', PANELS.VITAMIN_MINERAL, def(r(30, 100))),
  p('vitamin-b12', 'Vitamin B12', ['B12', 'Cobalamin'], 'pg/mL', PANELS.VITAMIN_MINERAL, def(r(200, 900))),
  p('folate', 'Folate (Folic Acid)', ['Folate', 'B9'], 'ng/mL', PANELS.VITAMIN_MINERAL, def(r(2.7, 17.0))),
  p('serum-iron', 'Serum Iron', ['Iron', 'Fe'], 'µg/dL', PANELS.VITAMIN_MINERAL, sex(r(65, 175), r(50, 170))),
  p('ferritin', 'Ferritin', ['Ferritin'], 'ng/mL', PANELS.VITAMIN_MINERAL, sex(r(24, 336), r(11, 307))),
  p('tibc', 'TIBC', ['Total Iron Binding Capacity'], 'µg/dL', PANELS.VITAMIN_MINERAL, def(r(240, 450))),
  p('magnesium', 'Magnesium', ['Mg'], 'mg/dL', PANELS.VITAMIN_MINERAL, def(r(1.7, 2.2))),

  // --- Urine Routine ---
  p('urine-ph', 'Urine pH', ['pH'], '', PANELS.URINE, def(r(4.5, 8.0))),
  p('urine-specific-gravity', 'Urine Specific Gravity', ['SG'], '', PANELS.URINE, def(r(1.005, 1.03))),
  p('urine-protein', 'Urine Protein', ['Albumin (urine)'], 'qualitative', PANELS.URINE, qual('Negative / Trace')),
  p('urine-glucose', 'Urine Glucose', ['Glycosuria'], 'qualitative', PANELS.URINE, qual('Negative')),
  p('urine-ketones', 'Urine Ketones', ['Ketones'], 'qualitative', PANELS.URINE, qual('Negative')),
  p('urine-microalbumin', 'Urine Microalbumin', ['Microalbumin'], 'mg/L', PANELS.URINE, def(r(null, 30))),

  // --- Cardiac Markers ---
  p('troponin-i', 'Troponin I', ['TnI', 'cTnI'], 'ng/mL', PANELS.CARDIAC, def(r(null, 0.04))),
  p('ck-mb', 'CK-MB', ['Creatine Kinase MB'], 'ng/mL', PANELS.CARDIAC, def(r(null, 5))),
  p('total-cpk', 'Total CPK', ['CK', 'CPK'], 'U/L', PANELS.CARDIAC, sex(r(39, 308), r(26, 192))),
  p('hs-crp', 'hs-CRP', ['High-sensitivity CRP'], 'mg/L', PANELS.CARDIAC, def(r(null, 1.0))),
  p('bnp', 'BNP / NT-proBNP', ['BNP', 'proBNP'], 'pg/mL', PANELS.CARDIAC, def(r(null, 100))),

  // --- Electrolytes ---
  p('serum-sodium', 'Serum Sodium', ['Na+'], 'mEq/L', PANELS.ELECTROLYTES, def(r(135, 145))),
  p('serum-potassium', 'Serum Potassium', ['K+'], 'mEq/L', PANELS.ELECTROLYTES, def(r(3.5, 5.0))),
  p('serum-chloride', 'Serum Chloride', ['Cl-'], 'mEq/L', PANELS.ELECTROLYTES, def(r(98, 107))),
  p('serum-bicarbonate', 'Serum Bicarbonate', ['HCO3-'], 'mEq/L', PANELS.ELECTROLYTES, def(r(22, 28))),

  // --- Vitals ---
  p('systolic-bp', 'Systolic Blood Pressure', ['SBP'], 'mmHg', PANELS.VITALS, def(r(null, 120))),
  p('diastolic-bp', 'Diastolic Blood Pressure', ['DBP'], 'mmHg', PANELS.VITALS, def(r(null, 80))),
  p('resting-heart-rate', 'Resting Heart Rate', ['HR', 'Pulse'], 'bpm', PANELS.VITALS, def(r(60, 100))),
  p('body-temperature', 'Body Temperature', ['Temp'], '°F', PANELS.VITALS, def(r(97.0, 99.0))),
  p('body-weight', 'Body Weight', ['Weight'], 'kg', PANELS.VITALS, NONE),
  p('height', 'Height', ['Ht'], 'cm', PANELS.VITALS, NONE),
  p('bmi', 'Body Mass Index', ['BMI'], 'kg/m²', PANELS.VITALS, def(r(18.5, 24.9))),
  p('waist-circumference', 'Waist Circumference', ['WC'], 'cm', PANELS.VITALS, sex(r(null, 94), r(null, 80))),
  p('spo2', 'SpO2 (Oxygen Saturation)', ['SpO2', 'O2 Sat'], '%', PANELS.VITALS, def(r(95, 100))),

  // --- Additional Common Markers ---
  p('esr', 'ESR', ['Erythrocyte Sedimentation Rate'], 'mm/hr', PANELS.ADDITIONAL, sex(r(0, 15), r(0, 20))),
  p('crp', 'C-Reactive Protein', ['CRP'], 'mg/L', PANELS.ADDITIONAL, def(r(null, 10))),
  p('psa', 'PSA (Total)', ['PSA'], 'ng/mL', PANELS.ADDITIONAL, def(r(null, 4.0))),
  p('beta-hcg', 'Beta hCG', ['hCG'], 'mIU/mL', PANELS.ADDITIONAL, def(r(null, 5))),
  p('non-hdl-cholesterol', 'Random Cholesterol (LDL/HDL Calc)', ['Non-HDL Cholesterol'], 'mg/dL', PANELS.ADDITIONAL, def(r(null, 130))),
  p('pp-tg', 'Random Triglycerides Post-Meal', ['PP-TG'], 'mg/dL', PANELS.ADDITIONAL, def(r(null, 175))),
  p('random-glucose-capillary', 'Random Glucose (Capillary)', ['SMBG'], 'mg/dL', PANELS.ADDITIONAL, def(r(80, 180))),
];

/** Default dashboard pins for first-time users (playbook §3.1.2). */
export const DEFAULT_PIN_IDS: string[] = [
  'hba1c',
  'total-cholesterol',
  'vitamin-d',
  'hemoglobin',
  'tsh',
  'fasting-blood-glucose',
];
