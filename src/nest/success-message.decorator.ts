import { SetMetadata } from '@nestjs/common';

export const SUCCESS_MESSAGES_METADATA_KEY = 'js-output:success-messages';

export type SuccessMessageMap = Record<number, string> | string;

/**
 * Per-route success message(s). Pass a string for all statuses, or a map by status code.
 *
 * @example
 * @SuccessMessage('User created successfully')
 * @SuccessMessage({ 200: 'Found', 201: 'Created' })
 */
export const SuccessMessage = (messages: SuccessMessageMap) =>
  SetMetadata(SUCCESS_MESSAGES_METADATA_KEY, messages);
