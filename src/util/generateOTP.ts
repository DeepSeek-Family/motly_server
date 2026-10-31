/**
 * Generates a random 6-digit numeric OTP (between 100000 and 999999).
 */
const generateOTP = (): number => {
  return Math.floor(100000 + Math.random() * 900000);
};

export { generateOTP };
export default generateOTP;