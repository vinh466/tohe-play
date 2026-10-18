import { ApiError } from './client.ts';

/** i18n keys for the API's error codes (docs/architecture/identity.md). */
const byCode: Record<string, string> = {
  invalid_credentials: 'errors.invalidCredentials',
  locked_out: 'errors.lockedOut',
  password_too_short: 'errors.passwordTooShort',
  email_invalid: 'errors.emailInvalid',
  email_unavailable: 'errors.emailUnavailable',
  email_unchanged: 'errors.emailUnchanged',
  code_invalid: 'errors.codeInvalid',
  attempt_closed: 'errors.attemptClosed',
  code_cooldown: 'errors.codeCooldown',
  too_many_codes: 'errors.tooManyCodes',
  pin_invalid: 'errors.pinInvalid',
  password_invalid: 'errors.passwordInvalid',
  step_up_required: 'errors.stepUpRequired',
  manage_pin_not_set: 'errors.managePinNotSet',
  manage_pin_invalid: 'errors.managePinInvalid',
  terms_required: 'errors.termsRequired',
  password_not_set: 'errors.passwordNotSet',
  email_required: 'errors.emailRequired',
  last_method: 'errors.lastMethod',
  provider_account_in_use: 'errors.providerAccountInUse',
  account_suspended: 'errors.accountSuspended',
  asked_child_required: 'errors.askedChildRequired',
  no_community: 'errors.noCommunity',
  method_disabled: 'errors.methodDisabled',
  registration_closed: 'errors.registrationClosed',
  invite_required: 'errors.inviteRequired',
  invite_invalid: 'errors.inviteInvalid',
  sign_in_expired: 'errors.signInExpired',
  wrong_step: 'errors.signInExpired',
  proof_required: 'errors.codeInvalid',
  too_many_profiles: 'errors.tooManyProfiles',
  last_profile: 'errors.lastProfile',
  name_required: 'errors.nameRequired',
  name_invalid_character: 'errors.nameInvalidCharacter',
  name_too_long: 'errors.nameTooLong',
  name_reserved: 'errors.nameReserved',
  room_not_found: 'rooms.errors.notFound',
  room_closed: 'rooms.errors.closed',
  room_full: 'rooms.errors.full',
  room_locked: 'rooms.errors.locked',
  room_account_only: 'rooms.errors.accountOnly',
  parent_permission: 'rooms.errors.parentPermission',
  game_too_young: 'rooms.errors.tooYoung',
  not_host: 'rooms.errors.notHost',
  hand_in_progress: 'rooms.errors.handInProgress',
  not_enough_players: 'rooms.errors.notEnoughPlayers',
  too_many_rooms: 'rooms.errors.tooManyRooms',
  options_invalid: 'rooms.errors.optionsInvalid',
  rules_unavailable: 'rooms.errors.rulesUnavailable',
  spectators_off: 'rooms.errors.spectatorsOff',
  not_in_account: 'rooms.errors.notInAccount',
  profile_id_invalid: 'rooms.errors.profileIdInvalid',
  profile_not_found: 'rooms.errors.profileNotFound',
  invites_closed: 'rooms.errors.invitesClosed',
  lookup_limit: 'rooms.errors.lookupLimit',
  invite_limit: 'rooms.errors.inviteLimit',
  invitee_limit: 'rooms.errors.inviteeLimit',
  child_invites_account_only: 'errors.childInvitesAccountOnly',
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
