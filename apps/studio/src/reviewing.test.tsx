import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Asset, Pack, PackVersion, StudioMe, Style } from './api/client.ts';
import { CheckProblems } from './pages/VersionReview.tsx';
import { routeTree } from './router.tsx';
import { meKey } from './security/Gate.tsx';

/**
 * A page of the Studio as it renders with the API's answers already in hand: `data` maps a query's key to its answer.
 * What the page then asks the API for is every query of the render, by its key.
 */
async function render(path: string, me: StudioMe, data: [readonly unknown[], unknown][] = []) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(meKey, me);
  for (const [key, value] of data) queryClient.setQueryData(key, value);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  // Without React's markers between the parts of one text.
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey.join('/'))
    .sort();
  return { html, queries };
}

const reviewer = {
  accountId: '0b7c5e1a-2f9d-4c1e-9a7b-3d2e1f0a9b8c',
  displayName: 'Cô Ba',
  email: 'co-ba@tohe.test',
  role: 'reviewer',
  permissions: ['studio.read', 'studio.contribute', 'studio.review'],
  twoFactorEnabled: true,
  openUntil: '2099-01-01T20:00:00Z',
  secureUntil: null,
} satisfies StudioMe;

const steppedUp = { ...reviewer, secureUntil: '2099-01-01T12:10:00Z' } satisfies StudioMe;

const contributor = {
  ...reviewer,
  displayName: 'Bé Tư',
  role: 'contributor',
  permissions: ['studio.read', 'studio.contribute'],
} satisfies StudioMe;

const agent = { kind: 'agent', id: '7f00e1a2-0000-0000-0000-000000000000' };

const carrot: Asset = {
  id: 'crops/carrot',
  kind: 'image',
  sha256: 'a'.repeat(64),
  ext: 'png',
  bytes: 512,
  width: 16,
  height: 16,
  frames: null,
  wang: null,
  tags: ['crop'],
  licence: 'CC0-1.0',
  attribution: null,
  source: { type: 'pack', name: 'Kenney Tiny Farm', url: 'https://kenney.nl/assets', author: 'Kenney' },
  uploaded: true,
  publicUrl: null,
};

const chicken: Asset = {
  ...carrot,
  id: 'animals/chicken',
  kind: 'spritesheet',
  sha256: 'b'.repeat(64),
  width: 48,
  height: 16,
  frames: { width: 16, height: 16, count: 3 },
};

function version(status: string, assets: Asset[] = [carrot, chicken]): PackVersion {
  return {
    id: 'v1',
    packId: 'farm-crops',
    version: '1.0.0',
    status,
    createdBy: agent,
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
    submittedAt: '2026-10-21T00:00:00Z',
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
    deprecatedAt: null,
    withdrawnAt: null,
    withdrawReason: null,
    manifestSha256: null,
    manifestUrl: null,
    shareAlikeAllowed: false,
    shareAlikeReason: null,
    assets,
  };
}

const pack: Pack = {
  id: 'farm-crops',
  styleId: 'tohe-pixel',
  description: 'Rau củ',
  createdBy: agent,
  createdAt: '2026-10-20T00:00:00Z',
  versions: [
    {
      id: 'v1',
      version: '1.0.0',
      status: 'submitted',
      createdBy: agent,
      createdAt: '2026-10-20T00:00:00Z',
      submittedAt: '2026-10-21T00:00:00Z',
      reviewedAt: null,
    },
  ],
};

function style(status: string): Style {
  return {
    id: 'tohe-pixel',
    name: 'Tò He pixel',
    status,
    tileSize: 16,
    view: 'top-down',
    palette: ['#1a1c2c', '#f4f4f4'],
    outline: null,
    samples: [{ sha256: 'c'.repeat(64), ext: 'png', bytes: 100, uploaded: true }],
    createdBy: agent,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    reviewedBy: null,
    reviewedAt: null,
    reason: null,
  };
}

const versionPage = (status: string, me: StudioMe, assets?: Asset[]) =>
  render('/packs/farm-crops/v1', me, [
    [['studio', 'version', 'v1'], version(status, assets)],
    [['studio', 'pack', 'farm-crops'], pack],
    [['studio', 'style', 'tohe-pixel'], style('approved')],
  ]);

