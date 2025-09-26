/**
 * Mock implementation of the sendSMS function.
 * In development, it logs the OTP to the console instead of sending an SMS.
 * @param phoneNumber - The recipient's phone number
 * @param code - The OTP code to "send"
 */
export const sendSMS = (phoneNumber: string, code: string): void => {
  // In production, this would call an SMS service like Twilio
  // For now, log to console for development/testing
};