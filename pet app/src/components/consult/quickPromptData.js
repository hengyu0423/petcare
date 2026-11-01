// =====================================================
// 健康諮詢的「預先選項」（快速問題）
//
// - 依類別分組：常見症狀、緊急狀況、飲食、預防保健、新手入門
// - 依物種顯示：狗、貓各有適合的問法（沒標 species 的狗貓都會顯示）
// - 文字裡的 {pet} 會換成「狗」或「貓」，讓問法接近知識庫的用詞，檢索比較準
// - 其他物種（兔子、魚…）知識庫目前沒有資料，只顯示原本的通用問題
//
// 想新增選項：在對應類別的 prompts 加一筆 { label, text, species? } 即可。
// 新增後可執行 pet-api 的 `node scripts/test-quick-prompts.js`，
// 檢查這個問題能不能檢索到知識庫內容。
// =====================================================

export const QUICK_PROMPT_CATEGORIES = [
  {
    id: 'symptoms',
    label: '常見症狀',
    icon: '🩺',
    prompts: [
      {
        label: '食慾不振',
        text: '最近{pet}食慾不振，不太想吃東西，可能的原因是什麼？'
      },
      {
        label: '嘔吐',
        text: '今天{pet}吐了幾次，需要就醫嗎？'
      },
      {
        label: '腹瀉',
        text: '{pet}排便異常，糞便很稀，該怎麼辦？'
      },
      {
        label: '便秘',
        text: '{pet}一直用力排便卻排不出來'
      },
      {
        label: '咳嗽',
        text: '{pet}一直在咳嗽，好像喉嚨有東西，是感冒嗎？'
      },
      {
        label: '皮膚搔癢',
        text: '{pet}皮膚出現紅疹或一直在抓癢，是過敏嗎？'
      },
      {
        label: '喝水尿尿變多',
        text: '{pet}最近喝水和尿尿都變很多，是怎麼了？'
      },
      {
        label: '精神不佳',
        text: '{pet}精神很差，一直在睡覺，比平常安靜很多。'
      },
      {
        label: '口臭牙齦',
        text: '{pet}口臭很嚴重，牙齦紅腫，需要處理嗎？'
      }
    ]
  },

  {
    id: 'emergency',
    label: '緊急狀況',
    icon: '🚨',
    prompts: [
      {
        label: '吃到毒物',
        text: '{pet}吃了巧克力、葡萄或洋蔥，要怎麼辦？'
      },
      {
        label: '木糖醇',
        text: '{pet}吃了含木糖醇的口香糖'
      },
      {
        label: '防凍劑',
        text: '{pet}舔了汽車防凍劑，要緊嗎？'
      },
      {
        label: '呼吸困難',
        species: 'cat',
        text: '貓張著嘴呼吸，喉嚨還發出喘鳴聲'
      },
      {
        label: '喘、身體很燙',
        species: 'dog',
        text: '夏天狗喘得很厲害，身體很燙，怎麼辦？'
      },
      {
        label: '昏倒',
        text: '{pet}突然昏倒，沒有反應，要怎麼辦？'
      },
      {
        label: '尿不出來',
        species: 'cat',
        text: '公貓一直蹲在貓砂盆，只尿出幾滴還在叫'
      },
      {
        label: '尿不出來',
        species: 'dog',
        text: '狗一直想尿，卻只尿出幾滴，很不舒服的樣子'
      },
      {
        label: '吞到異物',
        species: 'cat',
        text: '貓好像吞了線或繩子，一直吐，要緊嗎？'
      },
      {
        label: '吞到異物',
        species: 'dog',
        text: '狗好像吞了小東西，一直吐，要緊嗎？'
      },
      {
        label: '受傷流血',
        text: '{pet}受傷流血不止，要怎麼急救？'
      }
    ]
  },

  {
    id: 'diet',
    label: '飲食',
    icon: '🍽️',
    prompts: [
      {
        label: '不能吃的食物',
        text: '哪些食物是{pet}絕對不能吃的？'
      },
      {
        label: '一天熱量',
        text: '{pet}一天要吃多少熱量才剛好？'
      },
      {
        label: '零食份量',
        text: '{pet}一天可以吃多少零食？'
      },
      {
        label: '幼犬餵食',
        species: 'dog',
        text: '幼犬一天要餵幾餐？'
      },
      {
        label: '幼貓餵食',
        species: 'cat',
        text: '幼貓要吃什麼，一天餵幾次？'
      },
      {
        label: '貓吃狗糧',
        species: 'cat',
        text: '可以給貓吃狗飼料嗎？'
      },
      {
        label: '喝水',
        text: '{pet}一天要喝多少水？要怎麼讓牠多喝水？'
      },
      {
        label: '是否過胖',
        text: '怎麼知道{pet}有沒有過胖？'
      },
      {
        label: '自己煮飯',
        text: '可以自己煮{pet}的飯嗎？營養夠嗎？'
      }
    ]
  },

  {
    id: 'prevention',
    label: '預防保健',
    icon: '💉',
    prompts: [
      {
        label: '疫苗',
        text: '{pet}需要打哪些疫苗？'
      },
      {
        label: '狂犬病疫苗',
        text: '台灣的{pet}需要每年打狂犬病疫苗嗎？'
      },
      {
        label: '驅蟲',
        text: '{pet}需要定期驅蟲嗎？幼小的{pet}怎麼驅蟲？'
      },
      {
        label: '心絲蟲',
        text: '{pet}需要吃心絲蟲預防藥嗎？'
      },
      {
        label: '刷牙',
        text: '需要幫{pet}刷牙嗎？怎麼刷？'
      },
      {
        label: '結紮',
        text: '{pet}幾歲適合結紮？'
      },
      {
        label: '健康檢查',
        text: '{pet}多久要帶去健康檢查一次？'
      },
      {
        label: '老年照護',
        text: '老年{pet}要注意哪些慢性病？'
      }
    ]
  },

  {
    id: 'newowner',
    label: '新手入門',
    icon: '🐾',
    prompts: [
      {
        label: '養狗要準備什麼',
        species: 'dog',
        text: '第一次養狗，要有哪些心理準備和花費？'
      },
      {
        label: '幼犬如廁訓練',
        species: 'dog',
        text: '幼犬要怎麼訓練上廁所？'
      },
      {
        label: '幼犬社會化',
        species: 'dog',
        text: '幼犬要怎麼做社會化？疫苗還沒打完可以出門嗎？'
      },
      {
        label: '籠子訓練',
        species: 'dog',
        text: '狗籠要怎麼訓練？可以把牠關起來嗎？'
      },
      {
        label: '洗澡梳毛',
        species: 'dog',
        text: '要怎麼幫狗洗澡、梳毛？'
      },
      {
        label: '運動量',
        species: 'dog',
        text: '狗需要多少運動？運動太多會怎樣？'
      },
      {
        label: '幼貓第一週',
        species: 'cat',
        text: '剛帶幼貓回家，第一週要做什麼？'
      },
      {
        label: '貓砂盆',
        species: 'cat',
        text: '貓砂盆要放幾個、放在哪裡？'
      },
      {
        label: '貓抓沙發',
        species: 'cat',
        text: '貓一直抓沙發怎麼辦？要怎麼幫牠剪指甲？'
      },
      {
        label: '貓能出門嗎',
        species: 'cat',
        text: '貓可以放出門嗎？'
      },
      {
        label: '有毒植物',
        species: 'cat',
        text: '家裡有哪些植物對貓有毒？'
      },
      {
        label: '寵物晶片',
        text: '寵物晶片是什麼？需要登記嗎？'
      }
    ]
  }
]

