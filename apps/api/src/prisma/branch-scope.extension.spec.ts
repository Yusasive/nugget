import { applyBranchScope } from './branch-scope.extension';

const BRANCH = 'branch-a';

describe('applyBranchScope', () => {
  it('adds branchId to where on a findMany with no args', () => {
    expect(applyBranchScope('findMany', undefined, BRANCH)).toEqual({
      where: { branchId: BRANCH },
    });
  });

  it('preserves the caller’s other where conditions', () => {
    const result = applyBranchScope(
      'findMany',
      { where: { isActive: true } },
      BRANCH,
    );
    expect(result.where).toEqual({ isActive: true, branchId: BRANCH });
  });

  it('overrides a foreign branchId rather than trusting the caller', () => {
    const result = applyBranchScope(
      'findUnique',
      { where: { branchId: 'branch-b' } },
      BRANCH,
    );
    expect(result.where).toEqual({ branchId: BRANCH });
  });

  it('forces branchId onto created rows', () => {
    const result = applyBranchScope(
      'create',
      { data: { name: 'x', branchId: 'branch-b' } },
      BRANCH,
    );
    expect(result.data).toEqual({ name: 'x', branchId: BRANCH });
  });

  it('forces branchId onto every row of a createMany', () => {
    const result = applyBranchScope(
      'createMany',
      { data: [{ name: 'a' }, { name: 'b', branchId: 'branch-b' }] },
      BRANCH,
    );
    expect(result.data).toEqual([
      { name: 'a', branchId: BRANCH },
      { name: 'b', branchId: BRANCH },
    ]);
  });

  it('scopes both halves of an upsert', () => {
    const result = applyBranchScope(
      'upsert',
      { where: { id: '1' }, create: { name: 'a' }, update: { name: 'b' } },
      BRANCH,
    );
    expect(result.create).toEqual({ name: 'a', branchId: BRANCH });
    expect(result.update).toEqual({ name: 'b', branchId: BRANCH });
    expect(result.where).toEqual({ id: '1', branchId: BRANCH });
  });

  it('scopes deleteMany so a delete cannot reach another branch', () => {
    const result = applyBranchScope(
      'deleteMany',
      { where: { isActive: false } },
      BRANCH,
    );
    expect(result.where).toEqual({ isActive: false, branchId: BRANCH });
  });

  it('does not attach a where clause to plain create', () => {
    const result = applyBranchScope('create', { data: { name: 'x' } }, BRANCH);
    expect(result.where).toBeUndefined();
  });
});
