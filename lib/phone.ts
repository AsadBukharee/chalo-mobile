/** Pakistan is the only market for now, so the country code is fixed. */
export const COUNTRY_CODE = '+92';

/**
 * Turns what someone types into the E.164 number Firebase requires.
 *
 * People write their mobile number every which way — 0300 1234567,
 * 0300-1234567, 3001234567, +92 300 1234567 — and Firebase accepts exactly one
 * of those. Normalise rather than reject.
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  let national = digits;
  if (national.startsWith('0092')) national = national.slice(4);
  else if (national.startsWith('92')) national = national.slice(2);
  // A leading 0 is the domestic trunk prefix and is dropped in E.164.
  if (national.startsWith('0')) national = national.slice(1);

  // Pakistani mobile numbers are 10 digits after the country code and all
  // start with 3 (300–349). Anything else is a typo, not a number we can text.
  if (national.length !== 10 || !national.startsWith('3')) return null;
  return `${COUNTRY_CODE}${national}`;
}

/** "+923001234567" → "+92 300 1234567", for read-back on the OTP screen. */
export function formatE164(value: string): string {
  const match = /^\+92(\d{3})(\d{7})$/.exec(value);
  if (!match) return value;
  return `${COUNTRY_CODE} ${match[1]} ${match[2]}`;
}
