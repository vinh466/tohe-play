import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  type DeviceProfileUpload,
  type ExternalOutcome,
  external,
  type PendingSignInView,
} from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { configQuery } from '../api/queries.ts';
import { entry } from '../entry/intent.ts';
import { ConsentCheckbox } from '../legal/Consent.tsx';
import { TERMS_VERSION } from '../legal/documents.ts';
import { refusedKey } from '../session/bringInChoices.ts';
import { invite } from '../session/invite.ts';
import { cleanName, funName, MAX_NAME_LENGTH, visibleLength } from '../session/profileNames.ts';
import { RequireSession } from '../session/RequireSession.tsx';
import { SignUpQuestion } from '../session/SignUpQuestion.tsx';
import { deviceMode } from '../session/session.ts';
import {
  afterSignUp,
  defaultAnswer,
  type SignUpAnswer,
  sendingSignUp,
  signingUpDeviceQuery,
  signUpUpload,
} from '../session/signUpDevice.ts';
import { useDeviceRename } from '../session/useDeviceRename.ts';
import { useDeviceProfilesChanged, useSetMe } from '../session/useSession.ts';
import { db } from '../storage/db.ts';
import { funnel } from '../telemetry/telemetry.ts';
import { AnotherName } from '../ui/AnotherName.tsx';
import { Button } from '../ui/Button.tsx';
import { CodeStep } from '../ui/CodeStep.tsx';
import { Loading, Screen } from '../ui/Screen.tsx';
import { TextField } from '../ui/TextField.tsx';
import { Brand } from './WelcomePage.tsx';

const pendingQuery = { queryKey: ['external-pending'], queryFn: external.pending, staleTime: 0 } as const;

/**
 * Back from a provider for the first time (ADR 0026): one more step on this browser — an address proven with a code,
 * a proof for the account that has the address, or a name and the terms to finish signing up.
 */
export function ContinueSignInPage() {
  return (
    <RequireSession need="signedOut">
      <Continue />
    </RequireSession>
  );
}

/**
 * Signed in: the page's session guard moves on to the picker, which offers to bring the device profiles in (ADR 0043).
 * Otherwise the next step shows.
 */
function useOutcome() {
  const setMe = useSetMe();
  const queryClient = useQueryClient();
  return async (outcome: ExternalOutcome) => {
    if (outcome.me) {
      await setMe(outcome.me);
    } else {
      queryClient.setQueryData(pendingQuery.queryKey, outcome.pending);
    }
  };
}

function Continue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pending = useQuery(pendingQuery);
  const cancel = useMutation({
    mutationFn: () => external.cancel(),
    onSettled: () => navigate({ to: '/account/sign-in', replace: true }),
  });

  if (pending.isPending) return <Loading label={t('loading')} />;
  const step = pending.data;
  return (
    <Screen narrow>
      <Brand subtitle={t('welcome.subtitle')} />
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm">
        {!step ? (
          <>
            <p role="alert" className="text-ink">
              {t('external.expired')}
            </p>
            <Link to="/account/sign-in" className="font-bold text-brand-ink underline underline-offset-4">
              {t('forgot.back')}
            </Link>
          </>
        ) : step.step === 'email' ? (
          <EmailStep step={step} />
        ) : step.step === 'link' ? (
          <LinkStep step={step} />
        ) : (
          <SignUpStep step={step} />
        )}
      </section>
      {step ? (
        <Button variant="ghost" busy={cancel.isPending} onClick={() => cancel.mutate()}>
          {t('cancel')}
        </Button>
      ) : null}
    </Screen>
  );
}

