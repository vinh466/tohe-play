import { z } from 'zod';

/** A game's id, and a pack's (ADR 0053): lowercase letters, digits and dashes; 3–40 characters. */
export const GameId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/, 'lowercase letters, digits and dashes; 3-40 chars');

export const SemVer = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'semantic version, e.g. 1.2.0');
