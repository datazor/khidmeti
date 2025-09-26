// convex/lib/tokenGenerator.ts

/**
 * Generates a cryptographically secure random token using Web Crypto API
 * @param length - Length of the token in bytes
 * @returns Hex-encoded secure token string
 */
export function generateSecureToken(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}