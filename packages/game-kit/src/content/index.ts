// Content as data (plans/asset-studio D-03): a game's items, crops, levels or lines of dialogue are typed lists with
// ids, checked by the game's tests. Pure TypeScript: no Phaser, no DOM, no library. A game's tests bring Zod (as a
// devDependency) to `checkSchema`; the bundle never validates content at run time.

/** One entry of a catalog: any object with a string `id`. */
export interface ContentItem {
  readonly id: string;
}

/** A frozen list of content of one kind, with its ids typed as the union of their literals. */
export interface Catalog<K extends string = string, T extends ContentItem = ContentItem> {
  /** What the items are (`'crop'`, `'level'`…), used in every error and problem. */
  readonly kind: K;
  readonly items: readonly T[];
  readonly ids: readonly T['id'][];
  /** The item with this id; throws, naming the kind and the id, when there is none. */
  get<I extends T['id']>(id: I): Extract<T, { readonly id: I }>;
  has(id: string): id is T['id'];
}

/** The id union of a catalog, for typing references: `seed: IdOf<typeof seeds>`. */
export type IdOf<C> = C extends Catalog<string, infer T> ? T['id'] : never;

/**
 * Makes a catalog of `items` (write them `as const` so their ids are literals). Throws at once on an empty or
 * duplicate id, naming the kind and the id.
 */
export function defineCatalog<const K extends string, const T extends readonly ContentItem[]>(
  kind: K,
  items: T,
): Catalog<K, T[number]> {
  if (typeof kind !== 'string' || kind === '')
    throw new Error('defineCatalog: the kind must be a non-empty string');
  const byId = new Map<string, T[number]>();
  for (const item of items) {
    const id: unknown = item?.id;
    if (typeof id !== 'string' || id === '') {
      throw new Error(`defineCatalog(${kind}): an item has an empty or missing id`);
    }
    if (byId.has(id)) throw new Error(`defineCatalog(${kind}): duplicate id "${id}"`);
    byId.set(id, item);
  }
  const list = Object.freeze([...items]);
  const ids = Object.freeze([...byId.keys()]) as readonly T[number]['id'][];
  return Object.freeze({
    kind,
    items: list,
    ids,
    get<I extends T[number]['id']>(id: I): Extract<T[number], { readonly id: I }> {
      const item = byId.get(id);
      if (item === undefined) throw new Error(`${kind}: no item with id "${id}"`);
      return item as Extract<T[number], { readonly id: I }>;
    },
    has(id: string): id is T[number]['id'] {
      return byId.has(id);
    },
  });
}

/** A reference from the items of one catalog to the ids of another. */
export interface ReferenceRule<F extends ContentItem = ContentItem> {
  readonly from: Catalog<string, F>;
  /** The field the reference lives in, for the problem it reports. */
  readonly field: string;
  readonly to: Catalog;
  /** The ids an item refers to: `[item.seed]`, `item.drops`, `item.next ? [item.next] : []`. */
  readonly ids: (item: F) => readonly string[];
}

export interface ReferenceProblem {
  /** The kind of the catalog the reference is in. */
  readonly kind: string;
  /** The id of the item the reference is in. */
  readonly id: string;
  readonly field: string;
  /** The id that is not in the target catalog. */
  readonly missing: string;
}

/** Every reference that does not resolve, one problem per missing id; empty when all resolve. */
export function checkReferences<const R extends readonly ContentItem[]>(
  rules: {
    readonly [I in keyof R]: ReferenceRule<R[I]>;
  },
): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  for (const rule of rules as readonly ReferenceRule<ContentItem>[]) {
    for (const item of rule.from.items) {
      for (const target of rule.ids(item)) {
        if (!rule.to.has(target)) {
          problems.push({ kind: rule.from.kind, id: item.id, field: rule.field, missing: target });
        }
      }
    }
  }
  return problems;
}

/** Anything with Zod's `safeParse` shape; the kit does not import Zod. */
export interface SchemaValidator {
  safeParse(value: unknown): { success: true } | { success: false; error: unknown };
}

export interface SchemaProblem {
  readonly kind: string;
  readonly id: string;
  readonly message: string;
}

/** Every item of the catalog the validator refuses, with its message; empty when all pass. */
export function checkSchema(catalog: Catalog, validator: SchemaValidator): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  for (const item of catalog.items) {
    const result = validator.safeParse(item);
    if (!result.success) problems.push({ kind: catalog.kind, id: item.id, message: describe(result.error) });
  }
  return problems;
}

// Zod's error has `issues` with a `path` and a `message`; anything else falls back to its message or its text.
function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .map((issue: { path?: readonly PropertyKey[]; message?: unknown }) => {
          const path =
            Array.isArray(issue?.path) && issue.path.length > 0
              ? `${issue.path.map(String).join('.')}: `
              : '';
          return `${path}${String(issue?.message ?? 'invalid')}`;
        })
        .join('; ');
    }
    if (error instanceof Error) return error.message;
  }
  return String(error);
}
