// PawCare 物種圖示：扁平手繪風（與吉祥物「阿橘」同一語言）
// 每個物種一個低飽和暖色，圓臉 + 圓眼 + 極簡幾何
const SPECIES = {
  cat: {
    bg: '#FDE8CE',
    icon: (
      <>
        <path d="M13 16 10 5.5 21.5 12Z" fill="#F0A04B" />
        <path d="M35 16 38 5.5 26.5 12Z" fill="#F0A04B" />
        <path d="M13.6 13 12 8.2 17.8 11.6Z" fill="#F7C9A0" />
        <path d="M34.4 13 36 8.2 30.2 11.6Z" fill="#F7C9A0" />
        <circle cx="24" cy="26" r="13" fill="#F0A04B" />
        <path d="M20 14.5h4M24 14.5h0" stroke="#D97B34" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18.5" cy="25" r="1.9" fill="#2B2018" />
        <circle cx="29.5" cy="25" r="1.9" fill="#2B2018" />
        <path d="M24 32.2c-1 0-1.7.7-1.7 1.4 0 .9 1 1.4 1.7 1.4s1.7-.5 1.7-1.4c0-.7-.7-1.4-1.7-1.4Z" fill="#C96F4A" />
        <path d="M19 29.5 15.5 29M19 33 15.5 34.5M29 29.5 32.5 29M29 33l3.5 1.5" stroke="#D97B34" strokeWidth="1.3" strokeLinecap="round" />
      </>
    )
  },
  dog: {
    bg: '#F8ECD4',
    icon: (
      <>
        {/* 垂耳：明顯垂到下巴兩側，是狗的關鍵特徵 */}
        <rect x="6.5" y="14" width="8" height="19" rx="4" fill="#A06B28" transform="rotate(7 10.5 23)" />
        <rect x="33.5" y="14" width="8" height="19" rx="4" fill="#A06B28" transform="rotate(-7 37.5 23)" />
        {/* 頭 */}
        <ellipse cx="24" cy="25" rx="12.5" ry="11.5" fill="#D9A441" />
        <circle cx="17.5" cy="22.5" r="2" fill="#2B2018" />
        <circle cx="30.5" cy="22.5" r="2" fill="#2B2018" />
        {/* 口鼻部 + 大鼻子 */}
        <ellipse cx="24" cy="30.5" rx="6.8" ry="5" fill="#FDE8CE" />
        <ellipse cx="24" cy="28.6" rx="2.6" ry="1.8" fill="#2B2018" />
        <path d="M24 30.4v2.4M21 33.6c1 .9 2 1.3 3 1.3s2-.4 3-1.3" stroke="#8A5A3A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  },
  bird: {
    bg: '#FCF3CF',
    icon: (
      <>
        <circle cx="24" cy="26" r="12" fill="#F5C04A" />
        <path d="M17 15c1.4-2.4 3.4-3.4 5.4-3.4" stroke="#E8853D" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 18v-2" stroke="#E8853D" strokeWidth="2" strokeLinecap="round" />
        <path d="M31 15c-1.4-2.4-3.4-3.4-5.4-3.4" stroke="#E8853D" strokeWidth="2" strokeLinecap="round" />
        <circle cx="19" cy="23.5" r="1.9" fill="#2B2018" />
        <circle cx="29" cy="23.5" r="1.9" fill="#2B2018" />
        <path d="M24 29.5 21 33.5h6L24 29.5Z" fill="#E8853D" />
        <path d="M13 32c4 2.5 18 2.5 22 0" stroke="#E8853D" strokeWidth="2" strokeLinecap="round" />
      </>
    )
  },
  rabbit: {
    bg: '#FDE9DC',
    icon: (
      <>
        <ellipse cx="17.5" cy="11" rx="4.4" ry="8.4" fill="#F7C9A0" transform="rotate(-10 17.5 11)" />
        <ellipse cx="30.5" cy="11" rx="4.4" ry="8.4" fill="#F7C9A0" transform="rotate(10 30.5 11)" />
        <ellipse cx="17.5" cy="11.6" rx="2" ry="5" fill="#F2A0A0" opacity="0.7" transform="rotate(-10 17.5 11.6)" />
        <ellipse cx="30.5" cy="11.6" rx="2" ry="5" fill="#F2A0A0" opacity="0.7" transform="rotate(10 30.5 11.6)" />
        <circle cx="24" cy="29" r="11.5" fill="#F7C9A0" />
        <circle cx="19.2" cy="27.5" r="1.8" fill="#2B2018" />
        <circle cx="28.8" cy="27.5" r="1.8" fill="#2B2018" />
        <path d="M24 33.5c-1.1 0-1.9.8-1.9 1.6 0 1 1.1 1.5 1.9 1.5s1.9-.5 1.9-1.5c0-.8-.8-1.6-1.9-1.6Z" fill="#C96F4A" />
      </>
    )
  },
  fish: {
    bg: '#E3F2F5',
    icon: (
      <>
        <path d="M34 24c5-6 5-11 5-11s-6 0-9.5 4.5" fill="#4F93A8" />
        <path d="M34 24c5 6 5 11 5 11s-6 0-9.5-4.5" fill="#4F93A8" />
        <ellipse cx="19" cy="24" rx="12" ry="9" fill="#6FB7C9" />
        <path d="M14 17.5 19 12l3 5.5" fill="#4F93A8" />
        <circle cx="14.5" cy="22" r="1.9" fill="#173E4C" />
        <circle cx="15.2" cy="21.2" r="0.6" fill="#FFFFFF" />
        <path d="M11 28c2.5 1.4 4.5 1.4 7 0" stroke="#173E4C" strokeWidth="1.4" strokeLinecap="round" />
      </>
    )
  },
  other: {
    bg: '#EDF3EC',
    icon: (
      <>
        <ellipse cx="24" cy="30" rx="8.5" ry="6.4" fill="#2C5A43" />
        <circle cx="13.5" cy="19.5" r="3.2" fill="#2C5A43" />
        <circle cx="20" cy="14.5" r="3.2" fill="#2C5A43" />
        <circle cx="27.5" cy="14.5" r="3.2" fill="#2C5A43" />
        <circle cx="34" cy="19.5" r="3.2" fill="#2C5A43" />
      </>
    )
  }
}

export default function PetIcon({ species, size = 44, className = '' }) {
  const entry = SPECIES[species] || SPECIES.other
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-hidden="true"
      className={className}
    >
      <circle cx="24" cy="24" r="23" fill={entry.bg} />
      {entry.icon}
    </svg>
  )
}
