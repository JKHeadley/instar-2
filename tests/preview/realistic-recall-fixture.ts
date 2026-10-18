import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conclusionText, parseModelJson } from './model-json.js';

/** A fixed, fictional operator diary. Each scene supplies ten accepted turns. */
export interface RecallScene {
  id: string;
  topic: 'errand' | 'family' | 'work' | 'date';
  fact: string;
  answer: string;
  questions: readonly [string, string];
  aside: readonly [string, string, string];
  old?: string;
  forget?: boolean;
}

export const scenes: readonly RecallScene[] = [
  { id: 'grocer', topic: 'errand', fact: 'The grocery pickup window is 18:10.', old: 'The grocery pickup window is 17:40.', answer: 'The grocery pickup window is 18:10.', questions: ['When is the grocery pickup window?', 'What time did I arrange for the groceries?'], aside: ['The curbside sign was hidden behind the garden display.', 'I need bananas, oats, and the good olive oil.', 'If the bags leak again I will bring the blue crate.'] },
  { id: 'mira-school', topic: 'family', fact: 'Mira school pickup is at the west gate.', answer: 'Mira school pickup is at the west gate.', questions: ['Which gate is Mira school pickup at?', 'Where do I get her after class?'], aside: ['She has the purple raincoat in her backpack.', 'The school sent another form about the field trip.', 'I can sign that after dinner.'] },
  { id: 'atlas-demo', topic: 'work', fact: 'The Atlas demo starts at 14:30.', answer: 'The Atlas demo starts at 14:30.', questions: ['When does the Atlas demo start?', 'What time is that product walkthrough?'], aside: ['Nadia wants the failure case shown first.', 'The staging login worked after the cache cleared.', 'I should avoid promising the export button this week.'] },
  { id: 'dentist', topic: 'date', fact: 'The dentist appointment is on 2026-10-08 at 09:00.', old: 'The dentist appointment is on 2026-10-08 at 08:30.', answer: 'The dentist appointment is on 2026-10-08 at 09:00.', questions: ['When is my dentist appointment?', 'What date and time is the teeth appointment?'], aside: ['They left a voicemail while I was on the train.', 'I need to bring the insurance card.', 'Please keep the morning clear.'] },
  { id: 'parcel', topic: 'errand', fact: 'The parcel return label is in the kitchen drawer.', answer: 'UNKNOWN', forget: true, questions: ['Where is the parcel return label?', 'Where did I put the shipping slip?'], aside: ['The box still needs tape.', 'The queue at the post office was absurd yesterday.', 'I can drop it after the school run.'] },
  { id: 'eli-birthday', topic: 'family', fact: 'Eli birthday dinner is at Juniper House.', answer: 'Eli birthday dinner is at Juniper House.', questions: ['Where is Eli birthday dinner?', 'Which restaurant did we pick for him?'], aside: ['He wants a quiet table, obviously.', 'The chocolate cake is already ordered.', 'I told his sister the start time.'] },
  { id: 'beacon-budget', topic: 'work', fact: 'The Beacon pilot budget is 8400 dollars.', old: 'The Beacon pilot budget is 7800 dollars.', answer: 'The Beacon pilot budget is 8400 dollars.', questions: ['What is the Beacon pilot budget?', 'How much did we allow for that trial project?'], aside: ['Finance wants the hardware line separated.', 'Ravi can review the estimate tomorrow.', 'The vendor quote has freight buried in it.'] },
  { id: 'vet', topic: 'date', fact: 'The vet visit for Poppy is on 2026-10-13 at 16:20.', answer: 'The vet visit for Poppy is on 2026-10-13 at 16:20.', questions: ['When is Poppy vet visit?', 'When does she see the animal doctor?'], aside: ['She hid when I opened the carrier.', 'Her food is in the tall cupboard.', 'The clinic asked for a stool sample.'] },
  { id: 'laundry', topic: 'errand', fact: 'The dry cleaning ticket is 7316.', answer: 'The dry cleaning ticket is 7316.', questions: ['What is the dry cleaning ticket number?', 'Which number is on the cleaner receipt?'], aside: ['They still have the navy jacket.', 'I will not drive across town for one shirt.', 'The counter closes earlier on Saturdays.'] },
  { id: 'sam-lunch', topic: 'family', fact: 'Sam lunch allergy is sesame.', answer: 'Sam lunch allergy is sesame.', questions: ['What is Sam lunch allergy?', 'What ingredient should I keep out of his lunch?'], aside: ['The lunchbox lid went missing again.', 'He likes apples sliced thin.', 'The teacher said no shared snacks.'] },
  { id: 'delta-review', topic: 'work', fact: 'The Delta review owner is Priya.', old: 'The Delta review owner is Nadia.', answer: 'The Delta review owner is Priya.', questions: ['Who owns the Delta review?', 'Who is handling that design signoff?'], aside: ['The spec still says beta in two places.', 'I sent her the chart with the new labels.', 'We can cut the old screenshot.'] },
  { id: 'concert', topic: 'date', fact: 'The concert doors open on 2026-11-06 at 19:00.', answer: 'The concert doors open on 2026-11-06 at 19:00.', questions: ['When do the concert doors open?', 'What is the entry time for the show?'], aside: ['The seats are in the balcony.', 'I should check the train home.', 'No, I am not buying another tour shirt.'] },
  { id: 'pharmacy', topic: 'errand', fact: 'The pharmacy refill number is RX-4821.', answer: 'The pharmacy refill number is RX-4821.', questions: ['What is the pharmacy refill number?', 'Which code do I give the chemist?'], aside: ['The automated phone menu hung up twice.', 'I can collect it with groceries.', 'The bottle is almost empty.'] },
  { id: 'aunt-address', topic: 'family', fact: 'Aunt Lena apartment is number 406.', answer: 'Aunt Lena apartment is number 406.', questions: ['What apartment is Aunt Lena in?', 'Which unit do I buzz for her?'], aside: ['The elevator is slow but still working.', 'She asked for the lemon biscuits.', 'I can visit Sunday afternoon.'] },
  { id: 'orion-freeze', topic: 'work', fact: 'The Orion release freeze is on 2026-10-21.', answer: 'The Orion release freeze is on 2026-10-21.', questions: ['When is the Orion release freeze?', 'What day do changes stop for that launch?'], aside: ['QA needs the mobile build first.', 'We found one more translation gap.', 'I want a rollback note in the runbook.'] },
  { id: 'train', topic: 'date', fact: 'The Portland train leaves on 2026-10-17 at 07:45.', old: 'The Portland train leaves on 2026-10-17 at 07:15.', answer: 'The Portland train leaves on 2026-10-17 at 07:45.', questions: ['When does the Portland train leave?', 'What time is my departure north?'], aside: ['Platform information comes late here.', 'I will pack the small suitcase.', 'The hotel has the reservation under my surname.'] },
  { id: 'car', topic: 'errand', fact: 'The car service estimate is 620 dollars.', answer: 'The car service estimate is 620 dollars.', questions: ['What is the car service estimate?', 'How much did the mechanic quote?'], aside: ['The squeak is louder on cold mornings.', 'They need the keys by eight.', 'I can walk home from the garage.'] },
  { id: 'mira-recital', topic: 'family', fact: 'Mira recital seat is row H seat 12.', answer: 'Mira recital seat is row H seat 12.', questions: ['What is my seat for Mira recital?', 'Where am I sitting to watch her perform?'], aside: ['She says she is not nervous, sure.', 'The piano teacher wants them there early.', 'I will bring flowers after the show.'] },
  { id: 'api-threshold', topic: 'work', fact: 'The API alert threshold is 240 milliseconds.', answer: 'The API alert threshold is 240 milliseconds.', questions: ['What is the API alert threshold?', 'At what latency does that service page us?'], aside: ['The dashboard line is jagged after noon.', 'Mateo is checking the regional split.', 'Do not change paging during the demo.'] },
  { id: 'tax', topic: 'date', fact: 'The tax paperwork deadline is 2026-10-30.', answer: 'The tax paperwork deadline is 2026-10-30.', questions: ['When is the tax paperwork deadline?', 'What date do the accountant documents need to be in?'], aside: ['I found last year folder.', 'The donation receipts are in email.', 'I would rather do this in one sitting.'] },
  { id: 'library', topic: 'errand', fact: 'The library hold code is LBR-903.', answer: 'UNKNOWN', forget: true, questions: ['What is the library hold code?', 'Which code collects the reserved book?'], aside: ['The book is about urban trees.', 'The checkout machine was broken last visit.', 'I can go while Mira is at practice.'] },
  { id: 'sam-camp', topic: 'family', fact: 'Sam camp deposit is 175 dollars.', answer: 'Sam camp deposit is 175 dollars.', questions: ['How much is Sam camp deposit?', 'What amount do I owe for his summer place?'], aside: ['He is excited about the climbing wall.', 'The form asks for two contacts.', 'We should check the cancellation terms.'] },
  { id: 'helix-owner', topic: 'work', fact: 'The Helix incident owner is Jordan.', answer: 'The Helix incident owner is Jordan.', questions: ['Who owns the Helix incident?', 'Who is writing that outage review?'], aside: ['The timeline still has a blank at 11:08.', 'Logs show the retry storm clearly.', 'The postmortem should avoid blame.'] },
  { id: 'passport', topic: 'date', fact: 'The passport appointment is on 2026-11-12 at 10:15.', answer: 'The passport appointment is on 2026-11-12 at 10:15.', questions: ['When is the passport appointment?', 'What date is my document office visit?'], aside: ['The photos look terrible but meet the rules.', 'I printed the application.', 'The office is across from the station.'] },
  { id: 'plants', topic: 'errand', fact: 'The garden hose connector size is 19 millimeters.', answer: 'The garden hose connector size is 19 millimeters.', questions: ['What size is the garden hose connector?', 'Which fitting do I need for the watering hose?'], aside: ['The old one drips at the tap.', 'The tomatoes still need watering.', 'I will compare the threads at the shop.'] },
  { id: 'lena-flight', topic: 'family', fact: 'Aunt Lena flight lands at terminal 2.', answer: 'Aunt Lena flight lands at terminal 2.', questions: ['Which terminal does Aunt Lena flight use?', 'Where should I meet her at the airport?'], aside: ['She has only a carry-on.', 'Traffic at arrivals was awful last time.', 'I can text when I park.'] },
  { id: 'quartz-code', topic: 'work', fact: 'The Quartz staging PIN is 5382.', answer: 'The Quartz staging PIN is 5382.', questions: ['What is the Quartz staging PIN?', 'Which number unlocks that test room?'], aside: ['The lab door sticks in damp weather.', 'I told Dana to use the visitor entrance.', 'We should rotate the code after the pilot.'] },
  { id: 'museum', topic: 'date', fact: 'The museum tour meets on 2026-11-21 at 11:30.', answer: 'The museum tour meets on 2026-11-21 at 11:30.', questions: ['When does the museum tour meet?', 'What time is that gallery visit?'], aside: ['Tickets are in my wallet app.', 'Eli wants the fossil room first.', 'The cafe menu is probably overpriced.'] },
  { id: 'bike', topic: 'errand', fact: 'The bike lock key is in the green pouch.', answer: 'The bike lock key is in the green pouch.', questions: ['Where is the bike lock key?', 'Where did I stash the cycle key?'], aside: ['The rear tire feels soft.', 'I can ride to the market if it stays dry.', 'The rack by the station is usually full.'] },
  { id: 'family-photo', topic: 'family', fact: 'The family photo photographer is Jules.', answer: 'The family photo photographer is Jules.', questions: ['Who is the family photo photographer?', 'Who did we book to take our pictures?'], aside: ['Mira refuses the matching sweaters.', 'The park light is best in the late afternoon.', 'I will ask Jules about rain plans.'] },
];

