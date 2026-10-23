// The commands that talk to the Studio — style, check, submit, status — against a fake of its API.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeRefusal } from '../src/api.ts';
import { readPack, writePack } from '../src/pack.ts';
import { DRAFT_FILE } from '../src/remote.ts';
import { type Captured, cli, type FakeStudio, startFakeStudio, style, TOKEN, tempDir } from './helpers.ts';

const DRAW_SCRIPT = fileURLToPath(new URL('./fixtures/draw-squares.mjs', import.meta.url));

let studio: FakeStudio;
let work: ReturnType<typeof tempDir>;
let env: NodeJS.ProcessEnv;
/** Everything every command printed in a test: the token must never be in it. */
let printed: string[];

const tohe = async (...argv: string[]): Promise<Captured> => {
  const result = await cli(argv, work.dir, env);
  printed.push(result.all);
  return result;
};

beforeEach(async () => {
  studio = await startFakeStudio();
  studio.styles.push(
    style('tohe-pixel', ['#000000', '#ff0000', '#00ff00', '#0000ff']),
    style('painted', null, null),
  );
  work = tempDir();
  env = { TOHE_STUDIO_URL: `${studio.url}/`, TOHE_STUDIO_TOKEN: TOKEN };
  printed = [];
  expect(
    (await tohe('pack', 'init', 'farm', '--id', 'farm-shapes', '--style', 'tohe-pixel', '--version', '1.0.0'))
      .code,
  ).toBe(0);
  expect((await tohe('draw', DRAW_SCRIPT, 'farm')).code).toBe(0);
});

afterEach(async () => {
  for (const output of printed) {
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(TOKEN.slice('tohe_at_'.length));
  }
  await studio.close();
  work.remove();
});

describe('style', () => {
  it('lists the styles and shows one', async () => {
    const listed = await tohe('style', 'list');
    expect(listed.code).toBe(0);
    expect(listed.out.join('\n')).toContain(
      'tohe-pixel  Style tohe-pixel — approved, top-down, tile 16px, 4 colours',
    );
    const shown = await tohe('style', 'show', 'tohe-pixel');
    expect(shown.out.join('\n')).toContain('palette: #000000 #ff0000 #00ff00 #0000ff');
    const json = await tohe('style', 'show', 'painted', '--json');
    expect(JSON.parse(json.out.join('\n'))).toMatchObject({ id: 'painted', palette: null });
  });

  it('names the refusal of an unknown style, exit 1', async () => {
    const shown = await tohe('style', 'show', 'nope');
    expect(shown.code).toBe(1);
    expect(shown.err.join('\n')).toContain('style_not_found');
  });
});

