// PawCare 像素风素材（Kizupi 式像素插畫）：場景、貓、狗都用程式畫出來，不需要圖檔。
// 每個「像素」= 1 個 SVG 單位；場景是可水平無縫重複的 192×64 圖塊。

const R = (c, n) => c.repeat(n)

// ---------- 角色（16×16）----------
// o 橘  d 深橘  c 奶油  p 粉  k 墨  w 白  f 松綠項圈  y 金鈴鐺
export const CAT = [
  R('.', 16),
  '..dd' + R('.', 8) + 'dd..',
  '..dpd' + R('.', 6) + 'dpd..',
  '..d' + 'oooo' + 'ss' + 'oooo' + 'd..',
  '.d' + R('o', 12) + 'd.',
  '.d' + 'oo' + 'kw' + 'oooo' + 'kw' + 'oo' + 'd.',
  '.d' + 'oo' + 'kk' + 'oooo' + 'kk' + 'oo' + 'd.',
  '.d' + 'ooo' + 'cc' + 'pp' + 'cc' + 'ooo' + 'd.',
  '.d' + 'oo' + 'ccc' + 'kk' + 'ccc' + 'oo' + 'd.',
  '...d' + R('o', 8) + 'd...',
  '..d' + R('f', 10) + 'd..',
  '..d' + 'oo' + 'cc' + 'yy' + 'cc' + 'oo' + 'd..',
  '..d' + 'oo' + R('c', 6) + 'oo' + 'd..',
  '..d' + R('o', 10) + 'd..',
  '..dccd' + R('.', 4) + 'dccd..',
  '..dddd' + R('.', 4) + 'dddd..'
]

// g 金黃  b 耳朵褐  d 深金  c 奶油  k 墨  t 舌頭
export const DOG = [
  R('.', 16),
  R('.', 4) + R('d', 8) + R('.', 4),
  '...d' + R('g', 8) + 'd...',
  '..bd' + R('g', 8) + 'db..',
  '.bbd' + 'g' + 'kw' + 'gg' + 'kw' + 'g' + 'dbb.',
  '.bbd' + 'g' + 'kk' + 'gg' + 'kk' + 'g' + 'dbb.',
  '.bbd' + 'gg' + 'cccc' + 'gg' + 'dbb.',
  '.bbd' + 'g' + 'cc' + 'kk' + 'cc' + 'g' + 'dbb.',
  '..bd' + 'g' + R('c', 6) + 'g' + 'db..',
  '...d' + 'g' + 'cc' + 'tt' + 'cc' + 'g' + 'd...',
  '...d' + R('f', 8) + 'd...',
  '...d' + 'ggg' + 'yy' + 'ggg' + 'd...',
  '...d' + 'gg' + R('c', 4) + 'gg' + 'd...',
  '...d' + 'gg' + R('c', 4) + 'gg' + 'd...',
  '..dccd' + R('.', 4) + 'dccd..',
  '..dddd' + R('.', 4) + 'dddd..'
]

export const PAL = {
  o: '#F0A04B', d: '#C9702E', c: '#FDE8CE', p: '#F4A6A0', k: '#2B2018', w: '#FFFFFF',
  s: '#C9702E', f: '#2C5A43', y: '#F5C04A',
  // 狗
  g: '#E0AB4E', b: '#A8712C', t: '#F08A8A'
}
// 狗用另一套深色邊
export const DOG_PAL = { ...PAL, d: '#B67E2A' }

// 把像素圖轉成「橫向合併」的 rect，減少元素數
export function spriteRects(rows, pal, ox = 0, oy = 0) {
  const out = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let n = 1
      while (row[x + n] === ch) n++
      out.push({ x: ox + x, y: oy + y, w: n, h: 1, fill: pal[ch] })
      x += n
    }
  })
  return out
}

// ---------- 場景（192×64，水平可無縫重複）----------
const TREE = [
  '..ddd..',
  '.dgggd.',
  'dgglggd',
  'dglllgd',
  'dgglggd',
  '.dgggd.',
  '..ddd..',
  '...t...',
  '...t...'
]
const TREE_PAL = { d: '#2F6E3C', g: '#4E9A4F', l: '#78C468', t: '#8A5A3A' }

