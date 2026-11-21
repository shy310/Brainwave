import { describe, expect, it } from 'vitest';
import { isChunkError } from '../../src/app/chunks';

describe('code files gone after an update', () => {
  it('recognises the errors browsers give', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/NewLecturePage-B5oDu032.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(isChunkError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true); // Firefox
    expect(isChunkError(new Error('Unable to preload CSS for /assets/index.css'))).toBe(true);
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
  });
});
