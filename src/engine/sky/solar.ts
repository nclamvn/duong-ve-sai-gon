/**
 * Vị trí mặt trời thiên văn (PRD REN-001: "sun az/el tính bằng công thức thiên văn, không đặt tay").
 * Thuật toán NOAA Solar Calculator (Meeus rút gọn): sai số cỡ 1 phút giờ mọc/lặn và < 0,5° cao độ trong 1950–2050,
 * đủ cho ánh sáng game. Thuần số, không DOM/three (unit test được trong Node).
 *
 * Quy ước trục engine (terrain/tile.ts): +x đông, −z bắc. `createDaylight` dựng hướng tới mặt trời bằng
 * [sin az · cos el, sin el, cos az · cos el], nên với phương vị la bàn A (từ bắc theo chiều kim đồng hồ) thì
 * azimuthDeg engine = 180° − A.
 */

const RAD = Math.PI / 180;

export interface SolarInput {
  /** vĩ độ, độ (bắc dương) */
  lat: number;
  /** kinh độ, độ (đông dương) */
  lon: number;
  /** ngày dương lịch theo giờ địa phương */
  year: number;
  month: number;
  day: number;
  /** phút từ 0 giờ địa phương (0..1440) */
  localMin: number;
  /** múi giờ của đồng hồ địa phương, giờ (VN Dân chủ Cộng hoà 1971: +7; VNCH 1960–1975: +8) */
  utcOffsetH: number;
}

export interface SolarPosition {
  /** phương vị la bàn, độ, từ bắc theo chiều kim đồng hồ */
  azimuthCompassDeg: number;
  /** góc cao trên chân trời, độ (âm = dưới chân trời), đã cộng khúc xạ khí quyển */
  elevationDeg: number;
  /** phương vị theo quy ước `LevelSky.sun.azimuthDeg` của engine */
  azimuthEngineDeg: number;
  /** giờ mọc / giờ lặn, phút từ 0 giờ địa phương (null khi đêm/ngày cực) */
  sunriseMin: number | null;
  sunsetMin: number | null;
  /** trưa thật, phút địa phương */
  solarNoonMin: number;
}

/** số ngày Julian của 0h UTC ngày dương lịch (Meeus 7.1) */
function julianDay(y: number, m: number, d: number): number {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

interface SunTerms {
  declRad: number;
  eqTimeMin: number;
}

function sunTerms(jd: number): SunTerms {
  const t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = m * RAD;
  const c = Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const declRad = Math.asin(Math.sin(eps * RAD) * Math.sin(appLong * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const l0r = l0 * RAD;
  const eqTime = y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr);
  return { declRad, eqTimeMin: (4 * eqTime) / RAD };
}

/** khúc xạ khí quyển (độ) theo cao độ hình học (NOAA) */
function refraction(elDeg: number): number {
  if (elDeg > 85) return 0;
  const te = Math.tan(elDeg * RAD);
  let r: number;
  if (elDeg > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (elDeg > -0.575) r = 1735 + elDeg * (-518.2 + elDeg * (103.4 + elDeg * (-12.79 + elDeg * 0.711)));
  else r = -20.772 / te;
  return r / 3600;
}

export function solarPosition(inp: SolarInput): SolarPosition {
  const jd0 = julianDay(inp.year, inp.month, inp.day);
  const utcMin = inp.localMin - inp.utcOffsetH * 60;
  const st = sunTerms(jd0 + utcMin / 1440);
  const latR = inp.lat * RAD;
  // giờ mặt trời thật (phút)
  const tst = (((utcMin + st.eqTimeMin + 4 * inp.lon) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const cosZen = Math.min(1, Math.max(-1, Math.sin(latR) * Math.sin(st.declRad) + Math.cos(latR) * Math.cos(st.declRad) * Math.cos(ha)));
  const zen = Math.acos(cosZen);
  const elGeo = 90 - zen / RAD;
  // phương vị la bàn
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(st.declRad) * Math.cos(latR)) / RAD + 180;
  const azimuthCompassDeg = ((az % 360) + 360) % 360;

  // mọc/lặn: cao độ −0,833° (bán kính đĩa + khúc xạ chuẩn), lặp 2 lần cho thay đổi xích vĩ trong ngày
  const event = (rise: boolean): number | null => {
    let tMin = 720 - inp.utcOffsetH * 60; // đoán: trưa
    for (let k = 0; k < 3; k++) {
      const s = sunTerms(jd0 + tMin / 1440);
      const cosH = (Math.cos(90.833 * RAD) - Math.sin(latR) * Math.sin(s.declRad)) / (Math.cos(latR) * Math.cos(s.declRad));
      if (cosH > 1 || cosH < -1) return null;
      const h = Math.acos(cosH) / RAD;
      tMin = 720 - 4 * (inp.lon + (rise ? h : -h)) - s.eqTimeMin;
    }
    return tMin + inp.utcOffsetH * 60;
  };
  const sNoon = sunTerms(jd0 + (720 - 4 * inp.lon) / 1440);
  return {
    azimuthCompassDeg,
    elevationDeg: elGeo + refraction(elGeo),
    azimuthEngineDeg: (((180 - azimuthCompassDeg) % 360) + 360) % 360,
    sunriseMin: event(true),
    sunsetMin: event(false),
    solarNoonMin: 720 - 4 * inp.lon - sNoon.eqTimeMin + inp.utcOffsetH * 60,
  };
}

/** "HH:MM" → phút */
export function parseClock(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`clock must be HH:MM, got ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
}
