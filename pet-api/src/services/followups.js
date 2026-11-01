// ======================================================
// 「接下來可以問」：依這次檢索到的知識庫條目，產生追問建議
//
// 不額外呼叫模型（不會變慢、不花 token）：
//   1. 先看這次命中的條目有沒有專屬的追問（BY_SLUG）
//   2. 再依條目的類別給通用追問（BY_CATEGORY）
//   3. 如果沒有命中知識庫，改用健康事件類型（BY_EVENT）
//   4. 嚴重程度是 emergency / urgent 時，加上「到醫院前可以先做什麼」
//
// 每個追問都是用「接近知識庫用詞」的問法寫的，使用者點下去之後，
// 檢索才找得到內容。新增或修改後，可執行 `node scripts/test-followups.js` 檢查。
//
// 文字裡的 {pet} 會換成「狗」或「貓」；species 標 'dog' / 'cat' 的追問只在該物種顯示。
// ======================================================

// 注意：刻意不問「到醫院前可以先做什麼？」，那會讓模型自己發揮（例如催吐、餵牛奶），
// 這些不在知識庫裡，也可能有害。改問「要先聯絡獸醫並說明什麼」，知識庫有對應內容。
const HOSPITAL_PREP = '要去動物醫院前，需要先打電話給獸醫嗎？'

// 條目專屬的追問（key 是 kb_documents.slug）
const BY_SLUG = {
  'aspca-xylitol': ['木糖醇還常見在哪些食品裡？'],
  'aspca-chocolate-caffeine': ['哪一種巧克力最危險？'],
  'aspca-allium': ['洋蔥、大蒜、韭菜都不能吃嗎？'],
  'aspca-grapes-raisins': ['{pet}吃了葡萄，為什麼會傷害腎臟？'],
  'aspca-alcohol-yeast-dough': ['生麵團為什麼對{pet}危險？'],

  'merck-ethylene-glycol': [
    '防凍劑中毒多久會出現腎衰竭？',
    '怎麼預防{pet}誤食防凍劑？'
  ],
  'merck-poisoning-intro': ['{pet}誤食東西時，要記下哪些資訊給獸醫？'],
  'merck-aki-toxins': [
    { text: '貓碰到百合要怎麼辦？', species: 'cat' }
  ],

  'merck-urethral-obstruction': [
    { text: '貓一直蹲砂盆是便秘還是尿不出來？', species: 'cat' },
    { text: '貓下泌尿道疾病（血尿、亂尿）是怎麼回事？', species: 'cat' }
  ],
  'merck-cat-flutd': [
    { text: '怎麼降低貓再次膀胱炎發作的機會？', species: 'cat' },
    { text: '貓尿不出來是緊急狀況嗎？', species: 'cat' }
  ],
  'merck-cat-constipation': [
    {
      text: '公貓用力排便卻排不出來，會不會其實是尿不出來？',
      species: 'cat'
    }
  ],

  'merck-dog-vomiting': [
    { text: '狗的嘔吐和反芻有什麼不同？', species: 'dog' },
    { text: '短期嘔吐和長期嘔吐有什麼差別？', species: 'dog' }
  ],
  'merck-cat-gastritis-vomiting': [
    { text: '貓吐出來帶血或像咖啡渣，要緊嗎？', species: 'cat' }
  ],
  'merck-cat-gi-obstruction': [
    { text: '貓吞到線有多危險？', species: 'cat' }
  ],

  'merck-dog-kennel-cough': [
    { text: '犬舍咳有疫苗可以預防嗎？', species: 'dog' },
    { text: '犬舍咳會傳染嗎？', species: 'dog' }
  ],
  'merck-cat-cough-asthma': [
    { text: '貓氣喘要避免哪些東西？', species: 'cat' }
  ],

  'merck-emergency-heat-cold-transport': [
    '中暑時要怎麼幫{pet}降溫？',
    '怎麼安全地運送受傷的{pet}？'
  ],
  'merck-emergency-unconscious-cpr': ['{pet}失去意識時，要怎麼做胸部按壓？'],
  'merck-emergency-bleeding-burns-choking': ['{pet}噎到時可以怎麼幫牠？'],

  'merck-heartworm-prevention': ['心絲蟲病有哪些症狀？'],
  'merck-heartworm-signs': ['心絲蟲要怎麼預防？'],
  'merck-roundworm-prevention': ['{pet}的寄生蟲會傳染給人嗎？'],

  'merck-ckd-overview': ['慢性腎臟病的{pet}要怎麼吃、怎麼補水？'],
  'merck-ckd-care': ['慢性腎臟病早期有哪些徵兆？'],
  'merck-diabetes-dogs-cats': ['糖尿病的{pet}要怎麼吃？'],
  'merck-diabetes-cat-care': [
    { text: '糖尿病的貓出現哪些情況要立刻就醫？', species: 'cat' }
  ],

  'merck-calories-rer-mer': ['{pet}過胖要怎麼調整餵食？'],
  'merck-dog-dental-care': ['{pet}牙齒痛會有哪些徵兆？'],
  'merck-cat-dental-care': ['{pet}牙齒痛會有哪些徵兆？'],
  'merck-vaccines-dogs': [
    { text: '幼犬的疫苗要打到幾個月？', species: 'dog' }
  ],
  'merck-vaccines-cats': [
    { text: '幼貓的疫苗什麼時候開始打？', species: 'cat' }
  ],
  'tw-rabies-annual-booster': ['不打狂犬病疫苗會怎麼樣？']
}

