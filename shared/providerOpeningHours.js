export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const DAY_LABELS = {
  monday: 'Luni',
  tuesday: 'Marti',
  wednesday: 'Miercuri',
  thursday: 'Joi',
  friday: 'Vineri',
  saturday: 'Sambata',
  sunday: 'Duminica',
};
const MAX_EXCEPTIONS = 100;
const MAX_NOTE_LENGTH = 300;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value, max = 500) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function minutes(value) {
  const [hours, mins] = String(value).split(':').map(Number);
  return hours * 60 + mins;
}

function validDateString(value) {
  const raw = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function compareDates(left, right) {
  return String(left).localeCompare(String(right));
}

function validateDay(dayKey, rawDay) {
  if (!isObject(rawDay)) return { error: `${DAY_LABELS[dayKey]} trebuie sa aiba o configuratie valida.` };
  const unknown = Object.keys(rawDay).filter((key) => !['open', 'from', 'to'].includes(key));
  if (unknown.length > 0) return { error: `${DAY_LABELS[dayKey]} contine campuri nepermise.`, fields: unknown };
  const open = rawDay.open === true;
  if (!open) return { value: { open: false, from: '', to: '' } };
  const from = text(rawDay.from, 5);
  const to = text(rawDay.to, 5);
  if (!validTime(from) || !validTime(to)) return { error: `Completeaza ore valide pentru ${DAY_LABELS[dayKey]} in format HH:MM.` };
  if (minutes(from) >= minutes(to)) return { error: `Ora de inchidere trebuie sa fie dupa ora de deschidere pentru ${DAY_LABELS[dayKey]}.` };
  return { value: { open: true, from, to } };
}

function validateException(raw, index) {
  if (!isObject(raw)) return { error: `Exceptia ${index + 1} este invalida.` };
  const unknown = Object.keys(raw).filter((key) => !['type', 'start_date', 'end_date', 'from', 'to', 'public_note'].includes(key));
  if (unknown.length > 0) return { error: `Exceptia ${index + 1} contine campuri nepermise.`, fields: unknown };
  const type = raw.type === 'custom' ? 'custom' : raw.type === 'closed' ? 'closed' : '';
  if (!type) return { error: `Exceptia ${index + 1} trebuie sa fie de tip inchis sau program special.` };
  const startDate = text(raw.start_date, 10);
  const endDate = text(raw.end_date, 10);
  if (!validDateString(startDate) || !validDateString(endDate)) return { error: `Exceptia ${index + 1} necesita date calendaristice valide.` };
  if (compareDates(startDate, endDate) > 0) return { error: `Data de inceput trebuie sa fie inaintea datei de final pentru exceptia ${index + 1}.` };
  const publicNote = text(raw.public_note, MAX_NOTE_LENGTH);
  if (/[<>]/.test(publicNote)) return { error: `Mesajul public al exceptiei ${index + 1} trebuie sa fie text simplu.` };
  if (type === 'closed') {
    return { value: { type, start_date: startDate, end_date: endDate, from: '', to: '', public_note: publicNote } };
  }
  const from = text(raw.from, 5);
  const to = text(raw.to, 5);
  if (!validTime(from) || !validTime(to)) return { error: `Exceptia ${index + 1} necesita ore valide in format HH:MM.` };
  if (minutes(from) >= minutes(to)) return { error: `Ora de inchidere trebuie sa fie dupa ora de deschidere pentru exceptia ${index + 1}.` };
  return { value: { type, start_date: startDate, end_date: endDate, from, to, public_note: publicNote } };
}

function validateNoOverlaps(exceptions) {
  const ordered = [...exceptions].sort((left, right) => compareDates(left.start_date, right.start_date) || compareDates(left.end_date, right.end_date));
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (compareDates(current.start_date, previous.end_date) <= 0) {
      return { error: `Exceptiile ${previous.start_date} - ${previous.end_date} si ${current.start_date} - ${current.end_date} se suprapun.` };
    }
  }
  return { value: ordered };
}

export function validateProviderOpeningHours(raw) {
  if (!isObject(raw)) return { valid: false, error: 'Programul trebuie sa fie un obiect JSON valid.' };
  const unknown = Object.keys(raw).filter((key) => !['weekly', 'exceptions'].includes(key));
  if (unknown.length > 0) return { valid: false, error: 'Programul contine campuri nepermise.', fields: unknown };
  if (!isObject(raw.weekly)) return { valid: false, error: 'Programul saptamanal este obligatoriu.' };
  const unknownDays = Object.keys(raw.weekly).filter((key) => !DAY_KEYS.includes(key));
  if (unknownDays.length > 0) return { valid: false, error: 'Programul contine zile necunoscute.', fields: unknownDays };

  const weekly = {};
  for (const dayKey of DAY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw.weekly, dayKey)) return { valid: false, error: `Lipseste configuratia pentru ${DAY_LABELS[dayKey]}.` };
    const checked = validateDay(dayKey, raw.weekly[dayKey]);
    if (checked.error) return { valid: false, error: checked.error, fields: checked.fields || [] };
    weekly[dayKey] = checked.value;
  }

  const rawExceptions = raw.exceptions === undefined ? [] : raw.exceptions;
  if (!Array.isArray(rawExceptions)) return { valid: false, error: 'Exceptiile de program trebuie sa fie o lista.' };
  if (rawExceptions.length > MAX_EXCEPTIONS) return { valid: false, error: `Sunt permise maximum ${MAX_EXCEPTIONS} exceptii de program.` };
  const exceptions = [];
  for (let index = 0; index < rawExceptions.length; index += 1) {
    const checked = validateException(rawExceptions[index], index);
    if (checked.error) return { valid: false, error: checked.error, fields: checked.fields || [] };
    exceptions.push(checked.value);
  }
  const overlapCheck = validateNoOverlaps(exceptions);
  if (overlapCheck.error) return { valid: false, error: overlapCheck.error };
  return { valid: true, value: { weekly, exceptions: overlapCheck.value } };
}

function formatDay(day) {
  if (!day?.open) return 'Inchis';
  return `${day.from} - ${day.to}`;
}

export function formatProviderWeeklyHours(weekly) {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const values = weekdays.map((key) => formatDay(weekly[key]));
  const allSame = values.every((value) => value === values[0]);
  const weekdayLabel = allSame
    ? `Luni-Vineri: ${values[0]}`
    : weekdays.map((key) => `${DAY_LABELS[key]}: ${formatDay(weekly[key])}`).join('; ');
  return `${weekdayLabel}; Sambata: ${formatDay(weekly.saturday)}; Duminica: ${formatDay(weekly.sunday)}`;
}

export function formatProviderSaturdayHours(weekly) {
  return formatDay(weekly.saturday);
}
