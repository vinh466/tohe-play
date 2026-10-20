// Which way of installing Tò He fits which device, and when it may show (E-03).
import { describe, expect, it } from 'vitest';
import {
  chooseInstall,
  detectInApp,
  type Environment,
  type InstallContext,
  isIosSafari,
  SILENT_MS,
} from './install/install.ts';
import { FEEDBACK_ADDRESS, feedbackLink } from './ui/feedback.ts';

const ua = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  zaloAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Zalo/24.09.01',
  zaloIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/24.09.01',
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0;FBBV/1;FBDV/iPhone15,2]',
  messengerAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/470.0.0;]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0;]',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0.0 (iPhone15,2; iOS 26_0; vi_VN; vi; scale=3.00; 1179x2556; 700000000)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A556E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.0 Android (34/14; 450dpi; 1080x2340; samsung; SM-A556E; a55x; s5e8845; vi_VN; 700000000)',
};

describe('what the User-Agent says', () => {
  it('finds the in-app browsers of Zalo, Messenger, Facebook and Instagram', () => {
    expect(detectInApp(ua.zaloAndroid)).toBe('zalo');
    expect(detectInApp(ua.zaloIos)).toBe('zalo');
    expect(detectInApp(ua.messengerIos)).toBe('messenger');
    expect(detectInApp(ua.messengerAndroid)).toBe('messenger');
    expect(detectInApp(ua.facebookAndroid)).toBe('facebook');
    expect(detectInApp(ua.instagramIos)).toBe('instagram');
    expect(detectInApp(ua.instagramAndroid)).toBe('instagram');
  });

  it('leaves real browsers alone', () => {
    for (const agent of [ua.androidChrome, ua.iphoneSafari, ua.iphoneChrome, ua.macSafari]) {
      expect(detectInApp(agent)).toBeNull();
    }
  });

  it('knows Safari on iPhone and iPad, and no other browser', () => {
    expect(isIosSafari(ua.iphoneSafari, 5)).toBe(true);
    expect(isIosSafari(ua.ipadSafari, 5)).toBe(true); // iPadOS says "Macintosh", with a touch screen
    expect(isIosSafari(ua.macSafari, 0)).toBe(false);
    expect(isIosSafari(ua.iphoneChrome, 5)).toBe(false);
    expect(isIosSafari(ua.zaloIos, 5)).toBe(false);
    expect(isIosSafari(ua.messengerIos, 5)).toBe(false);
    expect(isIosSafari(ua.androidChrome, 5)).toBe(false);
  });
});

const NOW = Date.UTC(2026, 9, 19);
const browser: Environment = { standalone: false, inApp: null, iosSafari: false };

const context = (
  patch: Partial<Omit<InstallContext, 'env'>> & { env?: Partial<Environment> } = {},
): InstallContext => ({
  canPrompt: false,
  trigger: 'auto',
  finishedGame: true,
  shownThisVisit: false,
  dismissedAt: null,
  now: NOW,
  ...patch,
  env: { ...browser, ...patch.env },
});

describe('chooseInstall', () => {
  it('Android, Chrome, Edge: the card, once the browser gave its prompt and a game finished', () => {
    expect(chooseInstall(context({ canPrompt: true }))).toBe('prompt');
    expect(chooseInstall(context({ canPrompt: false }))).toBeNull(); // no prompt, nothing to offer by itself
  });

  it('iPhone and iPad Safari: the sheet of iOS steps, once a game finished', () => {
    expect(chooseInstall(context({ env: { iosSafari: true } }))).toBe('ios');
  });

  it('in the browser of Zalo, Messenger, Facebook: the strip, at once, even before any game', () => {
    expect(chooseInstall(context({ env: { inApp: 'zalo' }, finishedGame: false }))).toBe('open-in-browser');
    expect(chooseInstall(context({ env: { inApp: 'messenger', iosSafari: false }, canPrompt: true }))).toBe(
      'open-in-browser',
    );
  });

  it('the card and the sheet wait for the first finished game', () => {
    expect(chooseInstall(context({ canPrompt: true, finishedGame: false }))).toBeNull();
    expect(chooseInstall(context({ env: { iosSafari: true }, finishedGame: false }))).toBeNull();
  });

  it('the card and the sheet show once per visit', () => {
    expect(chooseInstall(context({ canPrompt: true, shownThisVisit: true }))).toBeNull();
    expect(chooseInstall(context({ env: { iosSafari: true }, shownThisVisit: true }))).toBeNull();
  });

  it('never when running as the installed app, not even from the menu', () => {
    for (const trigger of ['auto', 'menu'] as const) {
      expect(chooseInstall(context({ trigger, canPrompt: true, env: { standalone: true } }))).toBeNull();
      expect(chooseInstall(context({ trigger, env: { standalone: true, iosSafari: true } }))).toBeNull();
      expect(chooseInstall(context({ trigger, env: { standalone: true, inApp: 'zalo' } }))).toBeNull();
    }
  });

  describe('after a "no"', () => {
    it('stays silent for 14 days, on every way', () => {
      const dismissedAt = NOW - SILENT_MS + 60_000;
      expect(chooseInstall(context({ canPrompt: true, dismissedAt }))).toBeNull();
      expect(chooseInstall(context({ env: { iosSafari: true }, dismissedAt }))).toBeNull();
      expect(chooseInstall(context({ env: { inApp: 'zalo' }, dismissedAt }))).toBeNull();
    });

    it('speaks again on the 15th day', () => {
      const dismissedAt = NOW - SILENT_MS - 1;
      expect(chooseInstall(context({ canPrompt: true, dismissedAt }))).toBe('prompt');
    });

    it('does not stop "Cài app" in the menu', () => {
      const dismissedAt = NOW - 1000;
      expect(chooseInstall(context({ trigger: 'menu', canPrompt: true, dismissedAt }))).toBe('prompt');
      expect(chooseInstall(context({ trigger: 'menu', env: { iosSafari: true }, dismissedAt }))).toBe('ios');
    });
  });

  describe('"Cài app" in the menu, any time', () => {
    it('shows the way that fits, before any game and after the visit had its one offer', () => {
      const menu = { trigger: 'menu', finishedGame: false, shownThisVisit: true } as const;
      expect(chooseInstall(context({ ...menu, canPrompt: true }))).toBe('prompt');
      expect(chooseInstall(context({ ...menu, env: { iosSafari: true } }))).toBe('ios');
      expect(chooseInstall(context({ ...menu, env: { inApp: 'facebook' } }))).toBe('open-in-browser');
    });

    it('says how by hand where no way fits', () => {
      expect(chooseInstall(context({ trigger: 'menu' }))).toBe('generic');
    });
  });
});

describe('feedbackLink', () => {
  const link = feedbackLink({
    version: '0.9.1+abc',
    userAgent: ua.androidChrome,
    text: { subject: 'Góp ý Tò He', intro: 'Viết ở đây:', version: 'Phiên bản', browser: 'Trình duyệt' },
  });
  const url = new URL(link);

  it('writes to the operator with a subject', () => {
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(FEEDBACK_ADDRESS);
    expect(url.searchParams.get('subject')).toBe('Góp ý Tò He');
  });

  it('carries the version and the browser, and nothing else about the person', () => {
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Phiên bản: 0.9.1+abc');
    expect(body).toContain(`Trình duyệt: ${ua.androidChrome}`);
    expect(body.split('\n').filter(Boolean)).toHaveLength(4);
  });
});