/** A button by its text, with its attributes: undefined when the page has none. */
function button(html: string, text: string): string | undefined {
  return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].find((match) => match[2] === text)?.[1];
}

const disabled = (attributes: string | undefined) =>
  attributes !== undefined && /\bdisabled=""/.test(attributes);

describe('reviewing a version', () => {
  it('shows nothing of the review to a session without studio.review', async () => {
    for (const status of ['submitted', 'approved']) {
      const { html } = await versionPage(status, contributor);
      expect(html, status).not.toContain('Xét duyệt</h2>');
      expect(html, status).not.toContain('Trước khi duyệt');
      expect(button(html, 'Duyệt và xuất bản'), status).toBeUndefined();
      expect(button(html, 'Từ chối'), status).toBeUndefined();
      expect(button(html, 'Ngừng dùng'), status).toBeUndefined();
      expect(html, status).not.toContain('Rút phiên bản');
      expect(html, status).not.toContain('Mã 6 số');
    }
    // Nor asks for what only the review shows: the pack, for its style.
    const { queries } = await render('/packs/farm-crops/v1', contributor, [
      [['studio', 'version', 'v1'], version('submitted')],
    ]);
    expect(queries.filter((query) => query !== 'studio/config')).toEqual(['studio/me', 'studio/version/v1']);
  });

  it('shows the checklist, and asks for step-up before the actions', async () => {
    const { html } = await versionPage('submitted', reviewer);
    expect(html).toContain('Trước khi duyệt');
    for (const line of [
      'Hợp với trẻ em',
      'Không gần như chép lại',
      'Đúng phong cách',
      'Nhìn rõ ở kích thước thật',
      'Nguồn đáng tin',
    ]) {
      expect(html).toContain(line);
    }
    expect(html).toContain('Mã 6 số từ ứng dụng xác thực');
    expect(button(html, 'Xác nhận')).toBeDefined();
    expect(button(html, 'Duyệt và xuất bản')).toBeUndefined();
    expect(button(html, 'Từ chối')).toBeUndefined();
  });

  it('keeps Approve disabled until every line of the checklist is ticked', async () => {
    const { html } = await versionPage('submitted', steppedUp);
    expect(html).not.toContain('Mã 6 số');
    expect(disabled(button(html, 'Duyệt và xuất bản'))).toBe(true);
    expect(html).toContain('Đánh dấu đủ 5 mục ở trên để duyệt.');
    // Rejecting needs its reason first.
    expect(disabled(button(html, 'Từ chối'))).toBe(true);
    expect(html).toContain('Lý do từ chối');
    // A version without CC-BY-SA-4.0 asks for no allowance.
    expect(html).not.toContain('role="switch"');
  });

  it('asks for the share-alike allowance on a version with CC-BY-SA-4.0', async () => {
    const { html } = await versionPage('submitted', steppedUp, [
      { ...carrot, licence: 'CC-BY-SA-4.0', attribution: 'Ai đó' },
    ]);
    expect(html).toContain('role="switch"');
    expect(html).toContain('Cho phép CC-BY-SA-4.0 trong phiên bản này');
    expect(disabled(button(html, 'Duyệt và xuất bản'))).toBe(true);
  });

  it('offers deprecating an approved version, behind step-up', async () => {
    expect(button((await versionPage('approved', reviewer)).html, 'Ngừng dùng')).toBeUndefined();
    const { html } = await versionPage('approved', steppedUp);
    expect(button(html, 'Ngừng dùng')).toBeDefined();
    expect(button(html, 'Duyệt và xuất bản')).toBeUndefined();
    expect(html).not.toContain('Trước khi duyệt');
  });

  it('offers withdrawing only a published version, apart and marked, naming what breaks', async () => {
    for (const status of ['approved', 'deprecated']) {
      const { html } = await versionPage(status, reviewer);
      expect(html, status).toContain('Rút phiên bản');
      expect(html, status).toContain('border-danger-line');
      expect(html, status).toContain('Mọi game ghim farm-crops@1.0.0 sẽ không build được nữa');
      expect(html, status).toContain('Tôi hiểu: mọi game ghim farm-crops@1.0.0 sẽ không build được nữa.');
      // A reason, a code and the confirmation first: never one press.
      expect(disabled(button(html, 'Rút farm-crops@1.0.0')), status).toBe(true);
    }
    for (const status of ['submitted', 'draft', 'rejected', 'withdrawn']) {
      expect((await versionPage(status, steppedUp)).html, status).not.toContain('Rút phiên bản');
    }
  });

  it('shows every picture at 1× and 2× on light and dark, a sprite sheet’s frames, and the style beside', async () => {
    const { html } = await versionPage('submitted', reviewer);
    for (const view of ['1×, nền sáng', '1×, nền tối', '2×, nền sáng', '2×, nền tối']) {
      expect(html).toContain(`alt="crops/carrot, hình, ${view}"`);
    }
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('width="32" height="32"');
    expect(html).toContain('image-rendering:pixelated');
    expect(html).toContain('aria-label="Khung 3"');
    expect(html).not.toContain('aria-label="Khung 4"');
    expect(html).toContain('Phong cách để so');
    expect(html).toContain('Hình mẫu 1 của Tò He pixel');
    // The source's link, and its licence.
    expect(html).toContain('href="https://kenney.nl/assets"');
    expect(html).toContain('CC0-1.0');
  });
});

