import { describe, expect, it } from 'vitest';
import { ApiError, checkProblems } from './api/client.ts';
import { webAddress } from './format.ts';
import {
  approveReady,
  checklistDone,
  frameOrigins,
  mayReview,
  mayWithdraw,
  needsShareAlike,
  pictureGrid,
  REVIEW_CHECKLIST,
  reasonGiven,
  reviewQueue,
  samplesUploaded,
  stepUpOpen,
  styleReviewable,
  versionActions,
} from './review.ts';
import { problem } from './ui/forms.tsx';

const reviewer = { permissions: ['studio.read', 'studio.contribute', 'studio.review'] };
const contributor = { permissions: ['studio.read', 'studio.contribute'] };
const everything = new Set(REVIEW_CHECKLIST.map((item) => item.id));

describe('the checklist gates approving', () => {
  it('holds the five things a person must look at', () => {
    expect(REVIEW_CHECKLIST.map((item) => item.id)).toEqual([
      'children',
      'original',
      'style',
      'readable',
      'source',
    ]);
  });

  it('is done only with every line ticked', () => {
    expect(checklistDone(new Set())).toBe(false);
    expect(checklistDone(new Set(['children', 'original', 'style', 'readable']))).toBe(false);
    expect(checklistDone(everything)).toBe(true);
  });

  it('lets Approve be pressed only once every line is ticked', () => {
    const plain = { shareAlikeNeeded: false, allowShareAlike: false, shareAlikeReason: '' };
    expect(approveReady({ ...plain, ticked: new Set() })).toBe(false);
    expect(approveReady({ ...plain, ticked: new Set(['children']) })).toBe(false);
    expect(approveReady({ ...plain, ticked: everything })).toBe(true);
  });

  it('asks a version with CC-BY-SA-4.0 for the allowance and its reason as well', () => {
    const ticked = everything;
    const shareAlikeNeeded = true;
    expect(approveReady({ ticked, shareAlikeNeeded, allowShareAlike: false, shareAlikeReason: 'x' })).toBe(
      false,
    );
    expect(approveReady({ ticked, shareAlikeNeeded, allowShareAlike: true, shareAlikeReason: '  ' })).toBe(
      false,
    );
    expect(
      approveReady({ ticked, shareAlikeNeeded, allowShareAlike: true, shareAlikeReason: 'Nhạc nền' }),
    ).toBe(true);
    expect(
      approveReady({
        ticked: new Set(),
        shareAlikeNeeded,
        allowShareAlike: true,
        shareAlikeReason: 'Nhạc nền',
      }),
    ).toBe(false);
    expect(needsShareAlike([{ licence: 'CC0-1.0' }, { licence: 'CC-BY-SA-4.0' }])).toBe(true);
    expect(needsShareAlike([{ licence: 'CC-BY-4.0' }])).toBe(false);
  });

  it('takes a reason that is not blank and fits the API’s 1000 characters', () => {
    expect(reasonGiven('')).toBe(false);
    expect(reasonGiven('   ')).toBe(false);
    expect(reasonGiven('Có chữ trong hình')).toBe(true);
    expect(reasonGiven('x'.repeat(1000))).toBe(true);
    expect(reasonGiven('x'.repeat(1001))).toBe(false);
  });
});

describe('what a session may do to a version', () => {
  it('offers nothing without studio.review', () => {
    expect(mayReview(contributor)).toBe(false);
    expect(mayWithdraw(contributor)).toBe(false);
    for (const status of ['draft', 'submitted', 'approved', 'deprecated', 'rejected', 'withdrawn']) {
      expect(versionActions(contributor, status), status).toEqual({
        approve: false,
        reject: false,
        deprecate: false,
        withdraw: false,
      });
    }
  });

  it('follows a version’s life for a reviewer', () => {
    expect(versionActions(reviewer, 'draft')).toEqual({
      approve: false,
      reject: false,
      deprecate: false,
      withdraw: false,
    });
    expect(versionActions(reviewer, 'submitted')).toEqual({
      approve: true,
      reject: true,
      deprecate: false,
      withdraw: false,
    });
    expect(versionActions(reviewer, 'approved')).toEqual({
      approve: false,
      reject: false,
      deprecate: true,
      withdraw: true,
    });
    expect(versionActions(reviewer, 'deprecated')).toEqual({
      approve: false,
      reject: false,
      deprecate: false,
      withdraw: true,
    });
    for (const status of ['rejected', 'withdrawn']) {
      expect(versionActions(reviewer, status), status).toEqual({
        approve: false,
        reject: false,
        deprecate: false,
        withdraw: false,
      });
    }
  });

  // The Studio's session does not say who the platform's owner is: the API refuses anyone else, and the app says so.
  it('says in words that only the owner withdraws, when the API refuses', () => {
    expect(problem(new ApiError(403, 'owner_required'))).toBe(
      'Chỉ chủ sở hữu Tò He mới rút được một phiên bản.',
    );
  });

  it('asks for step-up until it is open, and again once it ran out', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    expect(stepUpOpen({ secureUntil: null }, now)).toBe(false);
    expect(stepUpOpen({ secureUntil: '2026-10-24T11:59:59Z' }, now)).toBe(false);
    expect(stepUpOpen({ secureUntil: '2026-10-24T12:09:00Z' }, now)).toBe(true);
  });
});

