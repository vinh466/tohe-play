import { describe, expect, it } from 'vitest';
import { newestMigration, prodVersion, uatVersion } from './versions.ts';

const commit = 'd68554779ed2322ec4f06b3267dc2ac6e7062100';

describe('expected versions', () => {
  it('UAT reports the first 12 characters of the commit', () => {
    expect(uatVersion(commit)).toBe('d68554779ed2');
  });

  it('production reports sha- and the full commit', () => {
    expect(prodVersion(commit)).toBe('sha-d68554779ed2322ec4f06b3267dc2ac6e7062100');
  });
});

describe('newestMigration', () => {
  const dir = 'services/api/src/Tohe.Api/Infrastructure/Database/Migrations';

  it('picks the highest timestamp and ignores designer and snapshot files', () => {
    expect(
      newestMigration([
        `${dir}/20261017120000_Initial.cs`,
        `${dir}/20261017120000_Initial.Designer.cs`,
        `${dir}/20261018065957_AccountDeletion.cs`,
        `${dir}/20261018065957_AccountDeletion.Designer.cs`,
        `${dir}/20261001000000_Older.cs`,
        `${dir}/ToheDbContextModelSnapshot.cs`,
      ]),
    ).toBe('20261018065957_AccountDeletion');
  });

  it('is null when there is no migration file', () => {
    expect(newestMigration([`${dir}/ToheDbContextModelSnapshot.cs`])).toBeNull();
    expect(newestMigration([])).toBeNull();
  });
});
