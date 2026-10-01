import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from './safe-redirect.ts';

describe('safeRedirectPath', () => {
  it('keeps same-site paths', () => {
    assert.equal(safeRedirectPath('/en/harbor/templates?view=mine'), '/en/harbor/templates?view=mine');
  });
  it('rejects absolute, protocol-relative and backslash targets', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example', 'javascript:alert(1)', '/\tx']) {
      assert.equal(safeRedirectPath(bad), '/en/harbor', bad);
    }
  });
  it('falls back when missing', () => {
    assert.equal(safeRedirectPath(null), '/en/harbor');
    assert.equal(safeRedirectPath('', '/x'), '/x');
  });
});
