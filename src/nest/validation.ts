import { AppError } from '../app-error.js';
import { AppHttpException } from './http.js';

/** Minimal shape compatible with class-validator ValidationError. */
export type ValidationErrorLike = {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorLike[];
};

export type ValidationConfig = {
  errorId?: string;
  title?: string;
  status?: number;
};

/** Nest ValidationPipe `exceptionFactory` → structured AppHttpException. */
export function validationError(
  options: ValidationConfig = {},
): (errors: ValidationErrorLike[]) => AppHttpException {
  const errorId = options.errorId ?? 'VALIDATION-400-1';
  const title = options.title ?? 'Validation failed';
  const status = options.status ?? 400;

  return (errors: ValidationErrorLike[]) => {
    const message = flatten(errors).join('; ') || 'Validation failed';
    return new AppHttpException(
      new AppError({ status, errorId, title, message }),
    );
  };
}

function flatten(errors: ValidationErrorLike[], parent = ''): string[] {
  const out: string[] = [];
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      for (const text of Object.values(error.constraints)) {
        out.push(`${path}: ${text}`);
      }
    }
    if (error.children?.length) out.push(...flatten(error.children, path));
  }
  return out;
}
