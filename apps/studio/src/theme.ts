// Light or dark as the hub chose (ADR 0013): the same cookie on the same origin, and the device's setting, followed
// live, when the choice is "system". The Studio has no picker of its own; public/theme-init.js applies the choice
// before the first paint.
import { applyTheme, deviceScheme, resolveTheme, savedChoice } from '@tohe/design-tokens/theme';

export function startTheme() {
  const device = deviceScheme();
  const apply = () => applyTheme(resolveTheme(savedChoice(), device.matches));
  device.addEventListener('change', apply);
  apply();
}
