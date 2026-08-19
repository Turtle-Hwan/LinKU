/**
 * 저장된 자격증명 값의 형식 판별
 *
 * chrome storage나 logger에 의존하지 않는 순수 모듈입니다. 암호화 자체는
 * `crypto.ts`가 담당하고, 여기서는 "이 값이 암호문 형식인가"만 판단합니다.
 */

/** AES-GCM 권장 IV 길이 (바이트) */
export const IV_LENGTH = 12;

/** PBKDF2 salt 길이 (바이트) */
export const SALT_LENGTH = 16;

const HEX_PATTERN = /^[0-9a-f]+$/iu;

/**
 * 값이 `salt:iv:암호문` 형식인지 판별합니다.
 *
 * 복호화에 실패했을 때 저장값을 평문으로 되돌리는 fallback이 암호문을 그대로
 * 비밀번호로 넘기지 않도록 구분하는 데 씁니다. 콜론이 들어간 평범한 비밀번호를
 * 암호문으로 오인하지 않도록 salt와 IV의 길이·문자 집합까지 확인합니다.
 */
export function looksEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;

  const [saltHex, ivHex, encryptedBase64] = parts;
  if (!saltHex || !ivHex || !encryptedBase64) return false;
  if (!HEX_PATTERN.test(saltHex) || !HEX_PATTERN.test(ivHex)) return false;

  return saltHex.length === SALT_LENGTH * 2 && ivHex.length === IV_LENGTH * 2;
}
