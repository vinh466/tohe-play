import { ApiError } from './client.ts';

/** i18n keys for the API's error codes (docs/architecture/identity.md). */
const byCode: Record<string, string> = {
  invalid_credentials: 'errors.invalidCredentials',
  locked_out: 'errors.lockedOut',
  username_taken: 'errors.usernameTaken',
  username_invalid: 'errors.usernameInvalid',
  password_too_short: 'errors.passwordTooShort',
  invite_invalid: 'errors.inviteInvalid',
  pin_invalid: 'errors.pinInvalid',
  password_invalid: 'errors.passwordInvalid',
  too_many_profiles: 'errors.tooManyProfiles',
  not_your_profile: 'errors.notYourProfile',
};

/** The i18n key to show for a failed request. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code ?? Object.values(error.fields)[0]?.[0];
    if (code && byCode[code]) return byCode[code];
    if (error.status === 429) return 'errors.tooManyRequests';
    if (error.status === 400) return 'errors.invalidInput';
    return 'errors.generic';
  }
  if (error instanceof TypeError) return 'errors.offline';
  return 'errors.generic';
}
