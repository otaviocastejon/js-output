export type LogMeta = Record<string, unknown>;

export type Logger = {
  error(message: string, meta?: LogMeta): void;
};
