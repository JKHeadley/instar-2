// A small, hand-written cross-session corpus for retrieval-quality checks. Each query names
// the messageIds a human reader would expect recall to surface.
export const corpus: readonly { id: string; conversation: string; session: string; speaker: string; text: string }[] = [
  { id: 'c1', conversation: 'telegram:1:10', session: 's1', speaker: 'Justin', text: 'The staging deploy failed because the database migration timed out.' },
  { id: 'c2', conversation: 'telegram:1:10', session: 's1', speaker: 'Echo', text: 'I raised the migration timeout to ten minutes and redeployed staging.' },
  { id: 'c3', conversation: 'telegram:1:11', session: 's2', speaker: 'Justin', text: 'My daughter Maya has a piano recital next Thursday evening.' },
  { id: 'c4', conversation: 'telegram:1:11', session: 's2', speaker: 'Justin', text: 'Please never schedule calls before 9am Pacific.' },
  { id: 'c5', conversation: 'telegram:1:12', session: 's3', speaker: 'Sarah', text: 'The Q3 marketing budget is capped at forty thousand dollars.' },
  { id: 'c6', conversation: 'telegram:1:12', session: 's3', speaker: 'Echo', text: 'Noted: Q3 marketing spend stays under the cap Sarah set.' },
  { id: 'c7', conversation: 'telegram:1:13', session: 's4', speaker: 'Justin', text: 'Use the blue logo variant on the landing page, not the green one.' },
  { id: 'c8', conversation: 'telegram:1:13', session: 's4', speaker: 'Justin', text: 'The lighthouse photo should be the hero image.' },
  { id: 'c9', conversation: 'telegram:1:14', session: 's5', speaker: 'Dawn', text: 'Threadline relay keys rotate every thirty days.' },
  { id: 'c10', conversation: 'telegram:1:14', session: 's5', speaker: 'Justin', text: 'I prefer short status updates with the action first.' },
  { id: 'c11', conversation: 'telegram:1:15', session: 's6', speaker: 'Justin', text: 'We are switching the invoice provider from Stripe to Paddle next month.' },
  { id: 'c12', conversation: 'telegram:1:15', session: 's6', speaker: 'Echo', text: 'I will migrate the invoicing webhooks once Paddle credentials arrive.' },
  { id: 'c13', conversation: 'telegram:1:16', session: 's7', speaker: 'Justin', text: 'The laptop battery is failing; plan to replace it in October.' },
  { id: 'c14', conversation: 'telegram:1:16', session: 's7', speaker: 'Justin', text: 'Mac Mini is the always-on machine, the laptop travels with me.' },
  { id: 'c15', conversation: 'telegram:1:17', session: 's8', speaker: 'Sarah', text: 'Our dog Biscuit is allergic to chicken.' },
  { id: 'c16', conversation: 'telegram:1:17', session: 's8', speaker: 'Justin', text: 'Book the flight to Lisbon for the conference on the twelfth.' },
];
/** Lexically answerable queries: shared stems with the source exchange. */
export const lexicalQueries: readonly { query: string; expect: readonly string[] }[] = [
  { query: 'why did the staging deploy fail?', expect: ['c1'] },
  { query: 'what did we do about the migration timeout', expect: ['c2', 'c1'] },
  { query: "when is Maya's recital", expect: ['c3'] },
  { query: 'can I schedule a call at 8am', expect: ['c4'] },
  { query: 'what is the marketing budget cap for Q3', expect: ['c5', 'c6'] },
  { query: 'which logo variant for the landing page', expect: ['c7'] },
  { query: 'hero image', expect: ['c8'] },
  { query: 'how often do relay keys rotate', expect: ['c9'] },
  { query: 'how should status updates look', expect: ['c10'] },
  { query: 'which invoice provider are we moving to', expect: ['c11'] },
  { query: 'Paddle webhooks', expect: ['c12'] },
  { query: 'replace laptop battery', expect: ['c13'] },
  { query: 'what is Biscuit allergic to', expect: ['c15'] },
  { query: 'flight to Lisbon', expect: ['c16'] },
];
/** Paraphrases sharing no content stem with their source: lexical recall cannot find them. */
export const paraphraseQueries: readonly { query: string; expect: string }[] = [
  { query: 'is there a kid performance coming up', expect: 'c3' },
  { query: 'what food should the pet avoid', expect: 'c15' },
  { query: 'which computer stays home', expect: 'c14' },
];
/** Deterministic concept table standing in for a model reranker in tests only. */
export const testConcepts: Readonly<Record<string, readonly string[]>> = {
  kid: ['daughter'], performance: ['recital'], pet: ['dog'], food: ['chicken', 'allergic'], avoid: ['allergic'],
  computer: ['mac', 'mini', 'machine'], home: ['always-on', 'always'],
};
