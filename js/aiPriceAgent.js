// js/ai.js
// Bardzo prosty „pseudo-AI” do szacowania kosztu koszyka na podstawie nazw produktów.
// DZIAŁA CAŁKOWICIE LOKALNIE – bez zewnętrznego AI.

// Każda reguła ma:
// - category  – nazwa kategorii
// - emoji     – ikonka do wyświetlenia
// - keywords  – słowa kluczowe, po których dopasowujemy (szukane jako substring w nazwie)
// - avgPrice  – szacunkowa cena za 1 sztukę (zł)
const AI_PRICE_RULES = [
  {
    category: 'Nabiał',
    emoji: '🥛',
    keywords: [
      'mleko',
      'milk',
      'jogurt',
      'yogurt',
      'kefir',
      'maślanka',
      'śmietana',
      'ser żółty',
      'ser gouda',
      'ser edam',
      'ser cheddar',
      'ser topiony',
      'twaróg',
      'serek wiejski',
      'serek homogenizowany',
      'masło',
      'margaryna'
    ],
    avgPrice: 4.5
  },
  {
    category: 'Pieczywo',
    emoji: '🥖',
    keywords: [
      'chleb',
      'bułka',
      'bagietka',
      'kajzerka',
      'grahamka',
      'tost',
      'tostowy',
      'rogalik (pieczywo)',
      'pita',
      'tortilla'
    ],
    avgPrice: 4.0
  },
  {
    category: 'Napoje',
    emoji: '🥤',
    keywords: [
      'cola',
      'pepsi',
      'fanta',
      'sprite',
      'napój gazowany',
      'napój niegazowany',
      'sok',
      'nektar',
      'woda',
      'herbata mrożona',
      'ice tea',
      'izotonik',
      'energetyk',
      'energy drink'
    ],
    avgPrice: 5.0
  },
  {
    category: 'Słodycze i przekąski',
    emoji: '🍫',
    keywords: [
      'czekolada',
      'baton',
      'wafel',
      'ciastka',
      'herbatniki',
      'krakersy',
      'chipsy',
      'paluszki',
      'orzeszki',
      'żelki',
      'guma do żucia',
      'nutella',
      'krem czekoladowy'
    ],
    avgPrice: 6.0
  },
  {
    category: 'Warzywa',
    emoji: '🥕',
    keywords: [
      'pomidor',
      'pomidory',
      'ogórek',
      'sałata',
      'marchew',
      'kapusta',
      'cebula',
      'czosnek',
      'papryka',
      'ziemniaki',
      'ziemniak',
      'brokuł',
      'brokuły',
      'kalafior',
      'szpinak',
      'rukola'
    ],
    avgPrice: 3.0
  },
  {
    category: 'Owoce',
    emoji: '🍎',
    keywords: [
      'jabłko',
      'jabłka',
      'banan',
      'banany',
      'gruszka',
      'gruszki',
      'pomarańcza',
      'mandarynka',
      'mandarynki',
      'cytryna',
      'truskawki',
      'truskawka',
      'maliny',
      'malina',
      'borówki',
      'borówka',
      'winogrona'
    ],
    avgPrice: 4.0
  },
  {
    category: 'Mięso i wędliny',
    emoji: '🥩',
    keywords: [
      'kurczak',
      'filet z kurczaka',
      'pierś z kurczaka',
      'indyk',
      'schab',
      'wołowina',
      'wieprzowina',
      'karkówka',
      'boczek',
      'szynka',
      'kiełbasa',
      'parówki',
      'salami'
    ],
    avgPrice: 12.0
  },
  {
    category: 'Ryby i owoce morza',
    emoji: '🐟',
    keywords: [
      'łosoś',
      'dorsz',
      'mintaj',
      'śledź',
      'tuńczyk',
      'makrela',
      'paluszki rybne',
      'krewetki'
    ],
    avgPrice: 10.0
  },
  {
    category: 'Produkty suche',
    emoji: '🍚',
    keywords: [
      'ryż',
      'makaron',
      'kasza',
      'płatki owsiane',
      'owsianka',
      'mąka',
      'cukier',
      'sól',
      'bułka tarta',
      'sos w proszku',
      'zupa w proszku'
    ],
    avgPrice: 4.0
  },
  {
    category: 'Konserwy i słoiki',
    emoji: '🥫',
    keywords: [
      'konserwa',
      'groszek konserwowy',
      'fasola konserwowa',
      'tuńczyk w puszce',
      'pasztet',
      'pomidory w puszce',
      'ogórki konserwowe',
      'dżem',
      'powidła',
      'miód'
    ],
    avgPrice: 6.0
  },
  {
    category: 'Mrożonki',
    emoji: '🧊',
    keywords: [
      'mrożona',
      'mrożone',
      'lody',
      'pizza mrożona',
      'warzywa mrożone',
      'frytki mrożone',
      'pierogi mrożone'
    ],
    avgPrice: 7.0
  },
  {
    category: 'Chemia domowa',
    emoji: '🧼',
    keywords: [
      'płyn do naczyń',
      'płyn do prania',
      'proszek do prania',
      'płyn do płukania',
      'płyn do podłóg',
      'domestos',
      'środek czyszczący',
      'zmywarka tabletki',
      'tabletki do zmywarki'
    ],
    avgPrice: 12.0
  },
  {
    category: 'Higiena osobista',
    emoji: '🧴',
    keywords: [
      'szampon',
      'odżywka',
      'żel pod prysznic',
      'mydło',
      'pasta do zębów',
      'płyn do płukania jamy ustnej',
      'dezodorant',
      'antyperspirant',
      'chusteczki higieniczne',
      'papier toaletowy'
    ],
    avgPrice: 8.0
  },
  {
    category: 'Inne',
    emoji: '🛒',
    keywords: [
      'przyprawa',
      'przyprawy',
      'ketchup',
      'majonez',
      'musztarda',
      'olej',
      'oliwa',
      'ocet',
      'kawa',
      'herbata',
      'kakao',
      'bulion'
    ],
    avgPrice: 5.0
  }
];

