export class UserFacingError extends Error {
  readonly code: string;

  constructor(
    message: string,
    code: string = "USER_FACING_ERROR",
  ) {
    super(message);
    this.name = "UserFacingError";
    this.code = code;
  }
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof UserFacingError ? error.message : fallbackMessage;
}
