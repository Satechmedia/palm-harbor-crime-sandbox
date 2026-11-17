// The story of Palm Harbor: Heatwave, as data. Ten missions in order, each a list of steps
// the mission director plays (talk, steal, deliver, collect, destroy, eliminate, lose the
// police), with its cast, dialogue, rewards and the things each step puts into the world.
import { V_ROADS, H_ROADS, QUAY_Y0 } from '../city/layout.js';
import { LOOKS } from '../characters/people.js';
import { createVehicle } from '../vehicles/physics.js';
import { spawnCrew, spawnChaser } from '../ai/gangs.js';
import { spawnPatrolAt } from '../ai/police.js';
import { setWanted } from '../crime/wanted.js';
import { say } from '../game/state.js';

/** The cast. `letter` marks their missions on the map; the rest draws their portrait. */
export const CAST = {
  dez: { name: 'Dez Okoro', color: '#ff5a7a', skin: '#b97a4e', hair: '#16100c', style: 'fade', shirt: '#ff5a7a' },
  tia: { name: 'Tía Bravo', color: '#ffd23f', skin: '#c68a5a', hair: '#8a8a8a', style: 'bun', shirt: '#f5bd4e', letter: 'T' },
  juno: { name: 'Juno Tide', color: '#ff7ad9', skin: '#6e4428', hair: '#ff7ad9', style: 'puffs', shirt: '#36e0d0', shades: true, letter: 'J' },
  mako: { name: 'Mako Reyes', color: '#4de1c1', skin: '#e0a878', hair: '#101018', style: 'long', shirt: '#2b3a55', beard: true, letter: 'M' },
  kite: { name: 'Auntie Kite', color: '#f4d35e', skin: '#9c6540', hair: '#f4f1e8', style: 'bob', shirt: '#374b69', glasses: true, letter: 'K' },
  vex: { name: 'Lucian Vex', color: '#ffb000', skin: '#f2c9a5', hair: '#c9a24a', style: 'slick', shirt: '#f4f1e8', shades: true, letter: 'V' },
  phpd: { name: 'PHPD', color: '#6fa8ff', skin: '#d9a273', hair: '#1c2a47', style: 'cap', shirt: '#2c4a86' },
};

const southOn = (i, y) => [V_ROADS[i].x - 13, y, Math.PI / 2];
const northOn = (i, y) => [V_ROADS[i].x + 13, y, -Math.PI / 2];
const eastOn = (j, x) => [x, H_ROADS[j].y + 13, 0];
const westOn = (j, x) => [x, H_ROADS[j].y - 13, Math.PI];

/** A mission vehicle: tagged so the director can track it, never recycled while the mission runs. */
function missionCar(G, model, at, tag, paint) {
  const v = createVehicle(G, model, at[0], at[1], at[2], paint);
  v.tag = tag;
  v.parked = true;
  return v;
}

function guardedVan(G, at, n) {
  missionCar(G, 'kitevan', at, 'jammer', '#12e0c0');
  spawnCrew(G, at[0] + 30, at[1] + 30, n, 'jammerCrew', 'pistol', LOOKS.eel, 40);
}