/**
 * Szacuje koszt koszyka na podstawie listy produktów oznaczonych jako "kupione".
 * @param {Array} items - elementy z listy zakupów (z bazy `shopping`)
 * @returns {{ totalEstimate: number, count: number, byCategory: Array }}
 */
function estimateBasketFromShoppingList(items) {
  const matches = [];

  (items || []).forEach(item => {
    const name = `${item.name || ''} ${item.brand || ''}`.toLowerCase().trim();
    if (!name) return;

    // znajdź pierwszą regułę, której jakiekolwiek słowo kluczowe występuje w nazwie
    const rule = AI_PRICE_RULES.find(r =>
      r.keywords.some(k => name.includes(k))
    );

    if (rule) {
      matches.push({ item, rule });
    }
  });

  // jeśli nic nie dopasowaliśmy – brak danych do szacowania
  if (!matches.length) {
    return {
      totalEstimate: 0,
      count: 0,
      byCategory: []
    };
  }

  const totalEstimate = matches.reduce(
    (sum, m) => sum + (m.rule.avgPrice || 0),
    0
  );
  const count = matches.length;

  // zliczanie po kategoriach
  const byCatMap = new Map();
  matches.forEach(m => {
    const key = m.rule.category;
    const prev =
      byCatMap.get(key) || {
        label: m.rule.category,
        emoji: m.rule.emoji,
        estimate: 0
      };
    prev.estimate += m.rule.avgPrice || 0;
    byCatMap.set(key, prev);
  });

  const byCategory = Array.from(byCatMap.values())
    .map(cat => ({
      ...cat,
      share: totalEstimate
        ? Math.round((cat.estimate / totalEstimate) * 100)
        : 0
    }))
    .sort((a, b) => b.estimate - a.estimate);

  return {
    totalEstimate,
    count,
    byCategory
  };
}

// Wystawiamy w globalnym obiekcie
window.FoodWatchAI = {
  estimateBasketFromShoppingList
};
