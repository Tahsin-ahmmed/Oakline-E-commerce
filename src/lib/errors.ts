export type ErrorDetails = Record<string, string[] | string | undefined> | undefined;

/** An error whose message is safe to show to the end user. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: ErrorDetails) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const validationError = (message: string, details?: ErrorDetails) =>
  new AppError(422, "VALIDATION_ERROR", message, details);
export const unauthorized = (message = "Please sign in to continue.") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to perform this action.") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string, details?: ErrorDetails) => new AppError(409, "CONFLICT", message, details);
export const tooManyRequests = (message = "Too many requests. Please wait a moment and try again.") =>
  new AppError(429, "RATE_LIMITED", message);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
