/** Solar/Gregorian calendar conversion — jalaali algorithm (no dependencies). All calculations are linear on the "absolute day since 1970". */

const DAY_MS = 86400000;
const div = (a: number, b: number): number => Math.floor(a / b);
const mod = (a: number, b: number): number => a - Math.floor(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  let nn = n;
  if (jump - n < 6) nn = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(nn + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  const anchor = Math.floor(Date.UTC(r.gy, 2, r.march) / DAY_MS);
  return anchor + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(dn: number): { jy: number; jm: number; jd: number } {
  const gy = new Date(dn * DAY_MS).getUTCFullYear();
  let jy = gy - 621;
  const r = jalCal(jy);
  const anchor = Math.floor(Date.UTC(r.gy, 2, r.march) / DAY_MS);
  let k = dn - anchor;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** 0-based month (0 = Farvardin) */
export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

export function toJalali(date: Date): JalaliDate {
  const dn = Math.floor(date.getTime() / DAY_MS);
  const r = d2j(dn);
  return { year: r.jy, month: r.jm - 1, day: r.jd };
}

export function toGregorian(j: JalaliDate): Date {
  const dn = j2d(j.year, j.month + 1, j.day);
  return new Date(dn * DAY_MS);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

/** Solar day key "month/day" (1-based month) */
export function jalaliDayKey(date: Date): string {
  const j = toJalali(date);
  return `${j.month + 1}/${j.day}`;
}

/** Solar month length (0-based month) */
export function getJalaliMonthLength(year: number, month: number): number {
  if (month < 6) return 31;
  if (month < 11) return 30;
  return jalCal(year).leap === 0 ? 30 : 29;
}