// 依條目類別的通用追問（key 是 kb_documents.category）
const BY_CATEGORY = {
  food_toxin: [
    '{pet}吃了之後，哪些症狀要立刻就醫？',
    '還有哪些食物是{pet}絕對不能吃的？',
    '懷疑{pet}誤食時，要先記下哪些資訊給獸醫？'
  ],
  poisoning: [
    '懷疑{pet}中毒，要先聯絡獸醫並說明什麼？',
    '家裡要怎麼收好有毒的東西？'
  ],
  digestive: [
    '{pet}嘔吐或腹瀉時，什麼情況要立刻就醫？',
    '看獸醫時要準備什麼資料或樣本？',
    '幼小的{pet}腹瀉有什麼要特別注意？'
  ],
  symptom: [
    '這些症狀超過多久要看獸醫？',
    '看獸醫時要準備什麼資料？'
  ],
  emergency: [
    HOSPITAL_PREP,
    '怎麼安全地運送受傷的{pet}？',
    '{pet}昏倒或沒有反應時，要先檢查什麼？'
  ],
  nutrition: [
    '{pet}一天要吃多少熱量才剛好？',
    '怎麼知道{pet}有沒有過胖？',
    '哪些食物是{pet}絕對不能吃的？'
  ],
  feeding: [
    '{pet}一天可以吃多少零食？',
    '可以自己煮{pet}的飯嗎？營養夠嗎？',
    '哪些食物是{pet}絕對不能吃的？'
  ],
  vaccine: [
    '台灣的{pet}需要每年打狂犬病疫苗嗎？',
    '{pet}需要定期驅蟲嗎？',
    '{pet}多久要帶去健康檢查一次？'
  ],
  prevention: [
    '{pet}需要打哪些疫苗？',
    '{pet}需要定期驅蟲嗎？',
    '需要幫{pet}刷牙嗎？怎麼刷？'
  ],
  parasite: [
    '{pet}需要吃心絲蟲預防藥嗎？',
    '幼小的{pet}怎麼驅蟲？'
  ],
  dental: [
    '需要幫{pet}刷牙嗎？怎麼刷？',
    '什麼時候要帶{pet}去洗牙？'
  ],
  chronic_disease: [
    '{pet}喝水和尿尿變多，是怎麼了？',
    '老年{pet}要注意哪些慢性病？'
  ],
  regulation: [
    '寵物晶片是什麼？需要登記嗎？',
    '台灣的{pet}需要每年打狂犬病疫苗嗎？'
  ],
  new_owner: [
    '怎麼知道{pet}生病了？',
    '{pet}多久要帶去健康檢查一次？',
    '寵物晶片是什麼？需要登記嗎？'
  ]
}

