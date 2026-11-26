// ======================================================
// 貓／狗不能吃的日常食物（安全規則）
//
// 為什麼用關鍵字規則，而不是交給 AI 判斷：
//   圖片辨識只負責「這是什麼食物」；能不能餵是安全問題，
//   結果必須固定、可預期、可稽核 —— 同一個食物今天警告、明天不警告
//   是最糟的體驗。所以辨識交給模型，安全交給這張表。
//
// 內容依據 ASPCA／動物毒物臨床常用的清單；本專案以貓為主，
// 所以把貓特別敏感的項目（蔥蒜、百合、葡萄）列為危險等級。
//
// level 的意義（前端與小助理都用同一套）：
//   danger  → 需要按「仍要儲存」確認（飲食計畫也會把這種食物排除）
//   warning → 只是提醒，不擋操作
// ======================================================

const BOTH = ['cat', 'dog']

const RULES = [
  {
    id: 'allium',
    species: BOTH,
    level: 'danger',
    title: '不建議餵食蔥蒜類植物',
    reason:
      '洋蔥、青蔥、大蒜、韭菜（生的、熟的、蔥粉蒜粉或調味湯汁都算）會破壞紅血球，' +
      '可能造成溶血性貧血；貓比狗更敏感，少量長期吃也有風險。',
    suggestion:
      '不要餵食，含蔥蒜的湯汁、滷汁、醬汁也不算安全。' +
      '誤食後若精神差、食慾差、尿色變深或喘，盡快就醫。',
    patterns: [
      /洋蔥|洋蔥粉|青蔥|大蔥|蔥頭|蔥粉|蔥/,
      /大蒜|蒜頭|蒜粉|蒜蓉|蒜/,
      /韭菜|韭/,
      /onion|garlic|leek|chive|shallot|scallion/i
    ]
  },

  {
    id: 'caffeine',
    species: BOTH,
    level: 'danger',
    title: '不建議餵食巧克力、咖啡或茶',
    reason:
      '巧克力（可可、可可粉）與咖啡、茶、可樂含甲基黃嘌呤類成分，' +
      '會刺激神經與心血管，可能嘔吐、亢奮、心律不整，嚴重時抽搐。可可含量越高風險越大。',
    suggestion: '不要餵食；巧克力甜點、巧克力醬、奶茶也一樣。误食建議盡快聯繫獸醫。',
    patterns: [
      /巧克力|可可|可可粉/,
      /咖啡|咖啡因|抹茶|烏龍茶|綠茶|紅茶|奶茶|可樂/,
      /\bchocolate|cocoa|coffee|caffeine|matcha|espresso|cola\b|\btea\b/i
    ]
  },

  {
    id: 'grapes',
    species: BOTH,
    level: 'danger',
    title: '不建議餵食葡萄與葡萄乾',
    reason:
      '葡萄與葡萄乾可能引發急性腎衰竭，毒性成分尚未完全確定，因此沒有可靠的「安全份量」，' +
      '少量也可能造成嚴重風險。',
    suggestion:
      '不要餵食，葡萄汁、含葡萄乾的麵包甜點也算。誤食建議盡快就醫並觀察尿量。',
    patterns: [/葡萄|葡萄乾|提子/, /grape|raisin|sultana|currant/i]
  },

  {
    id: 'alcohol-dough',
    species: BOTH,
    level: 'danger',
    title: '不建議餵食含酒精的食物或生麵團',
    reason:
      '酒精會造成中毒與神經症狀；未烤熟的酵母麵團會在胃裡持續膨脹、發酵產生酒精，' +
      '可能脹氣甚至引發胃扭轉。',
    suggestion: '不要餵食酒類、酒料理（米酒、紅酒醬汁）與未烤的麵團。',
    patterns: [
      /酒精|啤酒|紅酒|白酒|清酒|米酒|調酒|酒糟|香檳/,
      /生麵團|未烤|發酵麵團|酵母麵團/,
      /alcohol|\bbeer\b|\bwine\b|liquor|\bsake\b|champagne|raw dough/i
    ]
  },

  {
    id: 'xylitol',
    species: BOTH,
    level: 'danger',
    title: '不建議餵食含木糖醇的食物',
    reason:
      '木糖醇常見於無糖口香糖、無糖糖果、烘焙食品與某些花生醬，' +
      '容易造成低血糖，量多時可能傷害肝臟。',
    suggestion:
      '先看成分表有無「木糖醇／xylitol」；包藥或抹醬也要確認（部分花生醬含木糖醇）。',
    patterns: [/木糖醇|口香糖|無糖糖果|無糖口香/, /xylitol|sorbitol|gum\b/i]
  },

  {
    id: 'lily-plant',
    species: BOTH,
    level: 'danger',
    title: '百合等居家植物對貓極毒',
    reason:
      '百合科的花、葉、花粉甚至花瓶水都可能造成貓急性腎衰竭；' +
      '黃金葛、夾竹桃、聖誕紅、杜鵑、水仙、鬱金香也應避免。',
    suggestion:
      '家有貓建議不要擺放這類植物。误食或沾到花粉（舔毛）請立即就醫，不要等症狀。',
    patterns: [
      /百合|百合根|黃金葛|夾竹桃|聖誕紅|杜鵑|水仙|鬱金香|郁金香|仙客來|芋科植物/,
      /\blily|lilies|pothos|oleander|azalea|daffodil|tulip|cyclamen/i
    ]
  },

  {
    id: 'human-meds',
    species: BOTH,
    level: 'danger',
    title: '不要自行餵人類藥品',
    reason:
      '人用止痛藥、感冒藥對貓可能致命（例如對乙酰氨基酚／撲熱息痛、布洛芬、阿斯匹靈），' +
      '貓代謝這些藥物的能力很差，少量也可能造成肝損傷或胃潰瘍。',
    suggestion: '一律依獸醫處方給藥；不確定是否安全時先問獸醫，不要自行調整劑量。',
    patterns: [
      /止痛藥|感冒藥|退燒藥|成藥|藥片|藥粉|藥丸|人用藥/,
      /布洛芬|乙醯氨基酚|乙酰氨基酚|撲熱息痛|阿斯匹靈|阿斯匹林/,
      /ibuprofen|acetaminophen|paracetamol|aspirin/i
    ]
  },

  {
    id: 'bones',
    species: BOTH,
    level: 'danger',
    title: '要注意帶骨或碎骨的食物',
    reason:
      '煮熟或碎裂的骨頭容易形成尖角，可能卡在口腔、刺穿或阻塞腸胃；' +
      '魚刺、雞骨、排骨骨对小體型貓尤其危險。',
    suggestion: '去骨後再餵，或改選無骨的肉／正式貓用食品。吞骨後嘔吐、不排便、腹痛請就醫。',
    patterns: [
      /骨頭|帶骨|碎骨|雞骨|鴨骨|魚骨|魚刺|排骨|雞架/,
      /\bbone|bones|fish bone|fishbone|chicken carcass\b/i
    ]
  },

  {
    id: 'raw-food',
    species: BOTH,
    level: 'warning',
    title: '生肉、生魚、生蛋建議避免',
    reason:
      '生食可能有沙門氏菌、大腸桿菌或寄生蟲風險；長期只吃生魚生肉也可能造成硫胺素（維他命 B1）不足。',
    suggestion: '徹底煮熟、不調味再餵；生食計畫請與獸醫討論來源與安全性。',
    patterns: [
      /生肉|生魚|生魚片|生食|生蛋|刺身|生雞|生蝦|未煮熟|半生/,
      /\braw meat|sashimi|raw egg|undercooked|rare steak\b/i
    ]
  },

  {
    id: 'dairy',
    species: BOTH,
    level: 'warning',
    title: '一般鮮奶容易讓成貓拉肚子',
    reason:
      '多數成貓乳糖不耐，鮮奶、起司、優格可能造成脹氣與軟便；' +
      '市面上的寵物奶（去乳糖）才能當作零食少量給。',
    suggestion: '以清水補充水分即可；想給乳製品請選寵物專用、少量試用。',
    requireAck: false,
    patterns: [
      /鮮奶|牛奶|奶精|煉乳|起司|芝士|奶油|優格|酸奶|冰淇淋|雪糕/,
      /\bmilk|cheese|butter|yogurt|yoghurt|ice cream|whipped\b/i
    ]
  },

  {
    id: 'human-seasoned',
    species: BOTH,
    level: 'warning',
    title: '人類的重油重鹹重甜食物不適合貓',
    reason:
      '炸物、滷味、加工肉品（香腸、火腿、培根、午餐肉）與醃漬食物油脂和鈉含量高，' +
      '又常含蔥蒜洋蔥粉，容易造成腸胃不適、胰臟炎與代謝負擔。',
    suggestion: '要給零食請選貓用零食，或白水煮熟的雞肉／魚類少量，不加任何調味。',
    requireAck: false,
    patterns: [
      /炸雞|炸物|油炸|薯條|雞塊|可樂球|滷味|滷肉|香腸|火腿|培根|午餐肉|臘肉|熏肉|煙燻|醃|腌|加工肉/,
      /重鹹|太鹹|高鹽|重油|重甜|人類調味|調味料/,
      /sausage|bacon|ham\b|hot dog|luncheon meat|salted|pickled|marinated|fried\b/i
    ]
  },

  {
    id: 'avocado-citrus',
    species: BOTH,
    level: 'warning',
    title: '酪梨與柑橘類建議避免',
    reason:
      '酪梨含酪梨素且油脂高，容易引起腸胃不適，高脂飲食也是胰臟炎的風險因子；' +
      '柑橘皮與精油會刺激腸胃與呼吸道，貓對精油代謝能力差。',
    suggestion: '不要餵酪梨果肉與柑橘類，含柑橘精油的清潔用品也要讓貓避開。',
    requireAck: false,
    patterns: [
      /酪梨|牛油果|柑橘|柳橙|橙子|檸檬|柚子|橘子皮|橙皮/,
      /avocado|citrus|orange peel|lemon|grapefruit/i
    ]
  },

  {
    id: 'dog-food',
    species: ['cat'],
    level: 'warning',
    title: '狗糧不符合貓的營養需求',
    reason:
      '貓是純肉食動物，需要牛磺酸、花生四烯酸（arachidonic acid）與較高的蛋白質，狗糧長期餵食會營養不足（只偶爾吃到幾顆不會怎樣）。',
    suggestion: '主食請用標示貓用的完整營養食品；家中狗貓餵食分開，避免互吃。',
    requireAck: false,
    patterns: [/狗飼料|狗糧|犬飼料|犬糧|狗零食|狗罐頭/, /\bdog food|dog treat\b/i]
  }
]