const transitions = [
  'I need to get through these small things before the afternoon call.',
  'Hold on, I just remembered another detail from earlier.',
  'Anyway, back to the list on the fridge.',
  'That is probably enough planning for today.',
  'The calendar is getting crowded again.',
  'Please keep the latest version in mind.',
] as const;

/** Exactly 300 varied operator turns, alternating topics and revisiting them later. */
export function conversation(): string[] {
  const turns: string[] = [];
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index]!;
    const other = scenes[(index + 7) % scenes.length]!;
    turns.push(scene.old ?? scene.fact);
    turns.push(`Speaking of the ${other.topic} list, ${other.aside[index % 3]!}`);
    turns.push(`I keep circling back to this: ${scene.aside[1]}`);
    turns.push(scene.aside[0]);
    turns.push(`${transitions[index % transitions.length]!} ${scene.aside[2]}`);
    turns.push(`Also, ${other.aside[(index + 1) % 3]!} ${scene.aside[0]}`);
    turns.push(scene.aside[1]);
    turns.push(scene.old ? `Actually, ${scene.fact}` : scene.forget ? `Forget ${scene.fact}` : scene.aside[2]);
    turns.push(`Meanwhile, ${other.aside[(index + 2) % 3]!} ${scene.aside[1]}`);
    turns.push(`Okay, ${scene.aside[2]}`);
  }
  return turns;
}

