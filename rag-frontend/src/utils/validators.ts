export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidStatute(statute: string): boolean {
  return /^[A-Z]{2,10}(-[A-Z]{2,10})?$/.test(statute);
}
