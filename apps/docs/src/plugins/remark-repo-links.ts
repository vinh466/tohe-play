// Docs link to each other with relative `.md` paths so they work on GitHub and in an editor.
// This rewrites those links to site routes at build time: `../contracts/game-contract-v1.md#manifest`
// becomes `/contracts/game-contract-v1/#manifest`. Links that leave docs/ point to GitHub.
import { dirname, relative, resolve } from 'node:path';

interface Node {
  type: string;
  url?: string;
  children?: Node[];
}

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const GITHUB_BLOB = 'https://github.com/vinh466/tohe-play/blob/main/';

export function remarkRepoLinks() {
  return (tree: Node, file: { path?: string }) => {
    if (!file.path) return;
    const fromDir = dirname(file.path);
    walk(tree, (node) => {
      if (node.type !== 'link' || !node.url || /^[a-z]+:|^\/|^#/i.test(node.url)) return;
      const [target = '', hash] = node.url.split('#');
      const fromRoot = relative(REPO_ROOT, resolve(fromDir, target)).replaceAll('\\', '/');
      const anchor = hash ? `#${hash}` : '';
      if (fromRoot.startsWith('docs/') && fromRoot.endsWith('.md')) {
        const route = fromRoot
          .replace(/^docs\//, '')
          .replace(/\.md$/, '')
          .replace(/(^|\/)index$/, '');
        node.url = `/${route}/${anchor}`.replace(/\/+/g, '/');
      } else if (!fromRoot.startsWith('..')) {
        node.url = `${GITHUB_BLOB}${fromRoot}${anchor}`;
      }
    });
  };
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}
