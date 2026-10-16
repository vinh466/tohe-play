import type { RoomOption } from '@tohe/contract';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '../api/client.ts';
import { Button } from '../ui/Button.tsx';
import { Switch } from '../ui/Switch.tsx';
import { localized, TURN_CHOICES, withDefaults } from './model.ts';

/** What the create form and the host's settings edit (POST /api/rooms, PATCH /api/rooms/{id}). */
export interface RoomSettingsValue {
  seats: number;
  isPublic: boolean;
  householdOnly: boolean;
  botsFill: boolean;
  botLevel: string | null;
  botsTakeOver: boolean;
  turnSeconds: number;
  spectators: boolean;
  options: Record<string, unknown>;
}

export function defaultSettings(game: GameSummary): RoomSettingsValue {
  const rooms = game.rooms;
  const bots = rooms?.bots ?? [];
  return {
    seats: rooms?.maxSeats ?? 4,
    isPublic: true,
    householdOnly: false,
    botsFill: bots.length > 0,
    botLevel: bots[Math.floor((bots.length - 1) / 2)] ?? null,
    botsTakeOver: bots.length > 0,
    turnSeconds: 20,
    spectators: false,
    options: withDefaults((rooms?.options ?? []) as unknown as RoomOption[]),
  };
}

/** A row of choices, one pressed. */
function Chips<T extends string | number>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: { id: T; label: string }[];
  value: T;
  onChange(id: T): void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={String(choice.id)}
            type="button"
            aria-pressed={choice.id === value}
            onClick={() => onChange(choice.id)}
            className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
              choice.id === value ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The room's platform options and the game's own (house rules, from game.json's `rooms.options`, ADR 0016): one form
 * for every game, so no game builds a room screen of its own.
 */
export function RoomSettings({
  game,
  initial,
  familyOnly,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  game: GameSummary;
  initial: RoomSettingsValue;
  /** A child a parent has not allowed to play with other households: the room stays in the family. */
  familyOnly: boolean;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit(value: RoomSettingsValue): void;
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState<RoomSettingsValue>(
    familyOnly ? { ...initial, householdOnly: true } : initial,
  );
  const set = (change: Partial<RoomSettingsValue>) => setValue((current) => ({ ...current, ...change }));
  const setOption = (id: string, option: unknown) =>
    setValue((current) => ({ ...current, options: { ...current.options, [id]: option } }));
  const rooms = game.rooms;
  if (!rooms) return null;
  const seatChoices = Array.from(
    { length: rooms.maxSeats - rooms.minSeats + 1 },
    (_, i) => rooms.minSeats + i,
  );
  const levelLabel = (level: string) =>
    (t(`rooms.botLevels.${level}`, { defaultValue: level }) as string) || level;
  const options = rooms.options as unknown as RoomOption[];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
      className="flex flex-col gap-5"
    >
      <Chips
        label={t('rooms.seats')}
        choices={seatChoices.map((count) => ({ id: count, label: t('rooms.seatsCount', { count }) }))}
        value={value.seats}
        onChange={(seats) => set({ seats })}
      />
      <Chips
        label={t('rooms.visibility')}
        choices={[
          { id: 'public', label: t('rooms.public') },
          { id: 'private', label: t('rooms.private') },
        ]}
        value={value.isPublic ? 'public' : 'private'}
        onChange={(id) => set({ isPublic: id === 'public' })}
      />
      {familyOnly ? (
        <p className="rounded-2xl bg-notice px-4 py-3 text-notice-ink text-sm">{t('rooms.familyForced')}</p>
      ) : (
        <Chips
          label={t('rooms.who')}
          choices={[
            { id: 'anyone', label: t('rooms.anyone') },
            { id: 'family', label: t('rooms.family') },
          ]}
          value={value.householdOnly ? 'family' : 'anyone'}
          onChange={(id) => set({ householdOnly: id === 'family' })}
        />
      )}
      {rooms.bots.length > 0 ? (
        <>
          <Switch
            label={t('rooms.botsFill')}
            checked={value.botsFill}
            onChange={(botsFill) => set({ botsFill })}
          />
          <Chips
            label={t('rooms.botLevel')}
            choices={rooms.bots.map((level) => ({ id: level, label: levelLabel(level) }))}
            value={value.botLevel ?? rooms.bots[0] ?? ''}
            onChange={(botLevel) => set({ botLevel })}
          />
          <Switch
            label={t('rooms.botsTakeOver')}
            checked={value.botsTakeOver}
            onChange={(botsTakeOver) => set({ botsTakeOver })}
          />
        </>
      ) : null}
      <Chips
        label={t('rooms.turnTimer')}
        choices={TURN_CHOICES.map((seconds) => ({
          id: seconds,
          label: seconds === 0 ? t('rooms.turnOff') : t('rooms.turnSeconds', { seconds }),
        }))}
        value={value.turnSeconds as (typeof TURN_CHOICES)[number]}
        onChange={(turnSeconds) => set({ turnSeconds })}
      />
      <Switch
        label={t('rooms.spectators')}
        hint={t('rooms.spectatorsHint')}
        checked={value.spectators}
        onChange={(spectators) => set({ spectators })}
      />
      {options.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-bold text-ink">{t('rooms.houseRules')}</h3>
          {options.map((option) => {
            const label = localized(option.label, i18n.language);
            const current = value.options[option.id];
            if (option.type === 'boolean') {
              return (
                <Switch
                  key={option.id}
                  label={label}
                  checked={current === true}
                  onChange={(on) => setOption(option.id, on)}
                />
              );
            }
            if (option.type === 'choice') {
              return (
                <Chips
                  key={option.id}
                  label={label}
                  choices={option.choices.map((choice) => ({
                    id: choice.id,
                    label: localized(choice.label, i18n.language),
                  }))}
                  value={String(current ?? option.default)}
                  onChange={(id) => setOption(option.id, id)}
                />
              );
            }
            const chosen = new Set((current as string[] | undefined) ?? option.default);
            return (
              <fieldset key={option.id} className="flex flex-col gap-2">
                <legend className="mb-1.5 font-semibold text-ink">{label}</legend>
                <div className="flex flex-wrap gap-2">
                  {option.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      aria-pressed={chosen.has(choice.id)}
                      onClick={() => {
                        const next = new Set(chosen);
                        if (next.has(choice.id)) next.delete(choice.id);
                        else next.add(choice.id);
                        setOption(
                          option.id,
                          option.choices.map((c) => c.id).filter((id) => next.has(id)),
                        );
                      }}
                      className={`min-h-11 rounded-full px-4 font-semibold text-ink transition active:scale-95 ${
                        chosen.has(choice.id) ? 'bg-soft-strong ring-2 ring-brand' : 'bg-surface'
                      }`}
                    >
                      {localized(choice.label, i18n.language)}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
