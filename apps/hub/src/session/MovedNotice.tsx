import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { devices, transfers } from '../api/client.ts';
import { db } from '../storage/db.ts';
import { Button } from '../ui/Button.tsx';
import { withProof } from './proofOfWork.ts';
import { checkMoves, movedNotices, resumeTransfer } from './transfer.ts';
import { useDeviceProfilesChanged } from './useSession.ts';

/** Once per page load: the move is asked when the hub opens, not on every screen. */
let asked = false;

/**
 * "'Mèo Cam' đã chuyển sang máy khác" (ADR 0043, I2b): asks once, when the hub opens, whether a device profile with a
 * copy on the server moved away with a transfer code — a device that never reached the server asks nothing — and tells
 * the player, saying what was played here since stays as a new device profile.
 */
export function MovedNotice() {
  const { t } = useTranslation();
  const changed = useDeviceProfilesChanged();
  const raw = useSyncExternalStore(movedNotices.subscribe, movedNotices.raw);
  useEffect(() => {
    if (asked) return;
    asked = true;
    void checkMoves(db, devices.moves)
      .then(async (notices) => {
        if (notices.length === 0) return;
        movedNotices.add(notices);
        await changed();
      })
      .catch(() => undefined);
    // A profile on its way here when the app closed, or its answer was lost: it arrives now.
    void resumeTransfer(db, transfers, (send) => withProof(undefined, send))
      .then(async (view) => {
        if (view?.state !== 'done' || !view.profile) return;
        movedNotices.add([{ name: view.profile.name, kept: false, received: true }]);
        await changed();
      })
      .catch(() => undefined);
  }, [changed]);

  const notices = movedNotices.parse(raw);
  if (notices.length === 0) return null;
  return (
    <section role="status" className="flex flex-col gap-2 rounded-2xl bg-notice px-4 py-3 text-notice-ink">
      {notices.map((notice) => (
        <div key={`${notice.name}:${notice.kept}:${notice.received === true}`}>
          {notice.received ? (
            <p className="font-bold">{t('transfer.receivedNotice', { name: notice.name })}</p>
          ) : (
            <>
              <p className="font-bold">{t('transfer.movedTitle', { name: notice.name })}</p>
              {notice.kept ? <p className="text-sm">{t('transfer.movedKept')}</p> : null}
            </>
          )}
        </div>
      ))}
      <Button variant="secondary" onClick={() => movedNotices.clear()}>
        {t('transfer.movedDismiss')}
      </Button>
    </section>
  );
}
