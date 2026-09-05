import { describe, it, expect } from 'vitest';
import { isValidImei, imeiError, maskImei } from './imei';

describe('التحقق من IMEI في الواجهة (انحدار Luhn)', () => {
  it('يقبل IMEI بخانة تحقق صحيحة', () => {
    expect(isValidImei('490154203237518')).toBe(true);
    expect(isValidImei('356938035643809')).toBe(true);
  });

  it('يرفض خانة تحقق خاطئة — لا يكفي مجرد 15 رقمًا', () => {
    expect(isValidImei('490154203237519')).toBe(false);
    expect(isValidImei('111111111111111')).toBe(false);
    expect(isValidImei('000000000000001')).toBe(false);
  });

  it('يرفض الطول الخاطئ وغير الأرقام', () => {
    expect(isValidImei('12345')).toBe(false);
    expect(isValidImei('4901542032375181')).toBe(false);
    expect(isValidImei('49015420323751a')).toBe(false);
    expect(isValidImei('')).toBe(false);
  });

  it('لا تمرّ كل الأرقام الخمسة عشر (الحلقة تُنفَّذ فعليًا)', () => {
    let passed = 0;
    for (let n = 0; n < 200; n++) if (isValidImei(String(n).padStart(15, '0'))) passed++;
    expect(passed).toBeGreaterThan(0);
    expect(passed).toBeLessThan(200);
  });

  it('يعطي رسائل خطأ عربية دقيقة', () => {
    expect(imeiError('')).toBe('رقم IMEI مطلوب');
    expect(imeiError('abc')).toContain('أرقام فقط');
    expect(imeiError('123')).toContain('15 رقمًا');
    expect(imeiError('490154203237519')).toContain('Luhn');
    expect(imeiError('490154203237518')).toBeNull();
  });

  it('يخفي الرقم ويُظهر آخر 4 خانات فقط', () => {
    expect(maskImei('490154203237518')).toBe('•••••••••••7518');
  });
});