describe('a refused approval', () => {
  it('shows the server’s problems: code, asset and message', () => {
    const html = renderToString(
      <CheckProblems
        problems={[
          { asset: 'crops/carrot', code: 'colour_not_in_palette', message: '3 pixels outside the palette' },
          { asset: null, code: 'style_not_approved', message: 'The style is not approved' },
        ]}
      />,
    );
    expect(html).toContain('colour_not_in_palette');
    expect(html).toContain('crops/carrot');
    expect(html).toContain('3 pixels outside the palette');
    expect(html).toContain('style_not_approved');
    expect(html).toContain('cả phiên bản');
  });
});

describe('reviewing a style', () => {
  const stylePage = (status: string, me: StudioMe) =>
    render('/styles/tohe-pixel', me, [[['studio', 'style', 'tohe-pixel'], style(status)]]);

  it('offers approving or rejecting a draft to a reviewer, behind step-up', async () => {
    const before = (await stylePage('draft', reviewer)).html;
    expect(before).toContain('Xét duyệt phong cách');
    expect(before).toContain('Mã 6 số từ ứng dụng xác thực');
    expect(button(before, 'Duyệt phong cách')).toBeUndefined();

    const { html } = await stylePage('draft', steppedUp);
    expect(disabled(button(html, 'Duyệt phong cách'))).toBe(false);
    expect(disabled(button(html, 'Từ chối'))).toBe(true);
    // Its palette and samples stay in view.
    expect(html).toContain('#1a1c2c');
    expect(html).toContain('Hình mẫu 1 của Tò He pixel');
  });

  it('offers nothing to a contributor, nor on a style already reviewed', async () => {
    expect((await stylePage('draft', contributor)).html).not.toContain('Xét duyệt phong cách');
    for (const status of ['approved', 'rejected']) {
      expect((await stylePage(status, steppedUp)).html, status).not.toContain('Xét duyệt phong cách');
    }
  });
});

describe('what waits for review', () => {
  const styles = [style('draft')];

  it('opens the library with the queue for a reviewer', async () => {
    const { html, queries } = await render('/', reviewer, [
      [['studio', 'packs'], [pack]],
      [['studio', 'styles'], styles],
    ]);
    expect(html).toContain('Chờ duyệt</h2>');
    expect(html).toContain('farm-crops@1.0.0');
    expect(html).toContain('Tò He pixel');
    expect(queries).toContain('studio/styles');
  });

  it('shows no queue, and asks for no styles, to a contributor', async () => {
    const { html, queries } = await render('/', contributor, [[['studio', 'packs'], [pack]]]);
    expect(html).not.toContain('Chờ duyệt</h2>');
    expect(queries).not.toContain('studio/styles');
  });
});
