import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFinding, createFindingList, isFailure, RULE_LEVELS } from './findings.mjs';

describe('createFinding', () => {
  it('takes the level from the rule', () => {
    assert.deepEqual(createFinding(3, 'broken-link', 'gone'), {
      line: 3,
      level: 'error',
      rule: 'broken-link',
      message: 'gone',
    });
  });

  it('throws for a rule that has no level', () => {
    assert.throws(() => createFinding(1, 'no-such-rule', 'x'), /unknown rule "no-such-rule"/);
  });
});

describe('createFindingList', () => {
  it('drops duplicates and sorts by line, keeping the order within a line', () => {
    const { add, unique } = createFindingList();
    add(5, 'slop-word', 'b');
    add(2, 'slop-phrase', 'a');
    add(5, 'slop-phrase', 'c');
    add(5, 'slop-word', 'b');
    assert.deepEqual(
      unique().map(({ line, rule, message }) => `${line} ${rule} ${message}`),
      ['2 slop-phrase a', '5 slop-word b', '5 slop-phrase c'],
    );
  });
});

describe('isFailure', () => {
  it('fails on errors and slop but not on notes', () => {
    assert.equal(isFailure(createFinding(1, 'broken-link', 'x')), true);
    assert.equal(isFailure(createFinding(1, 'slop-word', 'x')), true);
    assert.equal(isFailure(createFinding(1, 'late-example', 'x')), false);
  });
});

describe('RULE_LEVELS', () => {
  it('uses only the three levels', () => {
    assert.deepEqual(new Set(Object.values(RULE_LEVELS)), new Set(['error', 'slop', 'note']));
  });
});