/** The provider vouched for no address: one is asked for, and proven with a code. */
function EmailStep({ step }: { step: PendingSignInView }) {
  const { t } = useTranslation();
  const outcome = useOutcome();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => external.sendEmailCode(email.trim()),
    onSuccess: () => setSent(true),
  });
  const confirm = useMutation({
    mutationFn: (code: string) => external.confirmEmail(code),
    onSuccess: outcome,
  });

  if (sent) {
    return (
      <CodeStep
        email={email.trim()}
        busy={confirm.isPending}
        error={confirm.error}
        onSubmit={(code) => confirm.mutate(code)}
        onResend={async () => {
          confirm.reset();
          await send.mutateAsync();
        }}
        onBack={() => {
          confirm.reset();
          setSent(false);
        }}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) send.mutate();
  };
  const server = send.error instanceof ApiError ? send.error : null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h2 className="font-bold text-ink text-xl">{t('external.emailTitle')}</h2>
      <p className="text-ink">{t('external.emailBody', { provider: step.provider })}</p>
      <TextField
        label={t('welcome.email')}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={server?.field('email') ? t(errorKey(server)) : null}
      />
      {send.isError && !server?.field('email') ? (
        <p role="alert" className="text-danger">
          {t(errorKey(send.error))}
        </p>
      ) : null}
      <Button type="submit" busy={send.isPending} disabled={!email.trim()}>
        {t('forgot.send')}
      </Button>
    </form>
  );
}

