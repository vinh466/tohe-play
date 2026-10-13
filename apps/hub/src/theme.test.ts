import sharedScript from '@tohe/design-tokens/theme-init.js?raw';
import { expect, it } from 'vitest';
import hubScript from '../public/theme-init.js?raw';

// The hub's CSP forbids inline scripts, so it serves the shared pre-paint script from its own origin as a copy.
// When the original changes: cp ../../packages/design-tokens/theme-init.js public/
it('serves an exact copy of the shared theme-init.js', () => {
  expect(hubScript).toBe(sharedScript);
});
