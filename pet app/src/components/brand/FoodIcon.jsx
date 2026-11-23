import PixelIcon from './PixelIcon'

// 食物分類的像素圖示：dry 乾糧／wet 濕食／snack 零食／其他
export default function FoodIcon({ category, size = 34, className = '' }) {
  const name = ['dry', 'wet', 'snack'].includes(category) ? category : 'other'
  return <PixelIcon name={name} size={size} className={className} />
}