/** An account signs in with the address: its owner proves it — a code by email, or the password — before the link. */
function LinkStep({ step }: { step: PendingSignInView }) {
  const { t } = useTranslation();
  const outcome = useOutcome();
  const [mode, setMode] = useState<'choose' | 'code' | 'password'>('choose');
  const [password, setPassword] = useState('');
  const send = useMutation({ mutationFn: () => external.sendLinkCode(), onSuccess: () => setMode('code') });
  const link = useMutation({
    mutationFn: (proof: { code?: string; password?: string }) => external.link(proof),
    onSuccess: outcome,
  });
  const usePassword = step.hasPassword
    ? () => {
        link.reset();
        setMode('password');
      }
    : undefined;

  if (mode === 'code') {
    return (
      <CodeStep
        email={step.email}
        busy={link.isPending}
        error={link.error}
        onSubmit={(code) => link.mutate({ code })}
        onResend={async () => {
          link.reset();
          await send.mutateAsync();
        }}
        onBack={usePassword}
        backLabel={t('stepUp.usePassword')}
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    link.mutate({ password });
  };
  const sendError = send.isError ? (
    <p role="alert" className="text-danger">
      {t(errorKey(send.error))}
    </p>
  ) : null;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-bold text-ink text-xl">{t('external.linkTitle', { provider: step.provider })}</h2>
      <p className="wrap-anywhere text-ink">
        {t('external.linkBody', { email: step.email, provider: step.provider })}
      </p>
      {mode === 'password' ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            label={t('welcome.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={link.isError ? t(errorKey(link.error)) : null}
          />
          <Button type="submit" busy={link.isPending}>
            {t('stepUp.confirm')}
          </Button>
          {sendError}
          <Button variant="ghost" busy={send.isPending} onClick={() => send.mutate()}>
            {t('stepUp.useCode')}
          </Button>
        </form>
      ) : (
        <>
          {sendError}
          <Button busy={send.isPending} onClick={() => send.mutate()}>
            {t('external.sendCode')}
          </Button>
          {usePassword ? (
            <Button variant="ghost" onClick={usePassword}>
              {t('stepUp.usePassword')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * No account has the address: a name and the terms finish signing up, and the first profile plays at once. The device
 * profile that started the sign-in comes along, asked about first (ADR 0043).
 */
function SignUpStep({ step }: { step: PendingSignInView }) {
  const { t, i18n } = useTranslation();
  const outcome = useOutcome();
  const changed = useDeviceProfilesChanged();
  const config = useQuery(configQuery);
  const registration = config.data?.registration ?? 'open';
  const device = useQuery(signingUpDeviceQuery).data ?? null;
  const [answer, setAnswer] = useState<SignUpAnswer>(defaultAnswer);
  const rename = useDeviceRename();
  const [name, setName] = useState(() => funName(i18n.language));
  const named = useRef(false);
  useEffect(() => {
    if (!device || named.current) return;
    named.current = true;
    setName(device.name);
  }, [device]);
  const answered = (next: SignUpAnswer) => {
    if (device && next.mine !== answer.mine) setName(next.mine ? device.name : funName(i18n.language));
    setAnswer(next);
  };
  const [inviteCode, setInviteCode] = useState(() => invite.get().toUpperCase());
  const [agreed, setAgreed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const signUp = useMutation({
    mutationFn: async () => {
      const own = cleanName(name);
      let sent: DeviceProfileUpload | null = null;
      if (device) {
        const named = answer.mine ? own : await rename.apply(device.id, device.name);
        sent = await signUpUpload(db, { ...device, name: named }, answer, named);
      }
      const result = await sendingSignUp(db, sent, () =>
        external.signUp(own, TERMS_VERSION, inviteCode.trim() || null, sent, entry.signUpCode()),
      );
      return { result, sent };
    },
    onSuccess: async ({ result, sent }) => {
      invite.forget();
      // The share link this tab came from counted the account: never again (ADR 0044).
      entry.signedUp();
      funnel.accountCreated();
      if (result.me) {
        await afterSignUp(db, result.me, sent);
        deviceMode.disable();
        await changed();
      }
      await outcome(result);
    },
    onError: (error) => rename.caught(error, device?.name ?? ''),
  });
  const inviteError = registration === 'invite' && !inviteCode.trim() ? t('errors.inviteRequired') : null;
  const server = signUp.error instanceof ApiError ? signUp.error : null;
  const nameError = !cleanName(name)
    ? t('errors.nameRequired')
    : visibleLength(cleanName(name)) > MAX_NAME_LENGTH
      ? t('errors.nameTooLong')
      : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (nameError || inviteError || !agreed) return;
    signUp.mutate();
  };
  if (registration === 'closed') {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-ink text-xl">
          {t('external.signUpTitle', { provider: step.provider })}
        </h2>
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink">
          {t('register.closed')}
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h2 className="font-bold text-ink text-xl">{t('external.signUpTitle', { provider: step.provider })}</h2>
      <p className="wrap-anywhere text-ink">{t('external.signUpBody', { email: step.email })}</p>
      {device ? <SignUpQuestion device={device} answer={answer} onChange={answered} /> : null}
      {rename.refused ? (
        <TextField
          label={t('device.rename')}
          maxLength={128}
          value={rename.refused.name}
          onChange={(event) => rename.setName(event.target.value)}
          error={t(refusedKey(rename.refused.reason))}
        />
      ) : null}
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label={t('register.displayName')}
          hint={t('register.displayNameHint')}
          autoComplete="off"
          maxLength={128}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={showErrors ? nameError : null}
        />
        <AnotherName onClick={() => setName(funName(i18n.language))} />
      </div>
      <TextField
        label={registration === 'invite' ? t('register.invite') : t('register.inviteOptional')}
        hint={registration === 'invite' ? t('register.inviteRequiredHint') : t('register.inviteHint')}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={40}
        value={inviteCode}
        onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
        error={(showErrors && inviteError) || (server?.field('inviteCode') ? t(errorKey(server)) : null)}
      />
      <ConsentCheckbox
        checked={agreed}
        onChange={setAgreed}
        error={showErrors && !agreed ? t('errors.termsRequired') : null}
      />
      {signUp.isError && !server?.field('inviteCode') && !rename.refused ? (
        <p role="alert" className="text-danger">
          {t(errorKey(signUp.error))}
        </p>
      ) : null}
      <Button type="submit" busy={signUp.isPending}>
        {t('register.confirm')}
      </Button>
      <p className="text-ink-soft text-sm">{t('consent.under16')}</p>
    </form>
  );
}