describe('check', () => {
  it('creates the draft, uploads every file once, and updates the same draft next time', async () => {
    const checked = await tohe('check', 'farm');
    expect(checked.code).toBe(0);
    expect(checked.out.join('\n')).toContain('2 asset(s); 2 file(s) uploaded now');
    expect(studio.versions.size).toBe(1);
    const [version] = [...studio.versions.values()];
    expect(version?.assets.map((asset) => [asset.id, asset.width, asset.height, asset.licence])).toEqual([
      ['shapes/blink', 16, 8, 'LicenseRef-Tohe-Internal'],
      ['shapes/square', 16, 16, 'LicenseRef-Tohe-Internal'],
    ]);
    expect(version?.assets[0]?.frames).toEqual({ width: 8, height: 8, count: 2 });
    expect(version?.assets[1]?.source).toMatchObject({ kind: 'code', file: 'draw-squares.mjs' });
    const record = JSON.parse(readFileSync(join(work.dir, 'farm', DRAFT_FILE), 'utf8'));
    expect(record[studio.url]).toEqual({ versionId: version?.id, version: '1.0.0' });

    const again = await tohe('check', 'farm');
    expect(again.code).toBe(0);
    expect(again.out.join('\n')).toContain('0 file(s) uploaded now');
    expect(studio.versions.size).toBe(1);
    expect(studio.uploads).toHaveLength(2);
    expect(studio.requests.filter((request) => request.startsWith('PUT /api/studio/drafts/'))).toHaveLength(
      3,
    );
  });

  it("prints the server's checks of a file, naming the asset and the code, exit 1", async () => {
    studio.checkFile = (asset) =>
      asset.id === 'shapes/square'
        ? [{ code: 'not_in_palette', message: '12 pixels are not in the palette', assetId: 'shapes/square' }]
        : [];
    const checked = await tohe('check', 'farm');
    expect(checked.code).toBe(1);
    expect(checked.err.join('\n')).toContain(
      'asset shapes/square: not_in_palette — 12 pixels are not in the palette',
    );
  });

  it("names the asset a field error is about, from the server's index", async () => {
    studio.validateDraft = () => ({ 'assets[1].tags': ['tags_invalid'], version: ['version_invalid'] });
    const checked = await tohe('check', 'farm');
    expect(checked.code).toBe(1);
    const err = checked.err.join('\n');
    expect(err).toContain('asset shapes/square: tags_invalid — tags is not accepted');
    expect(err).toContain('version_invalid — version is not accepted');
  });

  it('refuses a pack with local problems before sending anything', async () => {
    const pack = readPack(join(work.dir, 'farm'));
    writePack(join(work.dir, 'farm'), {
      ...pack,
      assets: pack.assets.map((asset) => ({ ...asset, licence: 'CC-BY-NC-4.0' })),
    });
    const checked = await tohe('check', 'farm');
    expect(checked.code).toBe(1);
    expect(checked.err.join('\n')).toContain('asset shapes/blink: licence_not_accepted');
    expect(studio.requests).toEqual([]);
  });

  it('is a configuration error without the URL or the token, or with something that is not a token', async () => {
    const noUrl = await cli(['check', 'farm'], work.dir, { TOHE_STUDIO_TOKEN: TOKEN });
    expect(noUrl.code).toBe(2);
    expect(noUrl.err.join('\n')).toContain('TOHE_STUDIO_URL');
    const noToken = await cli(['check', 'farm'], work.dir, { TOHE_STUDIO_URL: studio.url });
    expect(noToken.code).toBe(2);
    expect(noToken.err.join('\n')).toContain('TOHE_STUDIO_TOKEN');
    const notAToken = await cli(['check', 'farm'], work.dir, {
      TOHE_STUDIO_URL: studio.url,
      TOHE_STUDIO_TOKEN: 'secret-password',
    });
    expect(notAToken.code).toBe(2);
    expect(notAToken.all).not.toContain('secret-password');
  });

  it('is a refusal when the server does not know the token', async () => {
    const refused = await cli(['check', 'farm'], work.dir, {
      ...env,
      TOHE_STUDIO_TOKEN: 'tohe_at_bm90LXRoZS1yaWdodC10b2tlbg',
    });
    expect(refused.code).toBe(1);
    expect(refused.err.join('\n')).toContain('agent_token_invalid');
    expect(refused.all).not.toContain('bm90LXRoZS1yaWdodC10b2tlbg');
  });

  it('is a configuration error when the server cannot be reached', async () => {
    const unreachable = await cli(['style', 'list'], work.dir, {
      ...env,
      TOHE_STUDIO_URL: 'http://127.0.0.1:1',
    });
    expect(unreachable.code).toBe(2);
    expect(unreachable.err.join('\n')).toContain('cannot reach the Studio at http://127.0.0.1:1');
  });
});

