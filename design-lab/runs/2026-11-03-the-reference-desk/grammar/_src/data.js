/* ===== Sample data: every word, name, count and date on these sheets comes from here.
   A different deployment brings its own kinds, sources, people and glossary; nothing below is drawn for one trade. ===== */
const DATA = {
  deployment: 'Regional services (sample)',
  today: '3 Nov 2026',
  floors: {
    ops:         { name: 'Operations', tier: 'department' },
    procurement: { name: 'Procurement', tier: 'team' },
    finance:     { name: 'Finance', tier: 'team' },
    org:         { name: 'Whole organisation', tier: 'org' }
  },
  people: {
    me:    { name: 'Sam Achebe', role: 'duty officer', floor: 'ops' },
    jo:    { name: 'Jo Reyes', role: 'procurement desk', floor: 'procurement' },
    priya: { name: 'Priya Nair', role: 'finance lead', floor: 'finance' },
    dev:   { name: 'Dev Patel', role: 'Operations colleague', floor: 'ops' }
  },
  apps: { atlas: 'Data Atlas', artifacts: 'Artifacts', mandate: 'Mandate' },
  /* The model gateway, in both registers. on = the admin has turned it on. */
  gateway: { plain: 'the assistant', Plain: 'The assistant', tech: 'model gateway · askModel', on: true,
    offWhy: 'The assistant is off for this organisation. Admins turn it on in Admin.',
    offStill: 'Questions still work: you pick the reading from a sentence, and Data Atlas matches by keys, names and spelling.' },
  /* Words the organisation has defined once, for everyone (an admin keeps the glossary; no model needed to find them). */
  glossary: [
    { word: 'spring', means: '1 March to 31 May', by: 'Org glossary' },
    { word: 'financial year', means: 'starts 1 April', by: 'Org glossary' }
  ],
  /* The question, as the person typed it, cut into the parts it was read by. */
  question: {
    words: 'which suppliers have we not heard from since spring?',
    by: 'me', floor: 'ops', first: '20 Oct 2026, 09:14',
    parts: [
      { t: 'which suppliers', reads: 'Suppliers', how: 'name', tech: 'kind = Supplier (cco:Organization)' },
      { t: 'have we not heard from', reads: 'no email, delivery note or meeting note', how: 'guess', tech: 'NOT EXISTS contact(source ∈ s1,s2,s3)', alt: 'pick what counts as contact' },
      { t: 'since spring', reads: 'since 1 March 2026', how: 'glossary', tech: 'contact.date ≥ 2026-03-01', alt: 'pick a date' }
    ],
    /* What the assistant added that the person never said. */
    added: { says: 'only suppliers with a running contract', how: 'guess', tech: 'has Contract(status = running)', left: 13 },
    reading: 'Suppliers with a running contract that have had no email, delivery note or meeting note from us since 1 March 2026.',
    readingTech: 'Supplier ∧ ∃Contract(running) ∧ ¬∃Contact(date ≥ 2026-03-01, src ∈ {s1,s2,s3})'
  },
  /* Clarifications: each one neutral, each choice with the count it would leave (counts come from the record, never the model). */
  clarify: [
    { id: 'when', ask: 'Since spring: from when?', why: 'Spring is in the org glossary as 1 March to 31 May. “Since” could mean either end.', raisedBy: 'glossary',
      opts: [ { l: 'Since 1 March', d: 'spring began', n: 9, pick: true }, { l: 'Since 1 April', d: 'your financial year', n: 12 }, { l: 'Since 31 May', d: 'spring ended', n: 17 }, { l: 'Another date', d: '', n: null } ] },
    { id: 'contact', ask: 'Heard from: which records count?', why: 'Data Atlas keeps four kinds of record that link a supplier to us.', raisedBy: 'guess',
      opts: [ { l: 'Emails', d: 'Supplier correspondence', n: 1204, pick: true, src: 's1' }, { l: 'Delivery notes', d: 'at our sites', n: 3310, pick: true, src: 's2' }, { l: 'Meeting notes', d: 'Operations', n: 212, pick: true, src: 's3' }, { l: 'Invoices', d: 'kept on Finance', n: null, locked: true, src: 's4' } ] },
    { id: 'running', ask: 'Only suppliers we still have a contract with?', why: 'You didn’t say this. The assistant suggests it: 13 suppliers’ contracts have ended.', raisedBy: 'guess',
      opts: [ { l: 'Yes, running contracts only', d: '', n: 9, pick: true }, { l: 'No, include ended contracts', d: '', n: 22 } ] }
  ],
  /* Where "heard from" is looked for. */
  sources: [
    { id: 's1', name: 'Supplier correspondence', what: 'emails', app: 'artifacts', floor: 'procurement', n: 1204, from: 'Jan 2026', zone: 'A' },
    { id: 's2', name: 'Delivery notes', what: 'delivery notes', app: 'atlas', floor: 'ops', n: 3310, from: 'Apr 2024', zone: 'A' },
    { id: 's3', name: 'Meeting notes', what: 'meeting notes', app: 'artifacts', floor: 'ops', n: 212, from: 'Sep 2025', zone: 'B' },
    { id: 's4', name: 'Invoices', what: 'invoices', app: 'atlas', floor: 'finance', n: null, from: null, zone: 'U', locked: true, who: 'priya' }
  ],
  /* The workings, step by step. by = who did it: you, the record (Data Atlas, no model) or a guess (model gateway). */
  steps: [
    { k: 'start',  say: 'Start with every supplier you can read', n: 61, by: 'record', how: 'kept on Whole organisation', tech: 'kind = Supplier · floors: org' },
    { k: 'keep',   say: 'Keep those with a running contract', n: 48, out: 13, outWhy: 'contract ended', by: 'guess', ok: 'me', how: 'the assistant suggested it; you said yes', tech: '∃ Contract(status = running)' },
    { k: 'look',   say: 'Look for an email, delivery note or meeting note since 1 March', n: 4726, unit: 'records searched', by: 'record', how: '3 sources; invoices not searched', tech: 'src ∈ {s1,s2,s3} · date ≥ 2026-03-01' },
    { k: 'match',  say: 'Match each record to its supplier', n: 39, unit: 'suppliers heard from', by: 'record', how: '34 by company number, 5 by name spelling', tech: 'key match 34 · trigram ≥ 0.82 ×5' },
    { k: 'maybe',  say: 'One email might be from Easterby Cleaning', n: 1, unit: 'not counted', by: 'guess', how: 'matched by meaning, not confirmed', tech: 'pgvector cosine 0.71 · unconfirmed' },
    { k: 'left',   say: 'Left: suppliers with no contact since 1 March', n: 9, by: 'record', how: '48 − 39', tech: 'set difference' }
  ],
  /* The answer: rows from the record. sure = rests on the record alone. */
  answer: {
    n: 9, of: 48, sureN: 7,
    sure: 'Sure for 7 of 9. Two rest on less: see their notes.',
    rows: [
      { name: 'Linden Grounds', last: '8 Dec 2025', via: 'delivery note', src: 's2', ends: 'Aug 2027' },
      { name: 'Moorside Tyres', last: '27 Jan 2026', via: 'meeting note', src: 's3', ends: 'Mar 2027' },
      { name: 'Fenwick Lifts', last: '2 Feb 2026', via: 'delivery note', src: 's2', ends: 'Jan 2028' },
      { name: 'Tamsin Print & Post', last: '11 Feb 2026', via: 'email', src: 's1', ends: 'Dec 2026', gap: 'Contact person', gapWho: 'jo' },
      { name: 'Coldwell Waste Partners', last: '14 Feb 2026', via: 'email', src: 's1', ends: 'Mar 2027' },
      { name: 'Ridgeway Electrical', last: '19 Feb 2026', via: 'email', src: 's1', ends: 'Jun 2027' },
      { name: 'Easterby Cleaning Co', last: '20 Feb 2026', via: 'email', src: 's1', ends: 'Sep 2027', maybe: { date: '12 Apr 2026', what: 'an email signed “the cleaning crew”', score: 'a likely match by meaning' } },
      { name: 'Pellow Security', last: '25 Feb 2026', via: 'email', src: 's1', ends: 'Feb 2027' },
      { name: 'Carrow IT Supplies', last: null, via: null, ends: 'Nov 2027', noRecord: { before: 'Jan 2026', why: 'Supplier correspondence starts in January 2026' } }
    ],
    /* a few of the 39 heard from since 1 March, for sheets that show what was left out */
    heard: [
      { name: 'Blyth Winter Services', last: '6 May 2026', via: 'meeting note', src: 's3' },
      { name: 'Hallam Haulage Ltd', last: '14 Sep 2026', via: 'delivery note', src: 's2', spell: true },
      { name: 'Northgate Fuels', last: '22 Oct 2026', via: 'email', src: 's1' }
    ],
    axis: { from: '1 Sep 2025', to: '3 Nov 2026' }
  },
  /* What the answer can't see, and who could fill it. kind = one of the six ways to be empty. */
  gaps: [
    { kind: 'shadow', say: 'Invoices are kept on Finance. Some of these 9 may have invoiced since March.', who: 'priya', ask: 'Ask Priya Nair, finance lead' },
    { kind: 'norecord', say: 'No emails before January 2026, so Carrow IT Supplies may never have written.', who: 'jo', ask: 'Jo Reyes can say when Carrow last wrote' },
    { kind: 'gap', say: 'Contact person not known yet for Tamsin Print & Post.', who: 'jo', ask: 'Procurement can add it' }
  ],
  /* The question kept as an object. */
  saved: {
    name: 'Suppliers not heard from since spring',
    by: 'me', saved: '20 Oct 2026', shared: 'ops', reruns: 'every Monday, 07:00, and whenever it’s opened',
    reads: 'the data as it is now; every run is kept, so any run opens as it was',
    modelUsed: 'once, on 20 Oct, to read your words. Reruns use the reading you confirmed and never ask it again.',
    changed: '27 Oct 2026',
    runs: [
      { at: '20 Oct', n: 10, note: 'first asked' },
      { at: '27 Oct', n: 9, note: 'Northgate Fuels emailed on 22 Oct', changed: true },
      { at: '3 Nov', n: 9, note: 'no change' }
    ],
    keeps: ['your words, as typed', 'the reading you confirmed', 'each choice you made', 'the sources and floors it read', 'when each run happened and what it found']
  },
  /* The six parts of a question sheet. never = what each must never claim. */
  parts: [
    { id: 'question', plain: 'Question', tech: 'query text + reading', icon: 'message-circle-question',
      set: 'Your words, verbatim, in quotes. Under them, the reading: the same question in the record’s words.',
      never: 'to be understood before you confirm the reading. Your words are never rewritten in place.' },
    { id: 'clarify', plain: 'Clarification', tech: 'disambiguation', icon: 'split',
      set: 'One neutral question at a time, two to four choices, each with the count it would leave, and “something else”.',
      never: 'a right answer. It never leads, and never asks what the record can answer itself.' },
    { id: 'workings', plain: 'Workings', tech: 'query plan, in plain words', icon: 'list-checks',
      set: 'Numbered steps in the order they ran, each with its count, who did it, and what it left out.',
      never: 'to be complete beyond its sources. Nothing left out goes unsaid.' },
    { id: 'answer', plain: 'Answer', tech: 'result set', icon: 'list',
      set: 'Rows from the record, each with where it came from. A count first, and how sure, in words.',
      never: 'more certainty than its weakest step, or a guess as a fact. Zero is said with what was checked.' },
    { id: 'gap', plain: 'Gap', tech: 'coverage note', icon: 'square-dashed',
      set: 'One of the six ways to be empty, with what it means for this answer and who could fill it.',
      never: '“nothing found” when it means “not looked” or “not yours to see”.' },
    { id: 'saved', plain: 'Saved question', tech: 'stored query + run log', icon: 'bookmark',
      set: 'A name, your words, the confirmed reading, who it’s shared with, when it reruns, when its answer last changed.',
      never: 'that today’s answer is the one it was saved with. It never asks the assistant again.' }
  ],
  /* Who can do a step. */
  actors: {
    me:     { plain: 'You', tech: 'person', icon: 'user' },
    record: { plain: 'Data Atlas', tech: 'query engine · keys, names, spelling', icon: 'database' },
    guess:  { plain: 'The assistant', tech: 'model gateway', icon: 'circle-dashed' },
    glossary: { plain: 'Org glossary', tech: 'deployment config · glossary', icon: 'book-a' }
  }
};