export const MISSIONS = [
  {
    id: 'fresh_out', title: 'Fresh Out', giver: 'tia', place: 'garage', reward: 400, xp: 150, gift: ['pistol', 36],
    blurb: 'Three years inside. One favour to start over.',
    steps: [
      { type: 'talk', lines: [['tia', 'Dez Okoro. Three years, and you walk in like you only went for cigarettes.'], ['dez', 'They let me out early, Tía. Good behaviour.'], ['tia', 'Ha. Lucian Vex wants my garage and the bank wants my blood. I need a car on the lift by sundown.'], ['tia', 'Red Marlin GT, parked on Coral Boulevard. The owner will not miss it until brunch.']] },
      { type: 'enter', tag: 'marlin', text: 'Steal the red ~Marlin GT~ on Coral Boulevard', setup: (G) => missionCar(G, 'marlin', southOn(0, 1180), 'marlin', '#e2374d'), cap: 1 },
      { type: 'deliver', tag: 'marlin', at: 'garage', text: 'Drive the Marlin to ~Bravo Motors~', cap: 1, setup: (G) => say(G, 'dez', 'Still got it.') },
      { type: 'talk', lines: [['tia', 'Not a scratch. Maybe prison was good for you.'], ['tia', 'Take this. Palm Harbor got meaner while you were gone.']] },
    ],
  },
  {
    id: 'heat_check', title: 'Heat Check', giver: 'tia', place: 'garage', reward: 500, xp: 180,
    blurb: 'The Marlin was hotter than it looked.',
    steps: [
      { type: 'talk', lines: [['tia', 'Bad news. That Marlin belongs to a PHPD captain. They ran my plates off a traffic camera.'], ['dez', 'So I lead them away from here.'], ['tia', 'And lose them. Stay out of sight, or pay for a respray at Fresh Coat on Flamingo.']] },
      { type: 'lose', text: 'Lose the ~police~: break their line of sight, or respray at ~Fresh Coat~', hint: 'spray', setup: (G) => { setWanted(G, 2); const p = G.player; spawnPatrolAt(G, p.x + 260, p.y + 40, Math.PI); spawnPatrolAt(G, p.x - 300, p.y - 30, 0); } },
      { type: 'goto', at: 'safehouse', text: 'Lie low at the ~Seabreeze Motel~', setup: (G) => say(G, 'tia', 'Clean. Go sleep at the Seabreeze, room is paid up. You can save there.') },
    ],
  },
  {
    id: 'loud_and_clear', title: 'Loud and Clear', giver: 'juno', place: 'records', reward: 700, xp: 220,
    blurb: 'A pirate radio station needs its speakers back.',
    steps: [
      { type: 'talk', lines: [['juno', 'You are Tía\'s wheelman? Juno Tide. Tiki FM, the only station in town Vex does not own.'], ['juno', 'My pier party is tonight and my speaker stacks are scattered across three venues.'], ['dez', 'You want a roadie.'], ['juno', 'I want a roadie who drives like the rent is due. Take my van.']] },
      { type: 'enter', tag: 'soundvan', text: 'Get in Juno\'s ~sound van~', setup: (G) => missionCar(G, 'kitevan', eastOn(5, 1380), 'soundvan', '#ff7ad9') },
      { type: 'collect', tag: 'soundvan', timer: 170, text: 'Collect the ~speaker stacks~ before the party starts', points: [[1725, 1013], [2437, 1337], [1213, 800]], label: 'Speakers' },
      { type: 'deliver', tag: 'soundvan', at: [700, 1700], text: 'Deliver the van to the ~Heron Pier~', timer: 80 },
      { type: 'talk', lines: [['juno', 'Hear that? That is the sound of Lucian Vex losing a market share.'], ['juno', 'Come back tomorrow. His Neon Eels are going to hate this.']] },
    ],
  },
  {
    id: 'bad_reception', title: 'Bad Reception', giver: 'juno', place: 'records', reward: 900, xp: 260, gift: ['smg', 90],
    blurb: 'Someone is jamming Tiki FM. Unjam it, loudly.',
    steps: [
      { type: 'talk', lines: [['juno', 'Static. All night, nothing but static. The Eels parked three jammer vans around Meridian.'], ['dez', 'Teal vans, guys in teal standing around them?'], ['juno', 'Subtle, they are not. Wreck the vans. Brassworks Arms sells anything you are missing.']] },
      { type: 'destroy', tag: 'jammer', text: 'Destroy the three ~jammer vans~', label: 'Jammer', setup: (G) => { guardedVan(G, eastOn(3, 2080), 2); guardedVan(G, southOn(4, 1500), 2); guardedVan(G, westOn(5, 2780), 3); } },
      { type: 'lose', text: 'Lose the ~police~', setup: (G) => { setWanted(G, 2); say(G, 'juno', 'We are back on air! Now get out of there, the whole precinct heard that.'); } },
      { type: 'talk', lines: [['juno', 'Crystal clear from the pier to the port. You have friends at the docks now, Dez. Ask for Mako.']] },
    ],
  },
  {
    id: 'cold_chain', title: 'Cold Chain', giver: 'mako', place: 'coldstore', reward: 1200, xp: 300,
    blurb: 'A truck of "shrimp" has to reach the market in one piece.',
    steps: [
      { type: 'talk', lines: [['mako', 'Juno says you can drive. Can you drive slow? Because this reefer is full of something that hates potholes.'], ['dez', 'What is in it?'], ['mako', 'Shrimp. Very expensive, very illegal shrimp. Plaza Marisol, north side. The Eels want it more than I do.']] },
      { type: 'enter', tag: 'reefer', text: 'Get in the ~Glacier Reefer~', setup: (G) => missionCar(G, 'reefer', westOn(9, 3125), 'reefer', '#e8edf0') },
      { type: 'deliver', tag: 'reefer', at: [2425, 663], r: 50, text: 'Deliver the truck to ~Plaza Marisol~. Keep it alive!', health: 'reefer',
        tick: (G, S) => {
          const p = G.player;
          if (!S.data.wave1 && p.y < 3000) { S.data.wave1 = true; spawnChaser(G, p.x + 420, p.y - 60, 'brava', 'eelcar', '#12e0c0'); spawnChaser(G, p.x - 420, p.y + 30, 'calypso', 'eelcar', '#12e0c0'); say(G, 'mako', 'Teal cars on your tail. Do not let them open that box!'); }
          if (!S.data.wave2 && p.y < 1800) { S.data.wave2 = true; spawnChaser(G, p.x + 380, p.y - 300, 'tortuga', 'eelcar', '#12e0c0'); spawnChaser(G, p.x - 300, p.y - 380, 'brava', 'eelcar', '#12e0c0'); }
        } },
      { type: 'talk', lines: [['mako', 'Every tail intact. The shrimp, I mean.'], ['mako', 'Vex is squeezing the whole port. Come see how we squeeze back.']] },
    ],
  },
  {
    id: 'harbor_lights', title: 'Harbor Lights', giver: 'mako', place: 'coldstore', reward: 1500, xp: 340, gift: ['shotgun', 24],
    blurb: 'The Eels keep their books on the quay. Go read them.',
    steps: [
      { type: 'talk', lines: [['mako', 'The Eels run Vex\'s money through a container yard on the quay, under crane three.'], ['mako', 'Their ledger names every cop and councilman on his payroll.'], ['dez', 'And they are going to hand it over?'], ['mako', 'Take the Boomer. Ask firmly.']] },
      { type: 'kill', tag: 'yard', text: 'Clear the ~Neon Eels~ from the quay', label: 'Eel', setup: (G) => { spawnCrew(G, 3200, QUAY_Y0 + 70, 5, 'yard', 'pistol', LOOKS.eel, 90); spawnCrew(G, 3420, QUAY_Y0 + 60, 3, 'yard', 'smg', LOOKS.eel, 60); spawnCrew(G, 2980, QUAY_Y0 + 80, 2, 'yard', 'shotgun', LOOKS.eel, 40); } },
      { type: 'collect', text: 'Grab the ~ledger~', points: [[3210, QUAY_Y0 + 96]], label: 'Ledger', onFoot: true },
      { type: 'goto', at: 'coldstore', text: 'Bring the ledger to ~Pier 9~', setup: (G) => { setWanted(G, 2); say(G, 'dez', 'Half of City Hall is in here.'); } },
      { type: 'talk', lines: [['mako', 'Look at that. Judge, harbour master, two captains. And one name I know you know.'], ['dez', 'Vex set up the Pelican job. He handed me to the cops himself.'], ['mako', 'Auntie Kite moves every parcel in this city. She will know where he keeps his cash.']] },
    ],
  },
  {
    id: 'special_delivery', title: 'Special Delivery', giver: 'kite', place: 'depot', reward: 1600, xp: 360,
    blurb: 'Five parcels, one van, no questions.',
    steps: [
      { type: 'talk', lines: [['kite', 'Information is a parcel like any other, young man. It has a price and a delivery window.'], ['kite', 'Run my afternoon route through Flamingo Heights. On time. Then we talk about Lucian.'], ['dez', 'And if somebody objects?'], ['kite', 'Then the parcels arrive with dents. I dislike dents.']] },
      { type: 'enter', tag: 'route', text: 'Take the ~Kite Van~', setup: (G) => missionCar(G, 'kitevan', eastOn(8, 4250), 'route', '#f4d35e') },
      { type: 'collect', tag: 'route', timer: 210, text: 'Deliver the ~parcels~ across Flamingo Heights', label: 'Drop', points: [[4513, 2500], [4913, 1900], [4300, 1363], [3713, 1100], [4700, 663]],
        tick: (G, S) => { if (!S.data.ambush && S.data.left <= 2) { S.data.ambush = true; const p = G.player; spawnChaser(G, p.x + 400, p.y + 80, 'brava', 'eelcar', '#12e0c0'); spawnChaser(G, p.x - 380, p.y - 120, 'tortuga', 'eelcar', '#12e0c0'); say(G, 'kite', 'The Eels have noticed my van. Dents, Mr Okoro. Remember the dents.'); } } },
      { type: 'goto', at: 'depot', text: 'Return to the ~Kite Parcel Depot~' },
      { type: 'talk', lines: [['kite', 'Punctual. Every Friday the Gilded Pelican sends its takings to the bank in an armoured van, the Vault.'], ['kite', 'It circles Meridian until the bank opens its dock. Today is Friday.']] },
    ],
  },
  {
    id: 'house_edge', title: 'House Edge', giver: 'kite', place: 'depot', reward: 4000, xp: 420, gift: ['rifle', 90],
    blurb: 'The casino always wins. Not this Friday.',
    steps: [
      { type: 'talk', lines: [['kite', 'The Vault is slow, heavy and proud. Ram it, shoot it, make it give up.'], ['dez', 'Three years ago I drove the getaway for this exact job.'], ['kite', 'Then you know the ending you do not want.']] },
      { type: 'destroy', tag: 'vault', text: 'Stop the ~Pelican Vault~ armoured van', label: 'Vault', setup: (G) => {
        const v = missionCar(G, 'vault', eastOn(4, 2700), 'vault', '#3c4a3f');
        v.driver = 'ai'; v.parked = false;
        v.ai = { type: 'runner', leg: 0, speed: 250, loop: true, route: [[3287, 1713], [3313, 2037], [2613, 2063], [2587, 1713]] };
        setWanted(G, 1);
      } },
      { type: 'collect', text: 'Grab the ~cash bags~', label: 'Cash', onFoot: true, dropAt: 'vault', count: 4, setup: (G) => { setWanted(G, 3); say(G, 'dez', 'That is three years of interest, Lucian.'); } },
      { type: 'lose', text: 'Lose the ~police~' },
      { type: 'talk', lines: [['kite', 'A tidy sum. Lucian has locked himself in his villa on Sunrise Parkway with his new toy, an Aurelia V.'], ['kite', 'I do hope nothing happens to it.']] },
    ],
  },
  {
    id: 'vex_appeal', title: 'Vex Appeal', giver: 'tia', place: 'garage', reward: 3000, xp: 480,
    blurb: 'Take the one thing Lucian Vex loves.',
    steps: [
      { type: 'talk', lines: [['tia', 'Vex sent a man with papers today. He owns my loan now. He owns my garage by Monday.'], ['dez', 'Then we own his car by tonight.'], ['tia', 'Bring that Aurelia here, mijo, and I will make it disappear so well he will doubt he ever had one.']] },
      { type: 'goto', at: 'villa', r: 70, text: 'Go to ~Villa Vex~ in Flamingo Heights', setup: (G) => { const v = G.city.places.villa; spawnCrew(G, v.x, v.y, 5, 'villa', 'smg', LOOKS.guard, 70); spawnCrew(G, v.x - 60, v.y + 30, 3, 'villa', 'shotgun', LOOKS.guard, 40); missionCar(G, 'aurelia', [v.x + 20, v.y, 0], 'aurelia', '#ff2f8e'); } },
      { type: 'kill', tag: 'villa', text: 'Take out Vex\'s ~guards~', label: 'Guard' },
      { type: 'enter', tag: 'aurelia', text: 'Steal the ~Aurelia V~', setup: (G) => say(G, 'vex', 'Okoro! Touch that car and you will not see Monday!', 4) },
      { type: 'lose', tag: 'aurelia', text: 'Lose the ~police~. Do not wreck the Aurelia!', health: 'aurelia', setup: (G) => setWanted(G, 4) },
      { type: 'deliver', tag: 'aurelia', at: 'garage', text: 'Deliver the Aurelia to ~Bravo Motors~', health: 'aurelia' },
      { type: 'talk', lines: [['tia', 'Dios mío. It purrs.'], ['tia', 'He will run now. Men like Lucian always keep a boat.']] },
    ],
  },
  {
    id: 'heatwave', title: 'Heatwave', giver: 'tia', place: 'garage', reward: 10000, xp: 800, gift: ['launcher', 4],
    blurb: 'Lucian Vex is leaving town. Do not let him.',
    steps: [
      { type: 'talk', lines: [['tia', 'Mako called. Vex is loading a freighter at Port Calypso. He leaves the Pelican in ten minutes with every dollar he has.'], ['dez', 'He put me away for three years, Tía.'], ['tia', 'Then go and collect. And take the Hammerhead. I was saving it for a special occasion.']] },
      { type: 'destroy', tag: 'vex', text: 'Stop ~Vex\'s convoy~ before it reaches the freighter', label: 'Vex', fail: (G) => (G.vehicles.find((v) => v.tag === 'vex' && v.ai?.type === 'runner' && v.ai.leg >= v.ai.route.length) ? 'Vex reached his freighter.' : null),
        setup: (G) => {
          const v = missionCar(G, 'tortuga', southOn(5, 2100), 'vex', '#16161c');
          v.driver = 'ai'; v.parked = false; v.hp = v.maxHp = 380;
          v.ai = { type: 'runner', leg: 0, speed: 300, route: [[2587, 2737], [2587, 3137], [2587, 3837], [3600, 3863], [3600, QUAY_Y0 + 60]] };
          spawnChaser(G, 2587, 2000, 'brava', 'escort', '#16161c', LOOKS.guard);
          spawnChaser(G, 2613, 2200, 'tortuga', 'escort', '#16161c', LOOKS.guard);
          say(G, 'vex', 'You are a driver, Okoro. Drivers do not get a seat at the table.', 5);
        } },
      { type: 'kill', tag: 'last', text: 'Finish it: ~Lucian Vex~ and his last guards', label: 'Vex', setup: (G) => {
        const w = G.vehicles.find((v) => v.tag === 'vex') ?? G.player;
        const crew = spawnCrew(G, w.x + 30, w.y + 30, 4, 'last', 'smg', LOOKS.guard, 60);
        const boss = spawnCrew(G, w.x - 20, w.y - 26, 1, 'last', 'rifle', { ...LOOKS.guard, shirt: '#f4f1e8', stripe: '#ffb000', hair: '#c9a24a' })[0];
        boss.hp = boss.maxHp = 220; boss.boss = true; void crew;
        setWanted(G, 3);
      } },
      { type: 'lose', text: 'Lose the ~police~ one last time' },
      { type: 'talk', lines: [['tia', 'The bank called. Somebody paid off my loan. In cash. In casino wrappers.'], ['dez', 'Imagine that.'], ['juno', 'Tiki FM dedicates this one to the new management of Palm Harbor. Stay sunny.']] },
    ],
  },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id);
