// A check runner: one line per check, then a summary. A check passes when its function returns, and fails when it
// throws; the text it returns (or the error's message) is the short detail on the line.

export class Runner {
  passed = 0;
  failed = 0;
  warnings = 0;
  readonly #out: (line: string) => void;

  constructor(out: (line: string) => void = (line) => console.log(line)) {
    this.#out = out;
  }

  /** A heading for the checks that follow. */
  section(title: string): void {
    this.#out(`\n== ${title}`);
  }

  /** A line that is neither a pass nor a fail: a value worth printing. */
  info(name: string, detail = ''): void {
    this.#out(`  · ${name}${detail ? `  ${detail}` : ''}`);
  }

  /** Something the script could not check, or that looks off but does not fail the run. */
  warn(name: string, detail: string): void {
    this.warnings++;
    this.#out(`  ! ${name}  ${detail}`);
  }

  async check(name: string, fn: () => Promise<string | undefined> | string | undefined): Promise<boolean> {
    try {
      const detail = await fn();
      this.passed++;
      this.#out(`  ✔ ${name}${detail ? `  ${detail}` : ''}`);
      return true;
    } catch (error) {
      this.failed++;
      this.#out(`  ✘ ${name}  ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  summary(): string {
    const warnings = this.warnings > 0 ? `, ${this.warnings} warning${this.warnings === 1 ? '' : 's'}` : '';
    return `\n${this.failed === 0 ? 'OK' : 'FAILED'}: ${this.passed} passed, ${this.failed} failed${warnings}`;
  }

  /** Prints the summary; 1 if any check failed. */
  finish(): number {
    this.#out(this.summary());
    return this.failed === 0 ? 0 : 1;
  }
}

/** Fails a check with `message` unless `condition` holds. */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** The first `max` characters of `text` on one line, with an ellipsis if it was cut. */
export function clip(text: string, max = 120): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
