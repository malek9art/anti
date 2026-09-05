export function isValidImei(value: unknown): boolean {
  if (typeof value !== 'string' || !/^[0-9]{15}$/.test(value)) return false;
  let sum = 0;
  let double = false;
  for (let i = 14; i >= 0; i--) {
    let d = Number(value[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
