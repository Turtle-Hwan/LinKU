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

/**
 * Validate Konkuk University email
 * @param email - The email to validate (@konkuk.ac.kr)
 */
export function validateKonkukEmail(email: string): ValidationResult {
  if (!email.trim()) {
    return {
      valid: false,
      error: '이메일을 입력해주세요.',
    };
  }

  // Check email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: '올바른 이메일 형식을 입력해주세요.',
    };
  }

  // Check if it's a Konkuk email
  if (!email.toLowerCase().endsWith('@konkuk.ac.kr')) {
    return {
      valid: false,
      error: '건국대학교 이메일(@konkuk.ac.kr)만 사용 가능합니다.',
    };
  }

  return { valid: true };
}

/**
 * Validate verification code
 * @param code - The 6-digit verification code
 */
export function validateAuthCode(code: string): ValidationResult {
  if (!code.trim()) {
    return {
      valid: false,
      error: '인증 코드를 입력해주세요.',
    };
  }

  // Check if it's 6 digits
  if (!/^\d{6}$/.test(code)) {
    return {
      valid: false,
      error: '6자리 숫자를 입력해주세요.',
    };
  }

  return { valid: true };
}
