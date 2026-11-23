// 依食物名稱猜分類，用來挑像素圖示與底色（今日計畫、餵食紀錄共用）
export const foodKind = name => {
  const n = name || ''
  if (n.includes('乾')) return 'dry'
  if (n.includes('罐') || n.includes('濕')) return 'wet'
  if (/零食|條|餅|骨|點心/.test(n)) return 'snack'
  return 'other'
}

export const KIND_TILE = {
  dry: 'bg-pine-50',
  wet: 'bg-[#e6f0f3]',
  snack: 'bg-honey-100',
  other: 'bg-cream'
}
