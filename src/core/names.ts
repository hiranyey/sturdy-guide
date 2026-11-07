// Hero names for character creation: short and punchy, flowing and elvish,
// northern and stony, and a good number of long, grand ones with family names
// and homelands. All original; none borrowed from existing stories.
import { pick, rand, type Rand } from './rng';

/** Longest name the creation screen accepts. */
export const MAX_NAME = 30;

export const HERO_NAMES: readonly string[] = [
  // short and punchy
  'Kael', 'Bryn', 'Tamsin', 'Oren', 'Wren', 'Ilsa', 'Corrin', 'Maelis', 'Ansel', 'Rook',
  'Sabel', 'Doran', 'Vesna', 'Thane', 'Ysolt', 'Fen', 'Liora', 'Garrick', 'Neve', 'Hale',
  'Isra', 'Bram', 'Odile', 'Caspian', 'Marek', 'Senna', 'Joss', 'Elka', 'Torin', 'Avel',
  'Quill', 'Rhea', 'Soren', 'Tilde', 'Varo', 'Wynn', 'Zarya', 'Lorcan', 'Ember', 'Cato',
  // flowing, elvish
  'Aelwen', 'Thalindra', 'Caelir', 'Elowyn', 'Sylvaris', 'Ithrael', 'Aerendil', 'Nimriel', 'Valanthe', 'Lirwen',
  'Faelar', 'Saelwyn', 'Elidyr', 'Aranthe', 'Merethiel', 'Ilyndra', 'Thessaly', 'Calenwe', 'Oriane', 'Seluvael',
  'Ithilwen', 'Amarys', 'Elarion', 'Velisande', 'Yseult', 'Anwyn', 'Celyndra', 'Liriel', 'Taelyn', 'Silvaine',
  // northern, stony, dwarvish
  'Brannoc', 'Hrothmar', 'Sigrun', 'Torvald', 'Astrid', 'Ulfrida', 'Kjelda', 'Bjornar', 'Runa', 'Halvard',
  'Dagmar', 'Thorgrim', 'Eydis', 'Gunnhild', 'Orrik', 'Brunhild', 'Durgan', 'Helka', 'Skarde', 'Vigdis',
  'Grimbald', 'Ingvild', 'Korrin Stonehand', 'Thrand Ashbeard', 'Morda Ironvein', 'Brokk Deepdelve', 'Hilde Hammerfall',
  // old-world, courtly
  'Aldous', 'Rosamund', 'Percival', 'Isolde', 'Leofric', 'Gwendolyn', 'Edric', 'Cordelia', 'Tristan', 'Melisande',
  'Osric', 'Beatrix', 'Godric', 'Evangeline', 'Ambrose', 'Rowena', 'Benedict', 'Ottilie', 'Florian', 'Guinevra',
  'Lucan', 'Maud', 'Raoul', 'Clemence', 'Bertrand', 'Ysabeau', 'Gawen', 'Aveline', 'Roderick', 'Elspeth',
  // wild, strange, fey
  'Moth', 'Briar', 'Thistle', 'Sorrel', 'Hollin', 'Ashling', 'Corvin', 'Morrow', 'Juniper', 'Sable',
  'Tansy', 'Rue', 'Kestrel', 'Bramblewick', 'Fennimore', 'Wisp', 'Lark', 'Nettle', 'Hob', 'Vesper',
  // desert, southern, sea
  'Zahir', 'Amara', 'Idris', 'Sahra', 'Kassim', 'Nadira', 'Tariq', 'Leilani', 'Rashid', 'Samira',
  'Oduya', 'Kesi', 'Malik', 'Yara', 'Jarek', 'Marisol', 'Teodor', 'Calla', 'Dorian', 'Nerissa',
  // long and sophisticated
  'Aurelian Valecrest', 'Seraphine Ashcombe', 'Isembard Thornequill', 'Octavia Marrowdale', 'Lucien Vantessaire',
  'Evander Halloway', 'Cassandria Wyndmere', 'Theodric Ambershaw', 'Ysolde Ravencourt', 'Maximilian Frostmantle',
  'Celestine Duvaliere', 'Bartholomew Greythorn', 'Anastasia Silverlake', 'Peregrine Hawksley', 'Valentina Morrowfield',
  'Sebastien Lockhaven', 'Genevieve Starling', 'Leopold Ashgrave', 'Ottoline Brightwater', 'Cornelius Blackfen',
  'Rosalind Everhart', 'Augustin Coldridge', 'Philippa Thornbury', 'Lysander Vale', 'Emmeline Darkwater',
  'Hieronymus Quell', 'Elisabetta Moonfallow', 'Fitzgerald Harrowgate', 'Persephine Lark', 'Alaric Wintermere',
  'Magdalena Ostrova', 'Thaddeus Rookwood', 'Clementine Fairweather', 'Ignatius Hollowell', 'Viviane Saltmarsh',
  'Montgomery Briarwood', 'Annelise Fenwright', 'Ludovic Grimsby', 'Marguerite Asheford', 'Casimir Ondrevic',
  // with a homeland or a title
  'Elowen of Brackenmoor', 'Caius of the Ninth Gate', 'Mirabel of Sunhollow', 'Torvin of Hrafnsey', 'Liesel of the Reeds',
  'Aldric the Unbending', 'Saoirse the Wayfarer', 'Brannick the Grey', 'Nimue of Stillwater', 'Hespera Nightbloom',
  'Gideon of Ashenmere', 'Isaura of the Salt Coast', 'Corvus Ninefold', 'Wilhelmina Oakhallow', 'Oswin of Low Barrow',
  'Thessaly of the Thorns', 'Rafe Underbough', 'Anselm Gloamwalker', 'Ilyria Dawnsworn', 'Severin Coldharbour',
  'Ondine of the Deeps', 'Barnaby Copperkettle', 'Ysmay Hollowbrook', 'Evrard the Lantern', 'Morwenna Stormcaller',
];

/** A hero name, never the same as `avoid` (so the dice always change it). */
export function heroName(avoid = '', r: Rand = rand): string {
  for (let i = 0; i < 8; i++) {
    const n = pick(HERO_NAMES, r);
    if (n !== avoid) return n;
  }
  return HERO_NAMES[0] === avoid ? HERO_NAMES[1] : HERO_NAMES[0];
}
