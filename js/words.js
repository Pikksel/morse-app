// Daily answers: common 5-letter words. Order is deliberately mixed.
// Add words at the END only: the daily pick is based on list position.
export const ANSWERS = [
  'RADIO', 'SOUND', 'LIGHT', 'HOUSE', 'WATER', 'PLANT', 'BREAD', 'STORM', 'CHAIR', 'MUSIC',
  'OCEAN', 'TRAIN', 'HEART', 'SMILE', 'CLOUD', 'RIVER', 'STONE', 'GRASS', 'NIGHT', 'BEACH',
  'TABLE', 'APPLE', 'DREAM', 'FIELD', 'SHIRT', 'BRAIN', 'HORSE', 'MONEY', 'PAPER', 'QUIET',
  'SIGNS', 'WORLD', 'FLAME', 'GHOST', 'NORTH', 'SOUTH', 'PIANO', 'LEMON', 'TIGER', 'SPACE',
  'CODES', 'EARTH', 'FROST', 'GLASS', 'HONEY', 'IVORY', 'JUICE', 'KNIFE', 'LASER', 'MAPLE',
  'NOISE', 'ORBIT', 'PEARL', 'QUEEN', 'ROBOT', 'SALAD', 'TOWER', 'UNCLE', 'VOICE', 'WHALE',
  'YOUTH', 'ZEBRA', 'BLAST', 'CRANE', 'DANCE', 'EAGLE', 'FAITH', 'GRAPE', 'HOTEL', 'INDEX',
  'JOINT', 'KAYAK', 'LUNCH', 'MOUSE', 'NURSE', 'OLIVE', 'PRIDE', 'QUOTE', 'RHYME', 'SHEEP',
  'THUMB', 'URBAN', 'VAPOR', 'WHEAT', 'YACHT', 'BLOOM', 'CANDY', 'DRIFT', 'ELBOW', 'FLOOD',
  'GIANT', 'HUMOR', 'IMAGE', 'JELLY', 'KOALA', 'LODGE', 'MARCH', 'NOVEL', 'OPERA', 'PILOT',
  'RANCH', 'SCALE', 'TRACK', 'UNITY', 'VIVID', 'WORRY', 'BENCH', 'CHESS', 'DAISY', 'EMPTY',
  'FENCE', 'GLOBE', 'HAPPY', 'INLET', 'JEWEL', 'KARMA', 'LEARN', 'MAGIC', 'NERVE', 'OTTER',
  'PANEL', 'QUILT', 'RELAY', 'SPARK', 'TORCH', 'ULTRA', 'VALVE', 'WIDTH', 'BADGE', 'CABIN',
  'DELTA', 'ENJOY', 'FOCUS', 'GUARD', 'HABIT', 'IGLOO', 'JUMBO', 'KNOCK', 'LEVEL', 'MEDAL',
  'NINJA', 'OASIS', 'PATCH', 'RAVEN', 'SHORE', 'TEMPO', 'UPPER', 'VIDEO', 'WAGON', 'BASIL',
  'CORAL', 'DIARY', 'EVENT', 'FLUTE', 'GREEN', 'HIKER', 'ICING', 'JOKER', 'LATCH', 'MOTOR',
  'NEWER', 'OFFER', 'PRISM', 'ROUTE', 'SWIFT', 'TOAST', 'UNDER', 'VISIT', 'WRIST', 'BRICK',
  'CLOCK', 'DWARF', 'ENTRY', 'FLASH', 'GRAIN', 'HEDGE', 'IRONY', 'LOGIC', 'MERRY', 'NOBLE',
  'ONION', 'PULSE', 'REALM', 'SNAKE', 'THEME', 'USUAL', 'VERSE', 'WOMAN', 'BOARD', 'CRISP',
  'DOUGH', 'EXTRA', 'FRAME', 'GLOVE', 'HASTE', 'INPUT', 'LOYAL', 'METAL', 'NAVAL', 'OUTER',
  'PLAZA', 'RIDGE', 'SOLAR', 'TRUCK', 'UNTIL', 'VAULT', 'WOVEN', 'BEARD', 'CHALK', 'DUSTY',
  'EQUAL', 'FRUIT', 'GAMMA', 'HATCH', 'IDEAL', 'LUCKY', 'MINOR', 'NEEDS', 'ORGAN', 'POWER',
  'RAINY', 'STEAM', 'TULIP', 'UNZIP', 'VOTER', 'WITCH', 'BLADE', 'CROWN', 'DEPTH', 'ELITE',
  'FERRY', 'GECKO', 'HYENA', 'INNER', 'LINEN', 'MOOSE', 'NACHO', 'OPTIC', 'PASTA', 'RUGBY',
  'SHARK', 'TWIST', 'UNION', 'VENUS', 'WHEEL', 'BISON', 'COMET', 'DONOR', 'EMBER', 'FORTY',
];


// 🧠 Normal Daily from HARD_FROM (game.js): hard words instead of random letters. Rare / long Morse letters
// (J Q X Y Z V K), odd patterns, words people don't guess quickly. None of them are in ANSWERS (Easy).
// Order is deliberately mixed. Add words at the END only: the daily pick is based on list position.
export const HARD_WORDS = [
  'WHIFF', 'VOUCH', 'WOOZY', 'COMFY', 'CHIVE', 'KNOLL', 'FUZZY', 'WRYLY', 'REVUE', 'KHAKI',
  'EXTOL', 'PROXY', 'USURP', 'VIXEN', 'HAIKU', 'VAPID', 'AZURE', 'LLAMA', 'ZESTY', 'JAZZY',
  'OKAPI', 'OZONE', 'DECOY', 'ENVOY', 'POLKA', 'NYMPH', 'SHYLY', 'SKIFF', 'YOKEL', 'SQUID',
  'CIVIC', 'GAFFE', 'SQUAB', 'OXIDE', 'TABOO', 'FOYER', 'FIZZY', 'JUROR', 'XENON', 'VODKA',
  'AFFIX', 'TOXIC', 'BANJO', 'PIZZA', 'WHELK', 'BUXOM', 'SQUAD', 'JUMPY', 'PIQUE', 'GAWKY',
  'BIJOU', 'RAZOR', 'BOOZY', 'JIVED', 'MYRRH', 'EPOXY', 'GLYPH', 'DIZZY', 'TOPAZ', 'PSYCH',
  'BOXER', 'EXULT', 'QUALM', 'CYNIC', 'QUIRK', 'DUCHY', 'KUDZU', 'QUAFF', 'PIXEL', 'ABYSS',
  'FLUKY', 'KIOSK', 'HAVOC', 'JERKY', 'LYMPH', 'JIFFY', 'HUSKY', 'YUCCA', 'HAZEL', 'WALTZ',
  'SQUIB', 'JOUST', 'BAYOU', 'ZILCH', 'FRIZZ', 'ZIPPY', 'PYGMY', 'JUDGE', 'GLAZE', 'KEBAB',
  'JOWLS', 'QUART', 'AXIOM', 'QUOTA', 'VEXED', 'KAZOO', 'CHIMP', 'NEXUS', 'KNACK', 'GAUZE',
  'WACKY', 'QUIPS', 'TAWNY', 'MOXIE', 'VYING', 'BLITZ', 'JAUNT', 'GUAVA', 'GIZMO', 'TRYST',
  'BEVEL', 'FJORD', 'SQUAT', 'DOGMA', 'EBONY', 'QUEUE', 'VOGUE', 'QUACK', 'QUILL', 'QUASH',
];
