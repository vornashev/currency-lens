import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { normalizeSettings } from '../src/shared/defaults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('build script produces valid Chrome and Firefox MV3 bundles', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], {
    cwd: ROOT,
    stdio: 'pipe',
  });

  for (const target of ['chrome', 'firefox']) {
    const dir = path.join(ROOT, 'dist', target);
    const manifestPath = path.join(dir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), `Missing manifest for ${target}`);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.name, 'CurrencyLens');

    // Verify all referenced files exist
    assert.ok(fs.existsSync(path.join(dir, manifest.action.default_popup)));
    for (const iconPath of Object.values(manifest.icons)) {
      const absIcon = path.join(dir, iconPath);
      assert.ok(fs.existsSync(absIcon), `Missing icon ${iconPath} for ${target}`);
      // Check PNG signature
      const sig = fs.readFileSync(absIcon).subarray(0, 8);
      assert.deepEqual([...sig], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
    for (const cs of manifest.content_scripts) {
      assert.equal(cs.all_frames, true, `Expected all_frames=true for ${target}`);
      assert.equal(cs.match_about_blank, true, `Expected match_about_blank=true for ${target}`);
      for (const jsFile of cs.js) {
        const absJs = path.join(dir, jsFile);
        assert.ok(fs.existsSync(absJs), `Missing content script ${jsFile}`);
        // Syntax check the bundled content script with Node --check
        execFileSync(process.execPath, ['--check', absJs], { stdio: 'pipe' });
      }
    }

    if (target === 'chrome') {
      assert.equal(manifest.background.service_worker, 'background/service-worker.js');
      assert.ok(fs.existsSync(path.join(dir, manifest.background.service_worker)));
      assert.ok(manifest.permissions.includes('sidePanel'));
      assert.ok(manifest.permissions.includes('storage'));
      assert.equal(manifest.side_panel?.default_path, 'popup/popup.html?view=panel');
    } else {
      assert.deepEqual(manifest.background.scripts, ['background/service-worker.js']);
      assert.ok(manifest.browser_specific_settings?.gecko?.id);
      assert.ok(fs.existsSync(path.join(dir, manifest.background.scripts[0])));
      assert.ok(!manifest.permissions.includes('sidePanel'));
      assert.equal(manifest.sidebar_action?.default_panel, 'popup/popup.html?view=panel');
    }
  }
});

test('normalizeSettings handles ignoredCurrencies and uiSurface', () => {
  const s = normalizeSettings({
    ignoredCurrencies: ['rub', 'USD', 'rub'],
    uiSurface: 'sidepanel',
  });
  assert.deepEqual(s.ignoredCurrencies, ['RUB', 'USD']);
  assert.equal(s.uiSurface, 'sidepanel');

  const fallback = normalizeSettings({
    ignoredCurrencies: 'invalid',
    uiSurface: 'unknown',
  });
  assert.deepEqual(fallback.ignoredCurrencies, []);
  assert.equal(fallback.uiSurface, 'popup');
});
