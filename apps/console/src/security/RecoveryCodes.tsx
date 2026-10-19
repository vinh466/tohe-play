import { useState } from 'react';
import { Button } from '../ui/forms.tsx';

/** The recovery codes, shown once: each opens the console one time when the phone with the authenticator is lost. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink">
        Mỗi mã dưới đây mở bảng quản trị một lần, khi mất điện thoại có ứng dụng xác thực. Cất chúng ở nơi an
        toàn: Tò He không hiện lại.
      </p>
      <ul
        aria-label="Mã dự phòng"
        className="grid grid-cols-2 gap-2 rounded-xl bg-soft p-3 font-mono text-ink"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            void navigator.clipboard.writeText(codes.join('\n')).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Đã chép' : 'Chép tất cả'}
        </Button>
        <Button onClick={onDone}>Tôi đã cất các mã này</Button>
      </div>
    </div>
  );
}