const CLOUD = ['....xxxx....', '..xxxxxxxx..', 'xxxxxxxxxxxx', 'ssssssssssss']
const CLOUD_PAL = { x: '#FFFDF6', s: '#E3EEDC' }

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function sceneSvg() {
  const W = 192, H = 64
  const rects = []
  const add = (x, y, w, h, fill) => rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
  const addSprite = (rows, pal, ox, oy) => spriteRects(rows, pal, ox, oy).forEach(r => add(r.x, r.y, r.w, r.h, r.fill))
  const TAU = Math.PI * 2

  // 雲
  addSprite(CLOUD, CLOUD_PAL, 22, 10)
  addSprite(CLOUD, CLOUD_PAL, 104, 6)
  addSprite(CLOUD, CLOUD_PAL, 138, 20)

  // 遠景樹線（深一點的綠，頂端用棋盤格抖色做出像素毛邊）
  const far = x => 33 + Math.round(2.2 * Math.sin((TAU * x) / 96) + 1.2 * Math.sin((TAU * x) / 48 + 1))
  for (let x = 0; x < W; x++) {
    const y0 = far(x)
    add(x, y0, 1, H - y0, '#7FB665')
    add(x, y0, 1, 1, (x >> 1) % 2 ? '#6AA356' : '#7FB665')
    add(x, y0 + 1, 1, 1, '#6AA356')
  }
  // 中景草丘
  const mid = x => 42 + Math.round(1.6 * Math.sin((TAU * x) / 64 + 2))
  for (let x = 0; x < W; x++) {
    const y0 = mid(x)
    add(x, y0, 1, H - y0, '#94C874')
    add(x, y0, 1, 1, '#A6D686')
  }
  // 前景草地
  const front = x => 50 + Math.round(0.9 * Math.sin((TAU * x) / 48))
  for (let x = 0; x < W; x++) {
    const y0 = front(x)
    add(x, y0, 1, H - y0, '#9AD07A')
    add(x, y0, 1, 1, '#B3E08F')
  }
  // 草地上的小斑點（固定亂數，每次畫面一致）
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(hash(i) * W)
    const y = 52 + Math.floor(hash(i + 99) * 11)
    add(x, y, hash(i + 7) > 0.6 ? 2 : 1, 1, hash(i + 3) > 0.5 ? '#B8E494' : '#86BD69')
  }

  // 樹
  ;[26, 72, 120, 158].forEach(x => addSprite(TREE, TREE_PAL, x, mid(x + 3) - 7))
  // 花
  const flowers = [[12, '#F29CB8'], [44, '#F5C04A'], [62, '#FFFFFF'], [88, '#F29CB8'], [110, '#F5C04A'], [132, '#FFFFFF'], [150, '#F29CB8'], [180, '#F5C04A']]
  flowers.forEach(([x, c], i) => {
    const y = 55 + (i % 3) * 3
    add(x, y + 1, 1, 3, '#4E9A4F')
    add(x, y, 1, 1, c)
    if (i % 2 === 0) { add(x - 1, y, 1, 1, c); add(x + 1, y, 1, 1, c); add(x, y - 1, 1, 1, c); add(x, y, 1, 1, '#F5C04A') }
  })
  // 小石頭
  add(82, 58, 3, 1, '#B9BFB2'); add(81, 59, 5, 1, '#9EA595'); add(82, 60, 3, 1, '#9EA595')
  // 小草叢
  ;[34, 98, 140, 170].forEach((x, i) => {
    const y = 58 + (i % 2) * 2
    add(x, y, 1, 2, '#4E9A4F'); add(x + 2, y - 1, 1, 3, '#4E9A4F'); add(x + 1, y + 1, 1, 1, '#4E9A4F')
  })

  // 垂下來的藤蔓（最上層）
  const vines = [[8, 18], [30, 10], [52, 14], [96, 9], [118, 16], [146, 12], [176, 20]]
  vines.forEach(([x, len]) => {
    add(x, 0, 1, len, '#3D7A45')
    for (let y = 3; y < len; y += 4) {
      const side = (y / 4) % 2 === 0 ? -1 : 1
      add(x + side, y, 1, 2, '#5EA34F')
    }
    add(x, len, 1, 1, '#5EA34F')
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects.join('')}</svg>`
}

// 太陽（單獨一顆，不跟著場景圖塊重複）：13×13
export function sunRects() {
  const out = []
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const d = x * x + y * y
    if (d <= 20) out.push({ x: x + 6, y: y + 6, fill: '#F8D56B' })
    else if (d <= 34) out.push({ x: x + 6, y: y + 6, fill: 'rgba(248,213,107,0.3)' })
  }
  return out
}


// =====================================================================
// 像素頭像（PetIcon 用）：16×16，依物種與毛色換配色
// =====================================================================
const patch = (rows, edits) => {
  const g = rows.map(r => r.split(''))
  edits.forEach(([y, x, n, ch]) => { for (let i = 0; i < n; i++) g[y][x + i] = ch })
  return g.map(r => r.join(''))
}
const swapChars = (rows, from, to) => rows.map(r => r.split(from).join(to))

// ---- 貓（5 種毛色）----
const catPal = (o, d, c, p = '#F4A6A0', stripe = true) => ({ ...PAL, o, d, c, p, s: stripe ? d : o })
export const CAT_COATS = {
  orange: { rows: CAT, pal: catPal('#F0A04B', '#C9702E', '#FDE8CE'), bg: ['#FFF3E0', '#FBDDB6'] },
  black: { rows: CAT, pal: catPal('#4B4B55', '#2F2F37', '#8C8C97', '#C98A8A', false), bg: ['#F3F0EA', '#DAD5CB'] },
  white: { rows: CAT, pal: catPal('#FBF7F0', '#CFC3AE', '#FFFFFF', '#F4A6A0', false), bg: ['#F3F8F7', '#D8E8E4'] },
  gray: { rows: CAT, pal: catPal('#9CA5AF', '#6F7984', '#E6EAEE'), bg: ['#EFF3F6', '#D3DDE6'] },
  calico: {
    rows: patch(CAT, [[3, 3, 4, 'a'], [4, 2, 4, 'a'], [5, 2, 2, 'a'], [3, 11, 3, 'z'], [4, 12, 2, 'z'], [5, 12, 2, 'z']]),
    pal: { ...catPal('#FBF7F0', '#CFC3AE', '#FFFFFF', '#F4A6A0', false), a: '#E8913F', z: '#4B4B55' },
    bg: ['#FFF5E8', '#F6DDBD']
  }
}

// ---- 狗：垂耳（金毛/棕/白）與立耳（柴/黑/哈士奇）----
const DOG_UP = [
  R('.', 16),
  '..bb' + R('.', 8) + 'bb..',
  '..bbd' + R('g', 6) + 'dbb..',
  '..bd' + R('g', 8) + 'db..',
  '...d' + 'g' + 'kw' + 'gg' + 'kw' + 'g' + 'd...',
  '...d' + 'g' + 'kk' + 'gg' + 'kk' + 'g' + 'd...',
  '...d' + 'gg' + 'cccc' + 'gg' + 'd...',
  '...d' + 'g' + 'cc' + 'kk' + 'cc' + 'g' + 'd...',
  '...d' + 'g' + R('c', 6) + 'g' + 'd...',
  '...d' + 'g' + 'cc' + 'tt' + 'cc' + 'g' + 'd...',
  ...DOG.slice(10)
]
const dogPal = (g, b, d, c) => ({ ...DOG_PAL, g, b, d, c })
export const DOG_COATS = {
  golden: { rows: DOG, pal: dogPal('#E0AB4E', '#A8712C', '#B67E2A', '#FBE6C4'), bg: ['#FFF5DC', '#F7DFA8'] },
  brown: { rows: DOG, pal: dogPal('#9A6A44', '#6F4527', '#6F4527', '#E9CFA9'), bg: ['#F9EDE0', '#E8CFB3'] },
  white: { rows: DOG, pal: dogPal('#FBF6EE', '#D9C9AE', '#CBBBA0', '#FFFFFF'), bg: ['#F4F7FA', '#D8E2EC'] },
  shiba: { rows: DOG_UP, pal: dogPal('#E39A52', '#C9702E', '#B96A2E', '#FFF3E2'), bg: ['#FFF1E0', '#F8D7B0'] },
  black: { rows: DOG_UP, pal: dogPal('#4A4A52', '#2E2E35', '#2E2E35', '#C99B6B'), bg: ['#F0EEEA', '#D8D3CB'] },
  husky: {
    rows: patch(DOG_UP, [[2, 5, 6, 'm'], [3, 4, 8, 'm'], [3, 7, 2, 'c'], [4, 4, 1, 'c'], [4, 11, 1, 'c'], [5, 4, 1, 'c'], [5, 11, 1, 'c']]),
    pal: { ...dogPal('#8E98A6', '#5E6875', '#5E6875', '#FFFFFF'), m: '#6F7A88' },
    bg: ['#EEF3F9', '#D3DFEC']
  }
}

// ---- 兔（用貓頭改長耳）----
const RABBIT_ROWS = [
  '...dd' + R('.', 6) + 'dd...',
  '..dpd' + R('.', 6) + 'dpd..',
  '..dpd' + R('.', 6) + 'dpd..',
  ...swapChars(CAT.slice(3, 8), 's', 'o'),
  CAT[8].replace('kk', 'cc'),
  ...CAT.slice(9)
]
export const RABBIT_SPRITE = {
  rows: RABBIT_ROWS,
  pal: { ...PAL, o: '#F8D4B2', d: '#D9A57A', c: '#FFF3E4', p: '#F4A6A6', s: '#F8D4B2' },
  bg: ['#FFF0E5', '#F8D6BF']
}

// ---- 小鳥（黃色小雞：貓頭 + 羽毛 + 橘色喙）----
const BIRD_ROWS = [
  R('.', 16),
  R('.', 7) + 'dd' + R('.', 7),
  R('.', 7) + 'dd' + R('.', 7),
  ...swapChars(CAT.slice(3, 8), 's', 'o'),
  CAT[8].replace('kk', 'cc'),
  ...CAT.slice(9)
].slice(0, 16)
export const BIRD_SPRITE = {
  rows: BIRD_ROWS,
  pal: { ...PAL, o: '#F6C447', d: '#D99A1E', c: '#FDEFB8', p: '#EE8A3C', s: '#F6C447' },
  bg: ['#FFF9DE', '#FAE9A6']
}

// ---- 魚、爪印：用橢圓程式生成 ----
function blank() { return Array.from({ length: 16 }, () => Array(16).fill('.')) }
function ellipse(g, cx, cy, rx, ry, fill, outline) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
    if (d <= 1) g[y][x] = fill
  }
  if (outline) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (g[y][x] !== fill) continue
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy
        return nx < 0 || ny < 0 || nx > 15 || ny > 15 || g[ny][nx] === '.'
      })
      if (edge) g[y][x] = outline
    }
  }
}
const toRows = g => g.map(r => r.join(''))

function fishRows() {
  const g = blank()
  // 尾巴
  ;[[12, 7], [13, 6], [13, 7], [13, 8], [14, 5], [14, 6], [14, 7], [14, 8], [14, 9]].forEach(([x, y]) => { g[y][x] = 'd' })
  ellipse(g, 7, 8, 6.2, 4.4, 'b', 'd')
  // 肚皮、背鰭、眼睛、腮紅
  for (let x = 3; x < 11; x++) if (g[10][x] === 'b') g[10][x] = 'c'
  for (let x = 4; x < 10; x++) if (g[9][x] === 'b') g[9][x] = 'c'
  ;[[6, 3], [7, 3], [8, 3], [7, 2]].forEach(([x, y]) => { if (g[y][x] === '.' || g[y][x] === 'b') g[y][x] = 'd' })
  g[7][3] = 'k'; g[7][4] = 'w'; g[6][3] = 'k'
  g[9][2] = 'p'; g[9][3] = 'p'
  g[8][9] = 'd'; g[9][9] = 'd'
  return toRows(g)
}
export const FISH_SPRITE = {
  rows: fishRows(),
  pal: { b: '#72BBCD', d: '#4F93A8', c: '#C4E8EF', k: '#173E4C', w: '#FFFFFF', p: '#F4A6A0' },
  bg: ['#EBF8FB', '#C6E6EE']
}

function pawRows() {
  const g = blank()
  ellipse(g, 8, 11.3, 4.1, 3.3, 'g', 'd')
  ellipse(g, 2.3, 7.8, 1.4, 1.8, 'g', 'd')
  ellipse(g, 5.6, 4.4, 1.5, 2.0, 'g', 'd')
  ellipse(g, 10.4, 4.4, 1.5, 2.0, 'g', 'd')
  ellipse(g, 13.7, 7.8, 1.4, 1.8, 'g', 'd')
  g[10][6] = 'h'; g[10][7] = 'h'; g[11][5] = 'h'
  return toRows(g)
}
export const PAW_SPRITE = {
  rows: pawRows(),
  pal: { g: '#3F7A5B', d: '#2C5A43', h: '#6BA484' },
  bg: ['#F0F6EF', '#D3E4D2']
}

// ---- 依物種 + 品種文字挑出頭像 ----
export function petSprite(species, breed = '') {
  const b = String(breed || '').toLowerCase()
  if (species === 'cat') {
    let k = 'orange'
    if (/三花|玳瑁|花貓|花猫|calico|tortie/.test(b)) k = 'calico'
    else if (/黑|black/.test(b)) k = 'black'
    else if (/白|white|布偶|ragdoll/.test(b)) k = 'white'
    else if (/灰|藍|蓝|銀|银|英短|英國短毛|俄羅斯|gray|grey|british|russian/.test(b)) k = 'gray'
    return CAT_COATS[k]
  }
  if (species === 'dog') {
    let k = 'golden'
    if (/哈士奇|husky|阿拉斯加|malamute/.test(b)) k = 'husky'
    else if (/柴|shiba|柯基|corgi|秋田|akita/.test(b)) k = 'shiba'
    else if (/貴賓|贵宾|poodle|博美|馬爾|马尔|比熊|bichon|samoyed|薩摩|萨摩|白/.test(b)) k = 'white'
    else if (/黑|牧羊|shepherd|rottweiler|羅威|罗威|doberman|杜賓|杜宾/.test(b)) k = 'black'
    else if (/泰迪|teddy|巧克力|棕|褐|臘腸|腊肠|dachshund|chocolate|brown/.test(b)) k = 'brown'
    return DOG_COATS[k]
  }
  if (species === 'rabbit') return RABBIT_SPRITE
  if (species === 'bird') return BIRD_SPRITE
  if (species === 'fish') return FISH_SPRITE
  return PAW_SPRITE
}
