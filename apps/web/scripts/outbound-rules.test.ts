// The rule for a child's way out fails on a page with a link out of Tò He that is not marked, and passes the rest.
import { describe, expect, it } from 'vitest';
import { outboundProblems } from './outbound-rules.ts';

describe('the links out of Tò He', () => {
  it('passes a page whose links out are all marked data-out', () => {
    const html = [
      '<a href="/faq/">Hỏi đáp</a>',
      '<a href="#main">Bỏ qua</a>',
      '<a href="https://docs.toheplay.io.vn/" data-out>Tài liệu</a>',
      '<a href="mailto:hello@toheplay.io.vn" data-out="">hello@toheplay.io.vn</a>',
      '<a class="x" data-out href="https://github.com/vinh466/tohe-play">GitHub</a>',
    ].join('');
    expect(outboundProblems('/about/', html)).toEqual([]);
  });

  it('fails for a link to another origin, a mailto or a protocol-relative address without the mark', () => {
    const html = [
      '<a href="https://docs.toheplay.io.vn/">Tài liệu</a>',
      '<a href="mailto:hello@toheplay.io.vn">Thư</a>',
      '<a href="//example.com/">Ngoài</a>',
      '<a href="/data-outside/" data-outside>Trong</a>',
    ].join('');
    expect(outboundProblems('/about/', html)).toEqual([
      '/about/: a link out of Tò He, https://docs.toheplay.io.vn/, without data-out',
      '/about/: a link out of Tò He, mailto:hello@toheplay.io.vn, without data-out',
      '/about/: a link out of Tò He, //example.com/, without data-out',
    ]);
  });
});
