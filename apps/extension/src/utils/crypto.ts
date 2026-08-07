import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "@linku/platform";
import { getOrCreateClientId } from "./clientId";
import { errorLog } from "@/utils/logger";

export async function encryptPassword(password: string): Promise<string> {
  try {
    return await encryptSecret(password, await getOrCreateClientId());
  } catch (error) {
    errorLog("[Crypto] Encryption error:", error);
    throw Object.assign(new Error("비밀번호 암호화에 실패했습니다."), {
      cause: error,
    });
  }
}

export async function decryptPassword(encryptedData: string): Promise<string> {
  try {
    if (!isEncryptedSecret(encryptedData)) {
      throw new Error("Invalid encrypted data format");
    }

    return await decryptSecret(encryptedData, await getOrCreateClientId());
  } catch (error) {
    errorLog("[Crypto] Decryption error:", error);
    throw Object.assign(new Error("비밀번호 복호화에 실패했습니다."), {
      cause: error,
    });
  }
}
