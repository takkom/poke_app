export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function validateNewPassword(password: string): string | null {
  if (!password) {
    return "Password is required";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 8 characters long";
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return "Password is too long";
  }

  return null;
}

export function validatePasswordChangeInput(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword) {
    return "Current password is required";
  }

  const newPasswordError = validateNewPassword(newPassword);
  if (newPasswordError) {
    return newPasswordError;
  }

  if (newPassword !== confirmPassword) {
    return "New passwords do not match";
  }

  if (currentPassword === newPassword) {
    return "New password must be different from your current password";
  }

  return null;
}
