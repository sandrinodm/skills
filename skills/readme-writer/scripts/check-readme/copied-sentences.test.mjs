import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { checkReadmes } from './check-readmes.mjs';
import { makeRepo, readme, removeRepos, withRule } from './testing/repo.mjs';

after(removeRepos);

const SHARED = 'Need help with your rollout? Our team offers paid support for every plan we sell.';

function check(texts) {
  const root = makeRepo(Object.fromEntries(texts.map((text, index) => [`${index}.md`, text])));
  const files = texts.map((_, index) => path.join(root, `${index}.md`));
  return checkReadmes(files, { styleOnly: true });
}

describe('checkCopiedSentences', () => {
  it('notes a sentence that three READMEs share, at its line in each', () => {
    const reports = check([
      readme('# A', SHARED),
      readme('# B', '', SHARED),
      readme('# C', 'Intro.', '', `See below. ${SHARED.toUpperCase()}`),
    ]);
    assert.deepEqual(
      reports.map(({ findings }) => withRule(findings, 'copied-sentence').map(({ line }) => line)),
      [[2], [3], [4]],
    );
    assert.equal(
      withRule(reports[0].findings, 'copied-sentence')[0].message,
      'same sentence in 3 of the READMEs checked: ' +
        '"our team offers paid support for every plan we sell."',
    );
  });

  it('truncates long sentences in the message', () => {
    const sentence = `${'word '.repeat(20)}end.`;
    const reports = check([sentence, sentence, sentence]);
    const [finding] = withRule(reports[0].findings, 'copied-sentence');
    assert.equal(
      finding.message,
      `same sentence in 3 of the READMEs checked: "${sentence.slice(0, 70)}..."`,
    );
  });

  it('ignores short sentences and sentences in only two READMEs', () => {
    const short = check(['Install it now.', 'Install it now.', 'Install it now.']);
    assert.deepEqual(withRule(short[0].findings, 'copied-sentence'), []);

    const twice = check([SHARED, SHARED, 'Something else entirely.']);
    assert.deepEqual(withRule(twice[0].findings, 'copied-sentence'), []);
  });

  it('returns reports without the parsed document, for any number of READMEs', () => {
    assert.equal('doc' in check(['a', 'b', 'c'])[0], false);
    assert.equal('doc' in check(['a'])[0], false);
  });
});
