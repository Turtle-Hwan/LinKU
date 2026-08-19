export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof UserFacingError ? error.message : fallbackMessage;
}
