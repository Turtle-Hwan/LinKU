/**
 * Form Validation Utilities
 * Centralized validation logic for editor forms
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate link name
 * @param name - The name to validate
 * @param maxLength - Maximum allowed length (default: 15)
 */
export function validateName(name: string, maxLength: number = 15): ValidationResult {
  if (!name.trim()) {
    return {
      valid: false,
      error: '링크 이름을 입력해주세요.',
    };
  }

  if (name.trim().length > maxLength) {
    return {
      valid: false,
      error: `링크 이름은 ${maxLength}자 이하로 입력해주세요.`,
    };
  }

  return { valid: true };
}

/**
 * Validate URL
 * @param url - The URL string to validate
 */
export function validateUrl(url: string): ValidationResult {
  if (!url.trim()) {
    return {
      valid: false,
      error: '링크 URL을 입력해주세요.',
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return {
      valid: false,
      error: '올바른 URL을 입력해주세요.',
    };
  }

  return { valid: true };
}

/**
 * Validate icon selection
 * @param iconId - The selected icon ID
 */
export function validateIcon(iconId: number | null): ValidationResult {
  if (!iconId) {
    return {
      valid: false,
      error: '아이콘을 선택해주세요.',
    };
  }

  return { valid: true };
}

/**
 * Validate all form fields at once
 * Returns first error found, or null if all valid
 */
export function validateLinkForm(
  name: string,
  url: string,
  iconId: number | null,
  maxNameLength: number = 15
): ValidationResult {
  const nameValidation = validateName(name, maxNameLength);
  if (!nameValidation.valid) return nameValidation;

  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) return urlValidation;

  const iconValidation = validateIcon(iconId);
  if (!iconValidation.valid) return iconValidation;

  return { valid: true };
}