// 其他物種（兔子、魚…）：知識庫目前只有狗貓的資料，維持原本的通用問題
const GENERIC_PROMPTS = [
  { label: '食慾不振', text: '最近食慾不振，不太想吃東西，可能的原因是什麼？' },
  { label: '嘔吐', text: '今天嘔吐了幾次，需要就醫嗎？' },
  { label: '腹瀉', text: '排便異常，糞便很稀，該怎麼辦？' },
  { label: '精神不佳', text: '精神很差，一直在睡覺，比平常安靜很多。' },
  { label: '皮膚問題', text: '皮膚出現紅疹或一直在抓癢，是過敏嗎？' },
  { label: '咳嗽', text: '一直在咳嗽或打噴嚏，是感冒嗎？' }
]

// 取得某個物種要顯示的類別與問題（已把 {pet} 換成「狗」或「貓」）
export function getQuickPromptCategories(species) {
  if (species !== 'dog' && species !== 'cat') {
    return [
      {
        id: 'generic',
        label: '常見問題',
        icon: '🩺',
        prompts: GENERIC_PROMPTS
      }
    ]
  }

  const petWord = species === 'dog' ? '狗' : '貓'

  return QUICK_PROMPT_CATEGORIES
    .map(category => ({
      ...category,
      prompts: category.prompts
        .filter(p => !p.species || p.species === species)
        .map(p => ({
          label: p.label,
          text: p.text.replaceAll('{pet}', petWord)
        }))
    }))
    .filter(category => category.prompts.length > 0)
}
