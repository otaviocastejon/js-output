import { AppError } from '../errors/app-error.js';
import { AppHttpException } from './to-http-exception.js';

/** Minimal shape compatible with class-validator ValidationError. */
export type ValidationErrorLike = {
  property: string;
  constraints?: Record<string, string>;
  children?: ValidationErrorLike[];
};

export type ValidationExceptionFactoryOptions = {
  errorId?: string;
  title?: string;
  status?: number;
};

/**
 * Nest ValidationPipe `exceptionFactory` that maps class-validator errors
 * into a structured AppError / HttpException for the js-output filter.
 */
export function validationExceptionFactory(
  options: ValidationExceptionFactoryOptions = {},
): (errors: ValidationErrorLike[]) => AppHttpException {
  const errorId = options.errorId ?? 'VALIDATION-400-1';
  const title = options.title ?? 'Validation failed';
  const status = options.status ?? 400;

  return (errors: ValidationErrorLike[]) => {
    const message = flattenValidationErrors(errors).join('; ') || 'Validation failed';
    return new AppHttpException(
      new AppError({
        status,
        errorId,
        title,
        message,
      }),
    );
  };
}

function flattenValidationErrors(
  errors: ValidationErrorLike[],
  parentPath = '',
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      for (const text of Object.values(error.constraints)) {
        messages.push(`${path}: ${text}`);
      }
    }
    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, path));
    }
  }

  return messages;
}