/** The recall miss proof room two recorded on 2026-10-02 (unit w3-recallrank): a stated fact, and a question about
 * it that shares no word with it. A stub writer whose terms repeat the question's words would hide this miss, so
 * the fact gets no generated terms here and the search words are the real answer model's own, verbatim, from
 * fixtures/proofroom2-recallrank-2026-10-02.json (lookupSamples P4), decoded the way the runner decodes an answer. */
export function recordedParaphrase(): { fact: string; question: string; lookupAnswer: string; after: readonly string[] } {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/proofroom2-recallrank-2026-10-02.json'), 'utf8')) as {
    recorded: { fact: { message: string }; question: { message: string } };
    lookupSamples: { samples: { label: string; calls: { raw: string }[] }[] } };
  const parsed = parseModelJson(fixture.lookupSamples.samples.find(item => item.label === 'P4')!.calls[0]!.raw);
  const lookupAnswer = parsed.ok ? conclusionText((parsed.value.conclusion as { value?: unknown }).value) : null;
  if (lookupAnswer === null) throw Error('realistic recall: recorded lookup answer is not a Decision');
  return { fact: fixture.recorded.fact.message, question: fixture.recorded.question.message, lookupAnswer,
    after: ['The hose reel finally stopped leaking.', 'I moved the seed trays off the windowsill.', 'Nothing else from the yard today.'] };
}
