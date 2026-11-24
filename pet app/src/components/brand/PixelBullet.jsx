// 像素小方塊圖示（Kizupi 卡片左上角那種）
export default function PixelBullet({ size = 14, className = 'text-lime' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 6 6" aria-hidden="true" shapeRendering="crispEdges" className={className}>
      <rect x="0" y="2" width="2" height="2" fill="currentColor" />
      <rect x="2" y="0" width="2" height="2" fill="currentColor" />
      <rect x="2" y="2" width="2" height="2" fill="currentColor" opacity="0.55" />
      <rect x="4" y="2" width="2" height="2" fill="currentColor" opacity="0.8" />
      <rect x="2" y="4" width="2" height="2" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
