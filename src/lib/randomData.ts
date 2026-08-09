import { KARACHI_AREAS } from '../constants'

/**
 * Temporary random test data generators for staff & patient forms.
 *
 * Delete this file and all references to `fillRandom*` when testing is complete.
 * Search: `fillRandomStaff`, `fillRandomPatient`, `randomData.ts`
 */

const maleNames = [
  'Muhammad Ali',
  'Ahmed Khan',
  'Salman Agha',
  'Bilal Hussain',
  'Rizwan Ahmed',
  'Imran Sheikh',
  'Usman Malik',
  'Farhan Ali',
  'Tariq Mehmood',
  'Kamran Abbas',
  'Sohail Ahmed',
  'Nabeel Haider',
]
const femaleNames = [
  'Fatima BiBi',
  'Ayesha Khan',
  'Zainab Ali',
  'Saima Batool',
  'Nadia Hussain',
  'Rabia Malik',
  'Kiran Fatima',
  'Samina Ahmed',
  'Parveen Akhtar',
  'Shazia Jabeen',
  'Nasreen Bibi',
  'Tahira Iqbal',
]
const surnames = [
  'Khan',
  'Ali',
  'Hussain',
  'Ahmed',
  'Sheikh',
  'Malik',
  'Iqbal',
  'Haider',
  'Rizvi',
  'Siddiqui',
]
const districts = [
  'GULSHAN',
  'CLIFTON',
  'SADDAR',
  'LYARI',
  'LANDHI',
  'KORANGI',
  'MALIR',
  'NAZIMABAD',
  'FB AREA',
  'GULISTAN-E-JAUHAR',
]
// Karachi district divisions as used by the PatientView register form select.
const PATIENT_DISTRICTS = [
  'South',
  'East',
  'West',
  'Central',
  'Malir',
  'Korangi',
  'Keamari',
]
const categories: Array<'Nurse' | 'Care Taker' | 'Attendant' | 'Babysitter'> = [
  'Nurse',
  'Care Taker',
  'Attendant',
  'Babysitter',
]
const religions = ['Muslim', 'Christian', 'Hindu']
const positions = [
  'Staff Nurse',
  'Senior Nurse',
  'ICU Nurse',
  'Home Care Nurse',
  'Attendant',
  'Babysitter',
]
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomName(): string {
  const male = Math.random() > 0.5
  const first = male ? pick(maleNames) : pick(femaleNames)
  return first
}

function randomCNIC(): string {
  const prefix = String(randInt(42101, 42501))
  const mid = String(randInt(1000000, 9999999))
  const suffix = String(randInt(1, 9))
  return `${prefix}-${mid}-${suffix}`
}

function randomPhone(): string {
  const prefixes = ['300', '321', '333', '334', '345', '347', '348']
  // 11 digits total: 03XX-XXXXXXX — matches formatPhoneInput + DB CHECK after
  // normalization. (`03${prefix}` would produce an invalid 12-digit 033XX...
  // number that violates employees.phone_primary_check.)
  return `0${pick(prefixes)}-${randInt(1000000, 9999999)}`
}

function randomDOB(): string {
  const year = randInt(1970, 2000)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const day = String(randInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function randomEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '')
  return `${slug}${randInt(1, 99)}@gmail.com`
}

function randomAddress(): string {
  const house = randInt(1, 999)
  const street = pick(['A', 'B', 'C', 'D'])
  return `H#${house}, St. ${street}, Block ${randInt(1, 9)}, ${pick(districts)}`
}

function randomSalary(): number {
  return randInt(5, 18) * 5000 // 10k - 90k
}

/** Fill the Staff Registration form state with random test data. */
export function fillRandomStaff(formData: Record<string, unknown>): Record<string, unknown> {
  const name = randomName()
  return {
    ...formData,
    full_name: name,
    cnic_number: randomCNIC(),
    phone_primary: randomPhone(),
    gender: Math.random() > 0.5 ? 'Male' : 'Female',
    marital_status: pick(['Single', 'Married', 'Widowed']),
    religion: pick(religions),
    dob: randomDOB(),
    // Must be a KARACHI_AREAS value — the form <select> has no matching option
    // for the legacy UPPERCASE names below, which left district empty and
    // blocked submission with "required" validation.
    district: pick(KARACHI_AREAS),
    category: pick(categories),
    position_applied: pick(positions),
    experience_years: randInt(1, 15),
    // The staff form edits the per-shift rate and stores monthly (×30).
    // Round to a clean multiple so the value passes any number-input step.
    perShiftRate: Math.round(randomSalary() / 30 / 50) * 50,
    is_active: true,
    is_available: true,
  }
}

/** Fill the Patient Registration form state with random test data. */
// NOTE: must only return columns that exist on the live `patients` table —
// legacy keys (contact/address/billing_rate/guardian_name/...) made the
// insert fail with PGRST204. Keep in sync with the register form state.
export function fillRandomPatient(formData: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: randomName(),
    cnic: randomCNIC(),
    mobile_number: randomPhone(),
    // Must match the register form's <select> options (Karachi divisions) —
    // the legacy UPPERCASE names left the required district select empty.
    district: pick(PATIENT_DISTRICTS),
    complete_address: randomAddress(),
    service_type: pick(['12h_day', '12h_night', '24h']),
    monthly_package_pkr: String(randInt(15, 60) * 500),
    status: 'Pending',
  }
}