describe('submit and status', () => {
  it('submits the draft for review, and status shows it', async () => {
    const submitted = await tohe('submit', 'farm');
    expect(submitted.code).toBe(0);
    expect(submitted.out.join('\n')).toContain('farm-shapes@1.0.0 submitted for review');
    expect([...studio.versions.values()][0]?.status).toBe('submitted');

    const status = await tohe('status', 'farm-shapes@1.0.0');
    expect(status.code).toBe(0);
    expect(status.out.join('\n')).toMatch(/^farm-shapes@1\.0\.0: submitted/);

    const again = await tohe('submit', 'farm');
    expect(again.code).toBe(1);
    expect(again.err.join('\n')).toContain('no longer a draft');
  });

  it('starts a new draft when pack.json names a new version after a submit', async () => {
    expect((await tohe('submit', 'farm')).code).toBe(0);
    const pack = readPack(join(work.dir, 'farm'));
    writePack(join(work.dir, 'farm'), { ...pack, version: '1.0.1' });
    const checked = await tohe('check', 'farm');
    expect(checked.code).toBe(0);
    expect([...studio.versions.values()].map((version) => `${version.version} ${version.status}`)).toEqual([
      '1.0.0 submitted',
      '1.0.1 draft',
    ]);
  });

  it('shows why a version was rejected', async () => {
    expect((await tohe('submit', 'farm')).code).toBe(0);
    const [version] = [...studio.versions.values()];
    studio.reject(version?.id ?? '', 'The square is too plain for a farm.');
    const status = await tohe('status', 'farm-shapes@1.0.0');
    expect(status.out.join('\n')).toContain('farm-shapes@1.0.0: rejected');
    expect(status.out.join('\n')).toContain('reason: The square is too plain for a farm.');
    const json = await tohe('status', 'farm-shapes@1.0.0', '--json');
    expect(JSON.parse(json.out.join('\n'))).toMatchObject([
      { status: 'rejected', reason: expect.any(String) },
    ]);
  });

  it('does not submit while a file is refused by the checks', async () => {
    studio.checkFile = (asset) =>
      asset.id === 'shapes/blink' ? [{ code: 'frames_mismatch', message: 'the grid does not match' }] : [];
    const submitted = await tohe('submit', 'farm');
    expect(submitted.code).toBe(1);
    expect(submitted.err.join('\n')).toContain('asset shapes/blink: frames_mismatch');
    expect([...studio.versions.values()][0]?.status).toBe('draft');
  });

  it('is a refusal for an unknown pack or version, and a usage error for a bad reference', async () => {
    expect((await tohe('status', 'nothing-here@1.0.0')).code).toBe(1);
    expect((await tohe('submit', 'farm')).code).toBe(0);
    expect((await tohe('status', 'farm-shapes@2.0.0')).code).toBe(1);
    expect((await tohe('status', 'farm-shapes')).code).toBe(2);
  });
});

describe('the token', () => {
  it('never appears in the output, even when the server repeats it', async () => {
    const echoed = await tohe('style', 'show', 'echo');
    expect(echoed.code).toBe(1);
    expect(echoed.err.join('\n')).toContain('failed for Bearer tohe_at_…');
  });

  it('is sent as a bearer and never written to the working folder', async () => {
    expect((await tohe('check', 'farm')).code).toBe(0);
    for (const file of ['pack.json', DRAFT_FILE])
      expect(readFileSync(join(work.dir, 'farm', file), 'utf8')).not.toContain(TOKEN);
  });
});

describe('refusals', () => {
  it('names the assets whose files are missing, and the limit of a file too large', () => {
    expect(
      describeRefusal(409, {
        code: 'files_missing',
        title: 'Some files are not uploaded',
        assets: ['a', 'b'],
      }),
    ).toEqual([
      { code: 'files_missing', message: 'its file is not uploaded', assetId: 'a' },
      { code: 'files_missing', message: 'its file is not uploaded', assetId: 'b' },
    ]);
    expect(
      describeRefusal(413, { code: 'file_too_large', title: 'The file is too large', maxBytes: 8 }),
    ).toEqual([{ code: 'file_too_large', message: 'The file is too large (at most 8 bytes)' }]);
    expect(describeRefusal(503, null)).toEqual([
      { code: 'http_503', message: 'the Studio has no storage on this server' },
    ]);
  });
});
