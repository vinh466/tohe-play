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
  room_not_found: 'rooms.errors.notFound',
  room_closed: 'rooms.errors.closed',
  room_full: 'rooms.errors.full',
  room_locked: 'rooms.errors.locked',
  room_household_only: 'rooms.errors.householdOnly',
  parent_permission: 'rooms.errors.parentPermission',
  game_too_young: 'rooms.errors.tooYoung',
  not_host: 'rooms.errors.notHost',
  hand_in_progress: 'rooms.errors.handInProgress',
  not_enough_players: 'rooms.errors.notEnoughPlayers',
  too_many_rooms: 'rooms.errors.tooManyRooms',
  options_invalid: 'rooms.errors.optionsInvalid',
  rules_unavailable: 'rooms.errors.rulesUnavailable',
  spectators_off: 'rooms.errors.spectatorsOff',
  not_in_household: 'rooms.errors.notInHousehold',
};

/** The i18n key to show for a failed request. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code ?? Object.values(error.fields)[0]?.[0];
    if (code && byCode[code]) return byCode[code];
    if (error.status === 429) return 'errors.tooManyRequests';
    if (error.status === 404) return 'rooms.errors.notFound';
    if (error.status === 400) return 'errors.invalidInput';
    return 'errors.generic';
  }
  if (error instanceof TypeError) return 'errors.offline';
  return 'errors.generic';
}
