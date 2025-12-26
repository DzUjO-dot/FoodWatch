// Szacowanie kosztu koszyka i kategoryzacja

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
      'ser',
      'gouda',
      'cheddar',
      'twaróg',
      'serek wiejski',
      'serek homogenizowany',
      'masło',
      'margaryna',
      'jajko',
      'jajka',
      'egg',
      'eggs'
    ],
    avgPrice: 4.5
  },
  {
    category: 'Pieczywo',
    emoji: '🥖',
    keywords: [
      'chleb',
      'bułka',
      'bułki',
      'bagietka',
      'kajzerka',
      'grahamka',
      'tost',
      'tostowy',
      'rogal',
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
      'napój',
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
      'truskawki',
      'maliny',
      'borówki',
      'winogrona',
      'brzoskwinia',
      'morela',
      'śliwka'
    ],
    avgPrice: 4.0
  },
  {
    category: 'Mięso i ryby',
    emoji: '🥩',
    keywords: [
      'kurczak',
      'filet z kurczaka',
      'pierś z kurczaka',
      'wołowina',
      'schab',
      'wieprzowina',
      'karkówka',
      'ryba',
      'łosoś',
      'tuńczyk',
      'parówki',
      'kiełbasa'
    ],
    avgPrice: 15.0
  },
  {
    category: 'Mrożonki',
    emoji: '❄️',
    keywords: [
      'mrożone',
      'mrożonka',
      'pizza mrożona',
      'frytki mrożone',
      'mieszanka warzywna',
      'lody'
    ],
    avgPrice: 10.0
  },
  {
    category: 'Sucha żywność',
    emoji: '🍚',
    keywords: [
      'ryż',
      'makaron',
      'kasza',
      'płatki śniadaniowe',
      'mąka',
      'cukier',
      'sól'
    ],
    avgPrice: 5.5
  },
  {
    category: 'Inne',
    emoji: '🛒',
    keywords: [],
    avgPrice: 7.0
  }
];

function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCategoryForName(name, brand) {
  const full = normalize(`${name || ''} ${brand || ''}`);

  for (const rule of AI_PRICE_RULES) {
    if (
      rule.keywords.some(keyword => full.includes(normalize(keyword)))
    ) {
      return rule;
    }
  }

  return AI_PRICE_RULES.find(r => r.category === 'Inne') || AI_PRICE_RULES[AI_PRICE_RULES.length - 1];
}

function estimateBasketFromShoppingList(items) {
  if (!Array.isArray(items) || !items.length) {
    return { totalEstimate: 0, count: 0, byCategory: [] };
  }

  const byCategoryMap = new Map();
  let totalEstimate = 0;
  let count = 0;

  items.forEach(item => {
    const rule = getCategoryForName(item.name, item.brand);
    const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const price = (rule.avgPrice || 0) * qty;
    totalEstimate += price;
    count += qty;

    const key = rule.category;
    const existing = byCategoryMap.get(key) || {
      category: rule.category,
      emoji: rule.emoji,
      items: 0,
      estimate: 0
    };
    existing.items += qty;
    existing.estimate += price;
    byCategoryMap.set(key, existing);
  });

  const byCategory = Array.from(byCategoryMap.values())
    .map(cat => ({
      ...cat,
      estimate: Math.round(cat.estimate),
      share:
        totalEstimate > 0
          ? Math.round((cat.estimate / totalEstimate) * 100)
          : 0
    }))
    .sort((a, b) => b.estimate - a.estimate);

  return {
    totalEstimate: Math.round(totalEstimate),
    count,
    byCategory
  };
}

window.FoodWatchAI = {
  getCategoryForName,
  estimateBasketFromShoppingList
};