// 把多種名稱（AI 辨識的、使用者輸入的、資料庫的）合成一段比對用的文字
function buildHaystack(names = []) {
  return names
    .filter(Boolean)
    .map(name => String(name))
    .join(' ')
    .toLowerCase()
}

function speciesMatches(rule, species) {
  const s = String(species || '').toLowerCase()

  return rule.species.some(target => {
    if (target === 'cat') return /cat|貓|猫/.test(s)
    if (target === 'dog') return /dog|狗|犬/.test(s)
    return false
  })
}

// 回傳符合的規則（同一類只報一次）
function matchUnsafeFoodRules({ species, names = [] }) {
  const text = buildHaystack(names)
  if (!text.trim()) return []

  const matched = []

  for (const rule of RULES) {
    if (!speciesMatches(rule, species)) continue
    if (matched.some(m => m.id === rule.id)) continue

    const hit = rule.patterns.some(pattern => pattern.test(text))
    if (!hit) continue

    matched.push({
      id: rule.id,
      level: rule.level,
      ...(rule.requireAck === false ? { requireAck: false } : {}),
      title: rule.title,
      reason: rule.reason,
      suggestion: rule.suggestion
    })
  }

  return matched
}

module.exports = {
  RULES,
  matchUnsafeFoodRules
}
