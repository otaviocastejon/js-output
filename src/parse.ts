/** Shared structured-error parsing for core envelopes and Nest downstream forward. */

export type StructuredFields = {
  statusCode?: number;
  message?: string;
  title?: string;
  errorId?: string;
};

export function remapStatus(
  statusCode: number,
  remap: Partial<Record<number, number>>,
): number {
  return remap[statusCode] ?? statusCode;
}

export function readStructuredFields(obj: Record<string, unknown>): StructuredFields {
  const statusCode =
    typeof obj.statusCode === 'number'
      ? obj.statusCode
      : typeof obj.status === 'number'
        ? obj.status
        : undefined;
  const message = typeof obj.message === 'string' ? obj.message : undefined;
  const title = typeof obj.title === 'string' ? obj.title : undefined;
  const errorId =
    typeof obj.errorId === 'string'
      ? obj.errorId
      : typeof obj.id === 'string'
        ? obj.id
        : undefined;
  return { statusCode, message, title, errorId };
}

export function isForwardable(fields: StructuredFields): boolean {
  return (
    typeof fields.statusCode === 'number' &&
    typeof fields.message === 'string' &&
    typeof fields.title === 'string' &&
    typeof fields.errorId === 'string'
  );
}