// 沒有命中知識庫時，依 AI 記錄的健康事件類型給追問
const BY_EVENT = {
  vomiting: [
    '{pet}嘔吐時，什麼情況要立刻就醫？',
    '看獸醫時要準備什麼資料或樣本？'
  ],
  diarrhea: [
    '{pet}腹瀉時，什麼情況要立刻就醫？',
    '看獸醫時要準備什麼資料或樣本？'
  ],
  appetite_loss: [
    '怎麼知道{pet}生病了？',
    '{pet}多久要帶去健康檢查一次？'
  ],
  poisoning: [HOSPITAL_PREP, '{pet}誤食東西時，要記下哪些資訊給獸醫？'],
  illness: [
    '怎麼知道{pet}生病了？',
    '{pet}多久要帶去健康檢查一次？'
  ]
}

function petWord(species) {
  if (species === 'dog') return '狗'
  if (species === 'cat') return '貓'
  return '寵物'
}

function normalize(text) {
  return String(text || '').replace(/[\s，。？！、?!,.]/g, '')
}

// 把清單裡的字串或 { text, species } 轉成要顯示的文字（不符合物種的略過）
function expand(list, species) {
  const out = []

  for (const entry of list || []) {
    const text = typeof entry === 'string' ? entry : entry.text
    const only = typeof entry === 'string' ? null : entry.species

    if (only && only !== species) continue

    out.push(text.replaceAll('{pet}', petWord(species)))
  }

  return out
}

// ------------------------------------------------------
// items：retrieveKnowledge 的結果（要有 slug、category）
// 回傳最多 limit 則追問；不會包含使用者剛問過的那句
// ------------------------------------------------------
function buildFollowups({
  items = [],
  species,
  severity,
  eventType,
  lastUserText = '',
  limit = 3
}) {
  const sp = species === 'dog' || species === 'cat' ? species : null

  const candidates = []

  if (severity === 'emergency') candidates.push(HOSPITAL_PREP)

  const [first, second] = items

  if (first) candidates.push(...expand(BY_SLUG[first.slug], sp))

  if (severity === 'urgent') candidates.push(HOSPITAL_PREP)

  if (second) candidates.push(...expand(BY_SLUG[second.slug], sp))

  if (first) candidates.push(...expand(BY_CATEGORY[first.category], sp))
  if (second) candidates.push(...expand(BY_CATEGORY[second.category], sp))

  if (!items.length) {
    candidates.push(...expand(BY_EVENT[eventType], sp))
  }

  const asked = normalize(lastUserText)
  const seen = new Set()
  const result = []

  for (const raw of candidates) {
    const text = raw.replaceAll('{pet}', petWord(sp))
    const key = normalize(text)

    if (!key || seen.has(key) || key === asked) continue

    seen.add(key)
    result.push(text)

    if (result.length >= limit) break
  }

  return result
}

// 給檢查腳本用：列出某物種所有可能出現的追問文字
function listAllFollowups(species) {
  const sp = species === 'dog' || species === 'cat' ? species : null
  const all = new Set([HOSPITAL_PREP])

  for (const group of [BY_SLUG, BY_CATEGORY, BY_EVENT]) {
    for (const list of Object.values(group)) {
      expand(list, sp).forEach(t => all.add(t))
    }
  }

  return [...all]
}

module.exports = {
  buildFollowups,
  listAllFollowups,
  FOLLOWUP_SLUGS: Object.keys(BY_SLUG)
}
