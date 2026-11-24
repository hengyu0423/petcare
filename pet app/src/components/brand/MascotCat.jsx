// PawCare 吉祥物：橘虎斑貓「阿橘」，Kizupi 式扁平可愛風（手繪 SVG）
export default function MascotCat({ size = 220, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      fill="none"
      className={className}
      role="img"
      aria-label="PawCare 吉祥物阿橘，一隻坐著的橘貓"
    >
      {/* 柔和底圓 */}
      <circle cx="110" cy="112" r="104" fill="#FBE6CB" />

      {/* 尾巴（身體後方） */}
      <path
        d="M168 168c14-6 20-22 10-32"
        stroke="#E8853D"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M172 138c4-6 5-12 2-18"
        stroke="#FDF3E3"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* 身體 */}
      <path
        d="M52 172c0-38 26-56 58-56s58 18 58 56"
        fill="#F0A04B"
      />
      {/* 胸口米白塊 */}
      <ellipse cx="110" cy="156" rx="24" ry="18" fill="#FDE8CE" />
      {/* 前爪 */}
      <rect x="88" y="160" width="16" height="14" rx="7" fill="#FDE8CE" />
      <rect x="116" y="160" width="16" height="14" rx="7" fill="#FDE8CE" />

      {/* 耳朵 */}
      <path d="M66 66 56 22 96 44Z" fill="#F0A04B" />
      <path d="M154 66 164 22 124 44Z" fill="#F0A04B" />
      <path d="M68 54 63 32 84 45Z" fill="#F7C9A0" />
      <path d="M152 54 157 32 136 45Z" fill="#F7C9A0" />

      {/* 頭 */}
      <circle cx="110" cy="86" r="46" fill="#F0A04B" />

      {/* 額頭虎斑紋 */}
      <path d="M104 46h12M97 54h9M121 54h9" stroke="#D97B34" strokeWidth="4" strokeLinecap="round" />

      {/* 眼睛（大大的閃亮眼） */}
      <ellipse cx="90" cy="88" rx="6.4" ry="7.6" fill="#2B2018" />
      <ellipse cx="130" cy="88" rx="6.4" ry="7.6" fill="#2B2018" />
      <circle cx="92.4" cy="85.4" r="2.1" fill="#FFFFFF" />
      <circle cx="132.4" cy="85.4" r="2.1" fill="#FFFFFF" />

      {/* 腮紅 */}
      <ellipse cx="74" cy="104" rx="5.4" ry="3.2" fill="#F2A0A0" opacity="0.8" />
      <ellipse cx="146" cy="104" rx="5.4" ry="3.2" fill="#F2A0A0" opacity="0.8" />

      {/* 口鼻部 */}
      <ellipse cx="110" cy="108" rx="15" ry="10" fill="#FDE8CE" />
      {/* 鼻子 */}
      <path d="M110 103.5c-2.4 0-4 1.6-4 3.1 0 2 2 3.4 4 3.4s4-1.4 4-3.4c0-1.5-1.6-3.1-4-3.1Z" fill="#C96F4A" />
      {/* 嘴巴 w */}
      <path
        d="M110 110c0 2.4-2.4 4-5 4M110 110c0 2.4 2.4 4 5 4"
        stroke="#8A5A3A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 鬍鬚 */}
      <path d="M62 100l-18-3M63 108l-18 2M158 100l18-3M157 108l18 2" stroke="#D97B34" strokeWidth="1.6" strokeLinecap="round" />

      {/* 項圈 + 金鈴鐺 */}
      <path d="M76 122c12 8 56 8 68 0" stroke="#2C5A43" strokeWidth="7" strokeLinecap="round" />
      <circle cx="110" cy="131" r="6" fill="#F5C04A" stroke="#D9A441" strokeWidth="1.5" />
      <path d="M106.5 131h7" stroke="#8A5A00" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
