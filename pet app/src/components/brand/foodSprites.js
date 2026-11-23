// 食物分類的像素圖示（16×16）。每列用「字元+數量」描述，例如 'o2 .3 l1'。
// 列寬不是 16 時會自動補齊／截斷，不會讓畫面壞掉。

export function T(spec) {
  let row = ''
  spec.trim().split(/\s+/).forEach(tok => { row += tok[0].repeat(parseInt(tok.slice(1), 10) || 0) })
  return row.length >= 16 ? row.slice(0, 16) : row + '.'.repeat(16 - row.length)
}
// 垂直置中補到 16 列
export function fit(specs) {
  const rows = specs.map(T)
  const top = Math.floor((16 - rows.length) / 2)
  const blank = '.'.repeat(16)
  return [...Array(top).fill(blank), ...rows, ...Array(16 - rows.length - top).fill(blank)]
}

export const FOOD_SPECS = {
  // 乾糧：一碗飼料
  dry: [
    '.6 o4 .6',
    '.4 o2 l1 o3 l1 o1 .4',
    '.3 o3 l1 o2 l1 o3 .3',
    '.2 r12 .2',
    '.2 g12 .2',
    '.3 g10 .3',
    '.3 g1 h2 g7 .3',
    '.4 g8 .4',
    '.5 d6 .5'
  ],
  // 濕食：罐頭
  wet: [
    '.4 m8 .4',
    '.3 m1 s8 m1 .3',
    '.3 b1 h1 b8 .3',
    '.3 b1 h1 b8 .3',
    '.3 b1 y8 b1 .3',
    '.3 b1 y3 d2 y3 b1 .3',
    '.3 b1 y8 b1 .3',
    '.3 b1 h1 b8 .3',
    '.3 b1 h1 b8 .3',
    '.3 m1 b8 m1 .3',
    '.4 m8 .4'
  ],
  // 零食：骨頭
  snack: [
    '.1 w3 .8 w3 .1',
    'w5 .6 w5',
    'w4 l8 w4',
    'w16',
    'w4 e8 w4',
    'w5 .6 w5',
    '.1 w3 .8 w3 .1'
  ],
  // 其他：雞腿
  other: [
    '.5 d6 .5',
    '.3 d2 r6 d2 .3',
    '.2 d1 r2 h2 r6 d1 .2',
    '.2 d1 r10 d1 .2',
    '.2 d1 r10 d1 .2',
    '.3 d2 r6 d2 .3',
    '.5 d2 r2 d2 .5',
    '.6 d1 r2 d1 .6',
    '.7 n2 .7',
    '.5 n2 .2 n2 .5'
  ]
}

export const FOOD_PAL = {
  dry: { o: '#C98A4B', l: '#E8B576', r: '#6BA484', g: '#2C5A43', h: '#4E8A6B', d: '#1F4230' },
  wet: { m: '#B9C2C8', s: '#E6EAEE', b: '#4F93A8', h: '#7FBBCB', y: '#F5C04A', d: '#8A5A3A' },
  snack: { w: '#E8B576', l: '#F6D9A8', e: '#C98A4B' },
  other: { d: '#8A3F22', r: '#C0643E', h: '#E08E62', n: '#F6E9CF' }
}

export const FOOD_SPRITES = Object.fromEntries(
  Object.entries(FOOD_SPECS).map(([k, specs]) => [k, fit(specs)])
)

// 檢查用：回傳寬度不是 16、或用到沒有配色的字元
export function lintFoodSprites() {
  const problems = []
  Object.entries(FOOD_SPECS).forEach(([k, specs]) => {
    specs.forEach((spec, i) => {
      const sum = spec.trim().split(/\s+/).reduce((n, t) => n + (parseInt(t.slice(1), 10) || 0), 0)
      if (sum !== 16) problems.push(`${k} row ${i}: width ${sum} -> "${spec}"`)
      spec.trim().split(/\s+/).forEach(t => {
        if (t[0] !== '.' && !FOOD_PAL[k][t[0]]) problems.push(`${k} row ${i}: no color for "${t[0]}"`)
      })
    })
  })
  return problems
}
