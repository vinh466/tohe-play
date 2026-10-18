// An invite code from a link (`/register?invite=CODE`, ADR 0028), kept on this tab across the round trip to a sign-in
// provider, so signing up with Google still joins the community the link was for.
const KEY = 'tohe.invite';

export const invite = {
  remember(code: string) {
    try {
      sessionStorage.setItem(KEY, code);
    } catch {
      // Private browsing may refuse storage; the code is then typed again.
    }
  },
  get(): string {
    try {
      return sessionStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  },
  forget() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // Nothing kept.
    }
  },
};
