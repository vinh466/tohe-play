import { defineConfig } from 'vitest/config';

// Vitest replaces CSS with an empty string unless told to process it; the tests read tokens.css with `?raw`.
export default defineConfig({ test: { css: { include: [/tokens\.css/] } } });
