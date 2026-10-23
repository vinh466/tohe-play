import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, devices, type TransferCodeView, type TransferView, transfers } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { TERMS_VERSION } from '../legal/documents.ts';
import { BackLink } from '../navigation/leave.tsx';
import { NamedScreen, SendCopy } from '../session/AtTables.tsx';
import { withProof } from '../session/proofOfWork.ts';
import { lostServerCopy, tablesStep, termsAgain } from '../session/serverCopy.ts';
import {
  clock,
  POLL_MS,
  type Prove,
  pendingTransfer,
  readTyped,
  redeemTransfer,
  resumeTransfer,
  secondsLeft,
  secretFromHash,
  secretFromScan,
  settleAnswer,
  settleMoves,
  showCode,
  startTransfer,
  transferLink,
} from '../session/transfer.ts';
import { useDeviceProfilesChanged } from '../session/useSession.ts';
import { db, type LocalProfile } from '../storage/db.ts';
import { MAX_DEVICE_PROFILES, TooManyDeviceProfiles } from '../storage/deviceProfiles.ts';
import { Button } from '../ui/Button.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { copyText } from '../ui/copyText.ts';
import { Icon } from '../ui/Icon.tsx';
import { QrCode } from '../ui/QrCode.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';

// The transfer code (ADR 0043, step I2b): "Chuyển sang máy khác" on the old device, "Tôi có mã chuyển máy" on the new
// one. docs/architecture/identity.md#the-transfer-code

const link = 'text-center font-semibold text-accent';

/** "Chuyển sang máy khác": the named screen and the copy first when needed, then the code, its QR code and a countdown. */
export function TransferSendPage() {
  const { t } = useTranslation();
  const { profile: first } = useSearch({ from: '/_frame/account/transfer/send' });
  // A copy sent under a new id (its old one was taken, or cleaned up) carries on under that one.
  const [id, setId] = useState(first);
  const changed = useDeviceProfilesChanged();
  const profile = useQuery({
    // Apart from ['device-profiles']: a move settled here must not take the screen that tells it away.
    queryKey: ['transfer-profile', id],
    queryFn: async () => (await db.profiles.get(id)) ?? null,
  });
  const ready = useCallback(
    async (sent: LocalProfile) => {
      setId(sent.id);
      await changed();
      await profile.refetch();
    },
    [changed, profile],
  );

  if (profile.isPending) return <Loading label={t('loading')} />;
  if (!profile.data) {
    return (
      <Screen narrow>
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t('errors.generic')}
        </p>
        <BackLink to="/account/profiles" className={link}>
          {t('transfer.back')}
        </BackLink>
      </Screen>
    );
  }
  const step = tablesStep(profile.data, TERMS_VERSION);
  if (step === 'name') return <NamedScreen profile={profile.data} onDone={ready} purpose="transfer" />;
  if (step === 'send') {
    return (
      <SendCopy
        key={`${profile.data.id}:${profile.data.name}:${profile.data.avatar}`}
        profile={profile.data}
        onDone={ready}
      />
    );
  }
  return (
    <ShowCode
      key={profile.data.id}
      profile={profile.data}
      onTrouble={(next) => (next ? setId(next) : void profile.refetch())}
    />
  );
}

type SendPhase = 'showing' | 'asked' | 'expired' | 'moved';

