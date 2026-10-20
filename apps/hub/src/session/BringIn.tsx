import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { account, fetchMe, type MeView } from '../api/client.ts';
import { errorKey } from '../api/errors.ts';
import { profileOptionsQuery } from '../api/queries.ts';
import { db, type LocalProfile } from '../storage/db.ts';
import { updateDeviceProfile } from '../storage/deviceProfiles.ts';
import { AgeBandPicker } from '../ui/AgeBandPicker.tsx';
import { Avatar } from '../ui/AvatarGrid.tsx';
import { Button } from '../ui/Button.tsx';
import { Screen } from '../ui/Screen.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { TextField } from '../ui/TextField.tsx';
import {
  type BringInApi,
  type BringInChoice,
  type BringInOutcome,
  bringIn,
  canAdd,
  defaultChoices,
  needsStepUp,
  playsNext,
  refusedKey,
  suggestMergeTarget,
} from './bringInChoices.ts';
import { ParentGate } from './ParentGate.tsx';
import { cleanName } from './profileNames.ts';
import { parentUnlocked } from './session.ts';
import { useDeviceProfilesChanged, useSetMe } from './useSession.ts';

const api: BringInApi = {
  adopt: (body) => account.adoptProfile(body),
  merge: (id, name, data, deviceProfileId) => account.mergeProfile(id, name, data ?? {}, deviceProfileId),
  me: fetchMe,
};

/**
 * Bringing this device's profiles into the account just signed in to (ADR 0043): for each device profile with
 * progress, add it (keeping its id), merge it into one of the account's profiles, or keep it on the device. The one
 * playing is added by default — merged when the account is full — and the others stay. Adding or merging needs step-up
 * level 1, asked once for all of them. `onDone` names who plays next: the profile the device profile being played
 * became, or the one it was merged into — null when it stayed on the device.
 */
