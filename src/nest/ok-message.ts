import { SetMetadata } from '@nestjs/common';

/** @internal */
export const OK_MESSAGE_KEY = 'js-output:ok-message';

export type OkMessages = Record<number, string> | string;

/**
 * Per-route success message(s).
 *
 * @example
 * @OkMessage('User created successfully')
 * @OkMessage({ 200: 'Found', 201: 'Created' })
 */
export const OkMessage = (messages: OkMessages): MethodDecorator =>
  SetMetadata(OK_MESSAGE_KEY, messages);