function ShowCode({
  profile,
  onTrouble,
}: {
  profile: LocalProfile;
  /** Back to the named screen or the copy — under a new id when the server's copy was gone. */
  onTrouble(next?: string): void;
}) {
  const { t } = useTranslation();
  const changed = useDeviceProfilesChanged();
  const [phase, setPhase] = useState<SendPhase>('showing');
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  // Moved: what went with the code leaves this device; what was played since stays, as a new device profile.
  const movedHere = useCallback(async () => {
    await settleMoves(db, [{ profileId: profile.id }]);
    await changed();
    setPhase('moved');
  }, [profile.id, changed]);

  const start = useMutation({
    mutationFn: () => startTransfer(db, transfers, profile.id, TERMS_VERSION),
    onSuccess: () => setPhase('showing'),
    onError: async (error) => {
      if (!(error instanceof ApiError)) return;
      // Moved already: told here. The copy is gone, or the terms changed: back to the copy, or to the named screen.
      if (error.code === 'device_profile_moved') {
        await movedHere();
        return;
      }
      if (error.code === 'device_profile_not_found')
        onTrouble((await lostServerCopy(db, profile.id)) ?? undefined);
      else if (error.code === 'terms_required') {
        await termsAgain(db, profile.id);
        onTrouble();
      }
    },
  });
  const { mutate, isIdle } = start;
  useEffect(() => {
    if (isIdle) mutate();
  }, [isIdle, mutate]);
  const code: TransferCodeView | undefined = start.data;

  // The old device asks every two seconds while its code is live: asked, moved, or ended.
  const live = code !== undefined && (phase === 'showing' || phase === 'asked');
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      transfers
        .status(profile.id)
        .then((status) =>
          setPhase((current) =>
            current === 'moved' ? current : status.state === 'asked' ? 'asked' : 'showing',
          ),
        )
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.code === 'device_profile_moved') void movedHere();
          else if (error instanceof ApiError && error.status === 404) setPhase('expired');
        });
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [live, profile.id, movedHere]);

  // Leaving the screen cancels a code nobody used.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(
    () => () => {
      if (phaseRef.current !== 'moved') void transfers.cancel(profile.id).catch(() => undefined);
    },
    [profile.id],
  );

  const answer = useMutation({
    mutationFn: (accept: boolean) => transfers.confirm(profile.id, accept),
    onSuccess: async (_, accept) => {
      if (accept) await movedHere();
      else setPhase('expired');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'device_profile_moved') void movedHere();
      else setPhase('expired');
    },
  });

  if (phase === 'moved') {
    return (
      <Screen narrow>
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 text-center shadow-sm">
          <h1 className="font-black text-2xl text-brand-ink">{t('transfer.sent', { name: profile.name })}</h1>
          <p className="text-ink-soft">{t('transfer.sentBody')}</p>
        </section>
        <BackLink to="/account/profiles" className={link}>
          {t('transfer.back')}
        </BackLink>
      </Screen>
    );
  }

  if (start.isError) {
    return (
      <Screen narrow>
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">
          {t(errorKey(start.error))}
        </p>
        <Button onClick={() => start.mutate()}>{t('named.retry')}</Button>
        <BackLink to="/account/profiles" className={link}>
          {t('transfer.back')}
        </BackLink>
      </Screen>
    );
  }
  if (!code) return <Loading label={t('transfer.preparing')} />;

  const left = secondsLeft(code.expiresAt, now);
  const expired = phase === 'expired' || left === 0;
  const url = transferLink(window.location.origin, code.secret);
  return (
    <Screen narrow>
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-5 text-center shadow-sm">
        <h1 className="font-black text-2xl text-brand-ink">
          {t('transfer.sendTitle', { name: profile.name })}
        </h1>
        <p className="text-ink-soft">{t('transfer.sendBody')}</p>
        {expired ? (
          <>
            <p role="alert" className="font-semibold text-danger">
              {t('transfer.expired')}
            </p>
            <Button
              onClick={() => {
                setPhase('showing');
                start.mutate();
              }}
            >
              {t('transfer.again')}
            </Button>
          </>
        ) : (
          <>
            <QrCode text={url} label={t('transfer.qr')} />
            <p className="flex flex-col">
              <span className="text-ink-soft text-sm">{t('transfer.code')}</span>
              <span className="font-black text-4xl text-ink tabular-nums tracking-widest">
                {showCode(code.code)}
              </span>
            </p>
            <p className="text-ink-soft tabular-nums">{t('transfer.left', { time: clock(left) })}</p>
            <Button
              variant="secondary"
              onClick={async () => {
                setCopied(await copyText(url));
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? t('transfer.copied') : t('transfer.copyLink')}
            </Button>
          </>
        )}
      </section>
      <BackLink to="/account/profiles" className={link}>
        {t('transfer.back')}
      </BackLink>
      <ConfirmDialog
        open={phase === 'asked' && !expired}
        title={t('transfer.askTitle', { name: profile.name })}
        body={t('transfer.askBody')}
        primary={{ label: t('transfer.no'), onClick: () => answer.mutate(false) }}
        secondary={{ label: t('transfer.yes'), onClick: () => answer.mutate(true) }}
      />
    </Screen>
  );
}

