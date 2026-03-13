export function validatePassword(password: string) {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long.")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.")
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.")
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character.")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const passwordRequirements = [
  "At least 8 characters long",
  "At least one uppercase letter (A–Z)",
  "At least one lowercase letter (a–z)",
  "At least one number (0–9)",
  "At least one special character (!@#$%^&* etc.)"
]

export const passwordHint =
  "Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character."
