export type LogMeta = Record<string, unknown>;

export type Logger = {
  error(message: string, meta?: LogMeta): void;
  warn?(message: string, meta?: LogMeta): void;
  info?(message: string, meta?: LogMeta): void;
};

export const noopLogger: Logger = {
  error() {},
  warn() {},
  info() {},
};