type ReceivePhase =
  | { step: 'form' }
  | { step: 'scanning' }
  | { step: 'waiting'; id: string }
  | { step: 'done'; name: string }
  | { step: 'ended'; reason: 'declined' | 'expired' | 'full' };

const prove: Prove = (send) => withProof(undefined, send);

/**
 * "Tôi có mã chuyển máy": six digits, the transfer link pasted, a QR code scanned, or the link the QR code carries (its
 * secret after `#`). What it redeems is kept on the device until it settles, so a lost answer or a closed app finds it
 * again here, or when the hub next opens.
 */
export function TransferReceivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const changed = useDeviceProfilesChanged();
  const [phase, setPhase] = useState<ReceivePhase>({ step: 'form' });
  const [typed, setTyped] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const show = useCallback(
    async (view: TransferView | null) => {
      if (!view) return;
      if (view.state === 'done') {
        await changed();
        setPhase({ step: 'done', name: view.profile?.name ?? '' });
      } else if (view.state === 'asked') setPhase({ step: 'waiting', id: view.id });
      else {
        const reason = view.state === 'declined' ? 'declined' : view.state === 'full' ? 'full' : 'expired';
        setPhase({ step: 'ended', reason });
      }
    },
    [changed],
  );

  const redeem = useMutation({
    mutationFn: async (body: { secret: string } | { code: string }) => {
      if ((await db.profiles.count()) >= MAX_DEVICE_PROFILES) throw new TooManyDeviceProfiles();
      await devices.start();
      return redeemTransfer(db, transfers, body, prove);
    },
    onSuccess: show,
  });

  // On opening: what this device was redeeming goes on; else the link of a QR code, its secret after `#`, is redeemed
  // at once and taken off the address bar.
  const { mutate } = redeem;
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const secret = secretFromHash(window.location.hash);
    if (secret) window.history.replaceState(window.history.state, '', window.location.pathname);
    void resumeTransfer(db, transfers, prove)
      .catch(() => null)
      .then(async (view) => {
        if (view) await show(view);
        else if (secret) mutate({ secret });
      });
  }, [mutate, show]);

  // Waiting for the old device's yes: asked every two seconds. Only "no such transfer" ends it; the network may come back.
  const waiting = phase.step === 'waiting' ? phase.id : null;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      transfers
        .get(waiting)
        .then(async (view) => {
          await settleAnswer(db, view);
          await show(view);
        })
        .catch(async (error: unknown) => {
          if (!(error instanceof ApiError && error.status === 404)) return;
          await pendingTransfer.clear(db);
          setPhase({ step: 'ended', reason: 'expired' });
        });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, show]);

  const read = readTyped(typed, window.location.origin);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (read) redeem.mutate(read);
  };
  const failure =
    redeem.error instanceof TooManyDeviceProfiles
      ? t('transfer.full', { max: MAX_DEVICE_PROFILES })
      : redeem.isError
        ? t(errorKey(redeem.error))
        : null;
  const ended =
    phase.step !== 'ended'
      ? null
      : phase.reason === 'declined'
        ? t('transfer.declined')
        : phase.reason === 'full'
          ? t('transfer.full', { max: MAX_DEVICE_PROFILES })
          : t('transfer.receiveExpired');

  if (phase.step === 'done') {
    return (
      <Screen narrow>
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 text-center shadow-sm">
          <h1 className="font-black text-2xl text-brand-ink">
            {t('transfer.received', { name: phase.name })}
          </h1>
          <p className="text-ink-soft">{t('transfer.receivedBody')}</p>
          <Button onClick={() => void navigate({ to: '/play' })}>{t('transfer.play')}</Button>
        </section>
      </Screen>
    );
  }
  if (phase.step === 'waiting') {
    return (
      <Screen narrow>
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 text-center shadow-sm">
          <h1 className="font-black text-2xl text-brand-ink">{t('transfer.waiting')}</h1>
          <p className="text-ink-soft">{t('transfer.waitingHint')}</p>
        </section>
      </Screen>
    );
  }
  if (redeem.isPending && !read) return <Loading label={t('transfer.receiving')} />;

  return (
    <Screen narrow>
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="font-black text-2xl text-brand-ink">{t('transfer.receiveTitle')}</h1>
          <p className="text-ink-soft">{t('transfer.receiveBody')}</p>
        </div>
        {ended ? (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-danger">
            {ended}
          </p>
        ) : null}
        {phase.step === 'scanning' ? (
          <Scanner
            onSecret={(secret) => {
              setPhase({ step: 'form' });
              redeem.mutate({ secret });
            }}
            onStop={() => setPhase({ step: 'form' })}
          />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <TextField
              label={t('transfer.codeInput')}
              hint={t('transfer.codeHint')}
              autoComplete="one-time-code"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              error={showErrors && !read ? t('transfer.errors.invalid') : null}
              className="text-center"
            />
            {failure ? (
              <p role="alert" className="text-danger">
                {failure}
              </p>
            ) : null}
            <Button type="submit" busy={redeem.isPending}>
              {t('transfer.receiveGo')}
            </Button>
            {canScan() ? (
              <Button variant="secondary" onClick={() => setPhase({ step: 'scanning' })}>
                <Icon name="camera" />
                {t('transfer.scan')}
              </Button>
            ) : null}
          </form>
        )}
      </section>
      <BackLink to="/account/profiles" className={link}>
        {t('transfer.back')}
      </BackLink>
    </Screen>
  );
}

