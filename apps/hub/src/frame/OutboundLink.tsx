import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParentGate } from '../session/ParentGate.tsx';
import { parentUnlocked } from '../session/session.ts';
import { useSession } from '../session/useSession.ts';
import { Modal } from '../ui/Modal.tsx';
import { leavesTohe, outboundNeedsPin } from './outbound.ts';

/**
 * A link out of Tò He (ADR 0046): only in Tôi. On an account's child profile it asks for the account's manage PIN first
 * — the parent gate, the same six digits that open profile management — and goes on once the gate opens. Device
 * profiles and adults follow it at once.
 */
export function OutboundLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const [asking, setAsking] = useState(false);
  const me = session.status === 'account' ? session.me : null;

  // The gate opened (or was open in another screen meanwhile): follow the link now.
  useEffect(() => {
    if (asking && me && parentUnlocked(me)) {
      setAsking(false);
      window.location.assign(href);
    }
  }, [asking, me, href]);

  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(event) => {
          if (!leavesTohe(href, window.location.origin) || !outboundNeedsPin(session)) return;
          event.preventDefault();
          setAsking(true);
        }}
      >
        {children}
      </a>
      {me ? (
        <Modal open={asking} title={t('outbound.title')} onClose={() => setAsking(false)}>
          {/* Without a manage PIN yet, the gate asks the owner to prove it is them, in its own words. */}
          <ParentGate
            me={me}
            title={t('outbound.gateTitle')}
            body={me.account.hasManagePin ? t('outbound.gateBody') : undefined}
          />
        </Modal>
      ) : null}
    </>
  );
}
