// lib/phoneValidation.ts

/**
 * Validates a Mauritanian mobile phone number
 * @param phone - The phone number string to validate
 * @returns boolean - True if valid, false otherwise
 */
export function validateMauritanianMobile(phone: string): boolean {
  // Remove all formatting characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check if it's in international format (+222 followed by 8 digits)
  // or national format (exactly 8 digits)
  let mobileNumber: string;
  
  if (cleanPhone.startsWith('+222') && cleanPhone.length === 12) {
    // Extract the 8-digit number part
    mobileNumber = cleanPhone.substring(4);
  } else if (cleanPhone.length === 8) {
    // National format
    mobileNumber = cleanPhone;
  } else {
    // Doesn't match expected length patterns
    return false;
  }
  
  // Check if all characters are digits
  if (!/^\d{8}$/.test(mobileNumber)) {
    return false;
  }
  
  // Extract first digit and first two digits
  const firstDigit = mobileNumber.charAt(0);
  const firstTwoDigits = mobileNumber.substring(0, 2);
  
  // Check if first digit is valid (2, 3, 4, or 6)
  if (!['2', '3', '4', '6'].includes(firstDigit)) {
    return false;
  }
  
  // Check if first two digits match valid mobile prefixes
  const validPrefixes = [
    '22', '23', '24', '26',
    '32', '33', '36', '37', '38', '39',
    '43', '44', '46', '47', '48', '49'
    // Note: 6X is allowed but specific sub-prefixes weren't defined
  ];
  
  // If first digit is 6, we only check it's a 6 (as per requirements)
  if (firstDigit === '6') {
    return true;
  }
  
  // For 2, 3, 4 check specific prefixes
  return validPrefixes.includes(firstTwoDigits);
}