export function BringIn({
  me,
  devices,
  playingId,
  onDone,
}: {
  me: MeView;
  devices: LocalProfile[];
  playingId: string | null;
  onDone(playNext: string | null): void;
}) {
  const { t } = useTranslation();
  const setMe = useSetMe();
  const changed = useDeviceProfilesChanged();
  const options = useQuery(profileOptionsQuery);
  const max = options.data?.maxProfiles ?? 5;
  const [choices, setChoices] = useState(() => defaultChoices(devices, playingId, me.profiles, max));
  const [names, setNames] = useState<Record<string, string>>({});
  const [refused, setRefused] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<string[]>([]);
  const [stage, setStage] = useState<'choose' | 'gate' | 'working'>('choose');
  const [error, setError] = useState<unknown>(null);
  // Device profiles merged with more saves than one request carries: the rest stays with them on the device.
  const [savesLeft, setSavesLeft] = useState<string[]>([]);
  const left = devices.filter((device) => !done.includes(device.id));
  // What came in, across tries (a refused name is renamed and tried again).
  const outcomes = useRef<Record<string, Exclude<BringInOutcome, { status: 'rename' }>>>({});
  const finish = () => onDone(playsNext(playingId, outcomes.current));

  const choose = (id: string, choice: BringInChoice) => setChoices((all) => ({ ...all, [id]: choice }));

  const run = async () => {
    setStage('working');
    setError(null);
    let latest = me;
    const stillRefused: Record<string, string | null> = {};
    const finished: string[] = [];
    const kept: string[] = [];
    let failed = false;
    try {
      for (const device of left) {
        const choice = choices[device.id];
        if (!choice || choice.kind === 'keep') continue;
        const name = cleanName(names[device.id] ?? device.name);
        if (name !== device.name) await updateDeviceProfile(db, device.id, { name });
        const outcome = await bringIn(db, api, { ...device, name }, choice);
        if (outcome.status === 'rename') {
          stillRefused[device.id] = outcome.reason;
          continue;
        }
        latest = outcome.me;
        outcomes.current[device.id] = outcome;
        if (outcome.status === 'merged' && outcome.savesLeft > 0) {
          kept.push(device.name);
        }
        finished.push(device.id);
      }
    } catch (failure) {
      failed = true;
      setError(failure);
    }
    if (latest !== me) await setMe(latest);
    await changed();
    setDone((all) => [...all, ...finished]);
    setRefused(stillRefused);
    setSavesLeft(kept);
    setStage('choose');
    // Done only when everything chosen went through: an error or a refused name stays on this screen.
    // Saves left on the device are said before leaving.
    return !failed && Object.keys(stillRefused).length === 0 && kept.length === 0;
  };

  const submit = async () => {
    const pending = Object.fromEntries(
      left.map((device) => [device.id, choices[device.id] ?? { kind: 'keep' as const }]),
    );
    if (!needsStepUp(pending)) return finish();
    if (!parentUnlocked(me)) return setStage('gate');
    if (await run()) finish();
  };

  // The gate opened: go on with what was chosen.
  const resumed = useRef(false);
  useEffect(() => {
    if (stage !== 'gate' || !parentUnlocked(me) || resumed.current) return;
    resumed.current = true;
    void run().then((ok) => {
      resumed.current = false;
      if (ok) finish();
    });
  });

  if (stage === 'gate') {
    return (
      <Screen narrow>
        <ParentGate me={me} title={t('device.bringTitle')} body={t('device.bringGate')} />
        <Button variant="ghost" onClick={() => setStage('choose')}>
          {t('back')}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <header className="flex flex-col gap-1 pt-4 text-center">
        <h1 className="font-black text-3xl text-brand-ink">{t('device.bringTitle')}</h1>
        <p className="text-ink-soft">{t('device.bringBody', { account: me.account.displayName })}</p>
      </header>
      <ul className="flex flex-col gap-4">
        {left.map((device) => {
          const choice = choices[device.id] ?? { kind: 'keep' };
          const addable = canAdd(choices, device.id, me.profiles.length, max);
          const kinds = [
            ...(addable ? [{ value: 'add' as const, label: t('device.bringAdd') }] : []),
            { value: 'merge' as const, label: t('device.bringMerge') },
            { value: 'keep' as const, label: t('device.bringKeep') },
          ];
          return (
            <li key={device.id} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar avatar={device.avatar} size="sm" />
                <span className="min-w-0 truncate font-bold text-ink text-lg">
                  {names[device.id] ?? device.name}
                </span>
              </div>
              <Segmented
                legend={device.name}
                options={kinds}
                value={choice.kind}
                onChange={(kind) =>
                  choose(
                    device.id,
                    kind === 'add'
                      ? { kind, ageBand: null }
                      : kind === 'merge'
                        ? { kind, into: suggestMergeTarget(device, me.profiles) ?? '' }
                        : { kind },
                  )
                }
              />
              {addable ? null : <p className="text-ink-soft text-sm">{t('device.bringFull')}</p>}
              {choice.kind === 'add' ? (
                <>
                  <Segmented
                    legend={t('device.bringAs')}
                    options={[
                      { value: 'adult', label: t('account.kindAdult') },
                      { value: 'child', label: t('account.kindChild') },
                    ]}
                    value={choice.ageBand ? 'child' : 'adult'}
                    onChange={(kind) =>
                      choose(device.id, { kind: 'add', ageBand: kind === 'child' ? '6-8' : null })
                    }
                  />
                  {choice.ageBand ? (
                    <AgeBandPicker
                      label={t('account.ageBand')}
                      value={choice.ageBand}
                      onChange={(ageBand) => choose(device.id, { kind: 'add', ageBand })}
                    />
                  ) : null}
                </>
              ) : null}
              {choice.kind === 'merge' ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 font-semibold text-ink">{t('device.bringInto')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {me.profiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        aria-pressed={profile.id === choice.into}
                        onClick={() => choose(device.id, { kind: 'merge', into: profile.id })}
                        className={`flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold text-ink transition active:scale-95 ${
                          profile.id === choice.into ? 'bg-soft-strong ring-2 ring-brand' : 'bg-fill'
                        }`}
                      >
                        <span aria-hidden>{profile.avatar}</span>
                        {profile.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {device.id in refused ? (
                <TextField
                  label={t('device.rename')}
                  maxLength={128}
                  value={names[device.id] ?? device.name}
                  onChange={(event) => setNames((all) => ({ ...all, [device.id]: event.target.value }))}
                  error={t(refusedKey(refused[device.id] ?? null))}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {savesLeft.length > 0 ? (
        <p role="status" className="rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm">
          {t('device.savesLeft', { names: savesLeft.join(', ') })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-center text-danger">
          {t(errorKey(error))}
        </p>
      ) : null}
      <footer className="mt-auto flex flex-col gap-3">
        <Button busy={stage === 'working'} onClick={() => void submit()}>
          {t('device.bringDone')}
        </Button>
        <Button variant="ghost" disabled={stage === 'working'} onClick={finish}>
          {t('device.bringLater')}
        </Button>
      </footer>
    </Screen>
  );
}
