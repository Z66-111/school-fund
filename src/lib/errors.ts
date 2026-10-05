import { mn } from "@/lib/i18n/mn";

export class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}
export class ForbiddenError extends AppError {
  constructor() {
    super("FORBIDDEN", mn.errors.forbidden);
  }
}
export class NotFoundError extends AppError {
  constructor() {
    super("NOT_FOUND", mn.errors.notFound);
  }
}
export class ValidationError extends AppError {
  constructor(public fieldErrors: Record<string, string[]>) {
    super("VALIDATION", mn.errors.validation);
  }
}
