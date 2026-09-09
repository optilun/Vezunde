// A public contact field may contain multiple phones. Never dial concatenated numbers.
export function publicPhoneLink(value) {
  if (typeof value !== 'string') return null;
  for (const part of value.split(/[\/,;|\n]|\s+(?:sau|ori)\s+/i)) {
    const matches = part.match(/(?:\+|00)?\d[\d ().-]{5,}\d/g) || [];
    for (const match of matches) {
      let number = match.replace(/[ ().-]/g, '');
      if (number.startsWith('00')) number = '+' + number.slice(2);
      if (/^\+?\d{7,15}$/.test(number)) return 'tel:' + number;
    }
  }
  return null;
}