describe('styles', () => {
  it('lets a reviewer review a draft only, and approve it once every sample is uploaded', () => {
    expect(styleReviewable(reviewer, { status: 'draft' })).toBe(true);
    expect(styleReviewable(reviewer, { status: 'approved' })).toBe(false);
    expect(styleReviewable(reviewer, { status: 'rejected' })).toBe(false);
    expect(styleReviewable(contributor, { status: 'draft' })).toBe(false);
    expect(samplesUploaded({ samples: [{ sha256: 'a', ext: 'png', bytes: 1, uploaded: true }] })).toBe(true);
    expect(
      samplesUploaded({
        samples: [
          { sha256: 'a', ext: 'png', bytes: 1, uploaded: true },
          { sha256: 'b', ext: 'png', bytes: 1, uploaded: false },
        ],
      }),
    ).toBe(false);
  });
});

describe('what waits for review', () => {
  const by = { kind: 'agent', id: 'x' };
  const summary = (id: string, version: string, status: string, submittedAt: string | null) => ({
    id,
    version,
    status,
    createdBy: by,
    createdAt: '2026-10-01T00:00:00Z',
    submittedAt,
    reviewedAt: null,
  });

  it('lists submitted versions and draft styles, oldest first', () => {
    const queue = reviewQueue(
      [
        {
          id: 'farm-crops',
          versions: [
            summary('v3', '1.2.0', 'submitted', '2026-10-20T00:00:00Z'),
            summary('v2', '1.1.0', 'approved', '2026-10-10T00:00:00Z'),
            summary('v1', '1.0.0', 'draft', null),
          ],
        },
        { id: 'farm-animals', versions: [summary('a1', '1.0.0', 'submitted', '2026-10-05T00:00:00Z')] },
      ],
      [
        { id: 'tohe-pixel', name: 'Tò He pixel', status: 'approved', updatedAt: '2026-09-01T00:00:00Z' },
        { id: 'farm-soft', name: 'Nông trại mềm', status: 'draft', updatedAt: '2026-10-12T00:00:00Z' },
        { id: 'old', name: 'Bị từ chối', status: 'rejected', updatedAt: '2026-09-02T00:00:00Z' },
      ],
    );
    expect(
      queue.map((item) => (item.kind === 'version' ? `${item.packId}@${item.version}` : item.styleId)),
    ).toEqual(['farm-animals@1.0.0', 'farm-soft', 'farm-crops@1.2.0']);
  });

  it('is empty when nothing waits', () => {
    expect(reviewQueue([], [])).toEqual([]);
  });
});

describe('the gallery’s grids', () => {
  it('cuts a sprite sheet by its frames, and lists them left to right, then down', () => {
    const grid = pictureGrid(
      { kind: 'spritesheet', width: 48, height: 32, frames: { width: 16, height: 16, count: 5 } },
      8,
    );
    expect(grid).toEqual({ width: 16, height: 16, columns: 3, rows: 2 });
    expect(frameOrigins(grid as NonNullable<typeof grid>, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 32, y: 0 },
      { x: 0, y: 16 },
      { x: 16, y: 16 },
    ]);
    // Never more frames than the grid holds.
    expect(frameOrigins(grid as NonNullable<typeof grid>, 99)).toHaveLength(6);
  });

  it('cuts a tileset by its frames, or else by the style’s tile', () => {
    expect(pictureGrid({ kind: 'tileset', width: 64, height: 32, frames: null }, 16)).toEqual({
      width: 16,
      height: 16,
      columns: 4,
      rows: 2,
    });
    expect(pictureGrid({ kind: 'tileset', width: 64, height: 32, frames: null }, null)).toBeNull();
  });

  it('draws no grid on a plain picture, an unknown size, or a cell larger than the picture', () => {
    expect(pictureGrid({ kind: 'image', width: 32, height: 32, frames: null }, 16)).toBeNull();
    expect(pictureGrid({ kind: 'tileset', width: null, height: null, frames: null }, 16)).toBeNull();
    expect(pictureGrid({ kind: 'tileset', width: 8, height: 8, frames: null }, 16)).toBeNull();
  });
});

describe('what the API refused', () => {
  it('keeps the checks’ report of a refused approval: code, asset and message', () => {
    expect(
      checkProblems([
        { asset: 'crops/carrot', code: 'colour_not_in_palette', message: '3 pixels outside the palette' },
        { asset: null, code: 'style_not_approved', message: 'The style is not approved' },
        { code: 42 },
        'nonsense',
      ]),
    ).toEqual([
      { asset: 'crops/carrot', code: 'colour_not_in_palette', message: '3 pixels outside the palette' },
      { asset: null, code: 'style_not_approved', message: 'The style is not approved' },
    ]);
    expect(checkProblems(undefined)).toEqual([]);
  });

  it('links a source only to a web address', () => {
    expect(webAddress('https://kenney.nl/assets')).toBe('https://kenney.nl/assets');
    expect(webAddress('http://example.org')).toBe('http://example.org/');
    expect(webAddress('javascript:alert(1)')).toBeUndefined();
    expect(webAddress('kenney.nl')).toBeUndefined();
  });
});