/** The browser's own QR reader, where there is one (Chrome on Android); elsewhere the six digits, or the phone's camera app. */
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

type BarcodeDetectorClass = new (options: { formats: string[] }) => BarcodeDetectorLike;

function detectorClass(): BarcodeDetectorClass | null {
  const found = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  return found ?? null;
}

/** A camera and a QR reader: on HTTPS (or localhost), in a browser that has BarcodeDetector. */
function canScan(): boolean {
  return detectorClass() !== null && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

function Scanner({ onSecret, onStop }: { onSecret(secret: string): void; onStop(): void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  // The camera starts once: the answers are read through refs, not by starting it again on every render.
  const found = useRef(onSecret);
  found.current = onSecret;
  const stopped = useRef(onStop);
  stopped.current = onStop;
  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    let live = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detector = new Detector({ formats: ['qr_code'] });
    const look = async () => {
      const element = video.current;
      if (!live || !element) return;
      const codes = await detector.detect(element).catch(() => []);
      for (const code of codes) {
        const secret = secretFromScan(code.rawValue, window.location.origin);
        if (secret) {
          found.current(secret);
          return;
        }
      }
      timer = setTimeout(() => void look(), 300);
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!live || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        void look();
      } catch {
        stopped.current();
      }
    })();
    return () => {
      live = false;
      clearTimeout(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={video}
        muted
        playsInline
        className="aspect-square w-full rounded-3xl bg-soft object-cover"
      />
      <p className="text-center text-ink-soft">{t('transfer.scanHint')}</p>
      <Button variant="secondary" onClick={onStop}>
        {t('transfer.scanStop')}
      </Button>
    </div>
  );
}
