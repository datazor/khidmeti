import { validateMauritanianMobile } from '../lib/phoneValidation';

describe('validateMauritanianMobile', () => {
  // --- Valid Cases ---
  describe('should return true for valid phone numbers', () => {
    test('national format with 2x prefix', () => {
      expect(validateMauritanianMobile('22123456')).toBe(true);
      expect(validateMauritanianMobile('23123456')).toBe(true);
      expect(validateMauritanianMobile('24123456')).toBe(true);
      expect(validateMauritanianMobile('26123456')).toBe(true);
    });

    test('national format with 3x prefix', () => {
      expect(validateMauritanianMobile('32123456')).toBe(true);
      expect(validateMauritanianMobile('33123456')).toBe(true);
      expect(validateMauritanianMobile('36123456')).toBe(true);
      expect(validateMauritanianMobile('37123456')).toBe(true);
    });

    test('national format with 4x prefix', () => {
      expect(validateMauritanianMobile('43123456')).toBe(true);
      expect(validateMauritanianMobile('44123456')).toBe(true);
      expect(validateMauritanianMobile('46123456')).toBe(true);
      expect(validateMauritanianMobile('47123456')).toBe(true);
      expect(validateMauritanianMobile('48123456')).toBe(true);
      expect(validateMauritanianMobile('49123456')).toBe(true);
    });

    test('national format with 6x prefix', () => {
      expect(validateMauritanianMobile('61123456')).toBe(true);
      expect(validateMauritanianMobile('69876543')).toBe(true);
    });

    test('international format (+222) with valid prefixes', () => {
      expect(validateMauritanianMobile('+22222123456')).toBe(true);
      expect(validateMauritanianMobile('+22246123456')).toBe(true);
      expect(validateMauritanianMobile('+22263123456')).toBe(true);
    });

    test('formatted numbers with spaces and dashes', () => {
      expect(validateMauritanianMobile('22 12 34 56')).toBe(true);
      expect(validateMauritanianMobile('46-123456')).toBe(true);
      expect(validateMauritanianMobile('+222 22 123 456')).toBe(true);
    });
  });

  // --- Invalid Cases ---
  describe('should return false for invalid phone numbers', () => {
    test('incorrect length (too short or too long)', () => {
      expect(validateMauritanianMobile('1234567')).toBe(false); // Too short
      expect(validateMauritanianMobile('123456789')).toBe(false); // Too long
      expect(validateMauritanianMobile('+222123456789')).toBe(false); // International wrong length
    });

    test('invalid first digit', () => {
      expect(validateMauritanianMobile('02123456')).toBe(false);
      expect(validateMauritanianMobile('12123456')).toBe(false);
      expect(validateMauritanianMobile('52123456')).toBe(false);
      expect(validateMauritanianMobile('72123456')).toBe(false);
      expect(validateMauritanianMobile('82123456')).toBe(false);
      expect(validateMauritanianMobile('92123456')).toBe(false);
    });
    
    test('invalid two-digit prefix', () => {
      expect(validateMauritanianMobile('25123456')).toBe(false);
      expect(validateMauritanianMobile('31123456')).toBe(false);
      expect(validateMauritanianMobile('34123456')).toBe(false);
      expect(validateMauritanianMobile('35123456')).toBe(false);
      expect(validateMauritanianMobile('40123456')).toBe(false);
      expect(validateMauritanianMobile('41123456')).toBe(false);
      expect(validateMauritanianMobile('42123456')).toBe(false);
      expect(validateMauritanianMobile('45123456')).toBe(false);
    });

    test('invalid characters', () => {
      expect(validateMauritanianMobile('22-12A4-56')).toBe(false);
      expect(validateMauritanianMobile('22-12-34-56b')).toBe(false);
      expect(validateMauritanianMobile('22A56789')).toBe(false);
    });

    test('international format with invalid country code or length', () => {
      expect(validateMauritanianMobile('+12212345678')).toBe(false);
      expect(validateMauritanianMobile('+222123456789')).toBe(false);
    });

    test('empty or invalid input types', () => {
      expect(validateMauritanianMobile('')).toBe(false);
      expect(validateMauritanianMobile(' ')).toBe(false);
    });
  });
});