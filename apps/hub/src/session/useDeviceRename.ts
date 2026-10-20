import { useState } from 'react';
import { ApiError } from '../api/client.ts';
import { db } from '../storage/db.ts';
import { updateDeviceProfile } from '../storage/deviceProfiles.ts';
import { cleanName } from './profileNames.ts';

/** A device profile the name rules refused at the last step: renamed on the device, then the same code again. */
export function useDeviceRename() {
  const [refused, setRefused] = useState<{ reason: string | null; name: string } | null>(null);
  return {
    refused,
    setName: (name: string) => setRefused((current) => (current ? { ...current, name } : current)),
    /** Remembers a refusal; true when the error was one. */
    caught(error: unknown, name: string) {
      if (!(error instanceof ApiError && error.code === 'name_refused')) return false;
      setRefused({ reason: error.reason, name });
      return true;
    },
    /** The device profile's name to send: the one typed after a refusal, saved on the device first. */
    async apply(deviceId: string, fallback: string) {
      if (!refused) return fallback;
      const name = cleanName(refused.name);
      await updateDeviceProfile(db, deviceId, { name });
      return name;
    },
  };
}
