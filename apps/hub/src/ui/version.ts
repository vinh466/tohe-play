// The version Tôi and the account screen show: the API's informational version is "1.2.3+<commit>", where a commit is
// forty hex digits no person reads. Seven are enough to tell two builds apart; the full text still goes in the feedback
// mail, where the operator wants it.

/** `1.2.3+0123456789abcdef…` as `1.2.3+0123456`; a version without a long commit is as it was. */
export function shortVersion(version: string): string {
  return version.replace(/\+([0-9a-f]{7})[0-9a-f]+$/i, '+$1');
}
