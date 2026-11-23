// 像素圖示庫：食物分類圖示 + 空狀態用的插圖。每個圖示 16×16，
// 每列用「字元+數量」描述（'g2 .3 y1'），寬度不足會自動補齊。
import { FOOD_SPECS, FOOD_PAL, T, fit } from './foodSprites'
import { PAW_SPRITE } from './pixelArt'

const SPECS = {
  // 金幣（財務、花費）
  coin: [
    '.5 d6 .5',
    '.3 d2 g6 d2 .3',
    '.2 d1 g2 y2 g6 d1 .2',
    '.1 d1 g3 y1 g8 d1 .1',
    '.1 d1 g5 m2 g5 d1 .1',
    '.1 d1 g5 m2 g5 d1 .1',
    '.1 d1 g4 m4 g4 d1 .1',
    '.1 d1 g5 m2 g5 d1 .1',
    '.2 d1 g10 d1 .2',
    '.3 d2 g6 d2 .3',
    '.5 d6 .5'
  ],
  // 長條圖（報表）
  chart: [
    '.10 y3 .3',
    '.10 y3 .3',
    '.10 y3 .3',
    '.6 h3 .1 y3 .3',
    '.6 h3 .1 y3 .3',
    '.6 h3 .1 y3 .3',
    '.2 g3 .1 h3 .1 y3 .3',
    '.2 g3 .1 h3 .1 y3 .3',
    '.2 g3 .1 h3 .1 y3 .3',
    '.2 g3 .1 h3 .1 y3 .3',
    '.1 b14 .1'
  ],
  // 寫字板（週報、紀錄）
  note: [
    '.5 m6 .5',
    '.3 w10 .3',
    '.3 w1 p8 w1 .3',
    '.3 w1 g1 k5 p2 w1 .3',
    '.3 w1 p8 w1 .3',
    '.3 w1 g1 k5 p2 w1 .3',
    '.3 w1 p8 w1 .3',
    '.3 w1 g1 k3 p4 w1 .3',
    '.3 w1 p8 w1 .3',
    '.3 w10 .3'
  ],
  // 對話框（社群、留言）
  chat: [
    '.2 d12 .2',
    '.1 d1 b12 d1 .1',
    'd1 b14 d1',
    'd1 b14 d1',
    'd1 b4 g2 b1 g2 b1 g2 b2 d1',
    'd1 b14 d1',
    'd1 b14 d1',
    '.1 d1 b12 d1 .1',
    '.2 d2 b2 d8 .2',
    '.3 d1 b1 d1 .10',
    '.4 d1 .11'
  ],
  // 相機（監控）
  camera: [
    '.5 g3 .8',
    '.1 g11 y2 g1 .1',
    '.1 g14 .1',
    '.1 g4 m6 g4 .1',
    '.1 g3 m1 b6 m1 g3 .1',
    '.1 g3 m1 b2 h2 b2 m1 g3 .1',
    '.1 g3 m1 b6 m1 g3 .1',
    '.1 g4 m6 g4 .1',
    '.1 g14 .1',
    '.2 g12 .2'
  ],
  // 鈴鐺（通知）
  bell: [
    '.7 o2 .7',
    '.5 y6 .5',
    '.4 y8 .4',
    '.3 h1 y9 o1 .2',
    '.3 y10 .3',
    '.3 y10 .3',
    '.2 y12 .2',
    '.2 y12 .2',
    '.1 o14 .1',
    '.7 d2 .7'
  ],
  // 愛心（健康）
  heart: [
    '.2 r4 .4 r4 .2',
    '.1 r6 .2 r6 .1',
    '.1 h2 r12 .1',
    '.1 r14 .1',
    '.2 r12 .2',
    '.3 r10 .3',
    '.4 r8 .4',
    '.5 r6 .5',
    '.6 r4 .6',
    '.7 r2 .7'
  ]
}

const PAL = {
  coin: { d: '#B8841F', g: '#F5C04A', y: '#FFE08A', m: '#D9A441' },
  chart: { y: '#F5C04A', h: '#4E8A6B', g: '#2C5A43', b: '#C9BFA8' },
  note: { m: '#B9C2C8', w: '#C98A4B', p: '#FFFDF6', g: '#4E9A4F', k: '#9AA39A' },
  chat: { d: '#18301F', b: '#FFFDF6', g: '#4E9A4F' },
  camera: { g: '#2C5A43', y: '#F5C04A', m: '#B9C2C8', b: '#4F93A8', h: '#9FD0DD' },
  bell: { o: '#D9A441', y: '#F5C04A', h: '#FFE08A', d: '#8A5A00' },
  heart: { r: '#E0645A', h: '#F6A6A0' }
}

export const ICON_ROWS = {
  ...Object.fromEntries(Object.keys(FOOD_SPECS).map(k => [k, fit(FOOD_SPECS[k])])),
  ...Object.fromEntries(Object.entries(SPECS).map(([k, specs]) => [k, fit(specs)])),
  paw: PAW_SPRITE.rows
}
export const ICON_PAL = { ...FOOD_PAL, ...PAL, paw: PAW_SPRITE.pal }

// 檢查用：回傳寬度不是 16、或用到沒有配色的字元
export function lintPixelIcons() {
  const problems = []
  const all = { ...FOOD_SPECS, ...SPECS }
  Object.entries(all).forEach(([k, specs]) => {
    const pal = ICON_PAL[k]
    specs.forEach((spec, i) => {
      const toks = spec.trim().split(/\s+/)
      const sum = toks.reduce((n, t) => n + (parseInt(t.slice(1), 10) || 0), 0)
      if (sum !== 16) problems.push(`${k} row ${i}: width ${sum} -> "${spec}"`)
      toks.forEach(t => { if (t[0] !== '.' && !pal[t[0]]) problems.push(`${k} row ${i}: no color for "${t[0]}"`) })
    })
  })
  return problems
}
export { T }
