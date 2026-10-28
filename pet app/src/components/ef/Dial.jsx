import { useState } from 'react'

// Endfield 分段圆盘（把 skill 的 dial.js 改写成 React 元件）。
// 外圈是 N 个入口，指到哪个就在中心显示它的读数；圈内可以叠几条仪表弧。
// 样式全部在 styles/endfield/endfield.css（.ef-dial）。
//
//   <Dial
//     label="快速入口"
//     sections={[{ zh: '寵物', en: 'Pets', href: '/pets', big: 3, unit: '隻', sub: 'Mimi · Coco', alert: false }]}
//     gauges={[{ label: '今日熱量', share: 0.62 }]}
//     idle={{ label: 'Mimi', big: 1240, unit: 'kcal', sub: '今日已記錄' }}
//     onNavigate={href => navigate(href)}
//   />

const W = 300 // 圓心
const [R1, R2, GAP] = [228, 288, 1.6]

const at = (r, deg) => {
    const a = (deg * Math.PI) / 180
    return [+(W + r * Math.sin(a)).toFixed(1), +(W - r * Math.cos(a)).toFixed(1)]
}

const pt = ([x, y]) => `${x},${y}`

export default function Dial({ label, sections, gauges = [], idle, onNavigate }) {
    // null = 沒有指到任何入口，顯示 idle
    const [shown, setShown] = useState(null)
    const readout = shown ?? idle ?? sections[0]
    const step = 360 / sections.length

    return (
        <svg className="ef-dial" viewBox="0 0 600 600" role="group" aria-label={label}>
            <circle className="orbit" cx={W} cy={W} r={296} />

            {/* 圈內的三段式仪表弧 */}
            {gauges.map((g, i) => {
                const r = 140 - i * 20
                const hot = g.share > 0.85
                const share = Math.max(0.004, Math.min(1, g.share))
                const arc = len => ({
                    cx: W, cy: W, r, pathLength: 100,
                    strokeDasharray: `${len} 100`,
                    transform: `rotate(-90 ${W} ${W})`
                })
                return (
                    <g key={g.label} className={`gauge${hot ? ' is-alert' : ''}`}>
                        <circle className="track" {...arc(75)} />
                        <circle className="arc" {...arc((75 * share).toFixed(2))} />
                        {hot && <rect className="flag" x={W - 86} y={W - r - 8} width={80} height={16} />}
                        <text x={W - 10} y={W - r} textAnchor="end" dominantBaseline="central">
                            {`${g.label} ${Math.round(g.share * 100)}%`}
                        </text>
                    </g>
                )
            })}

            {sections.map((s, i) => {
                const mid = i * step
                const [a0, a1] = [mid - step / 2 + GAP, mid + step / 2 - GAP]
                const o0 = at(R2, a0), o1 = at(R2, a1), i1 = at(R1, a1), i0 = at(R1, a0)
                const l0 = at(R2 + 8, a0), l1 = at(R2 + 8, a1)
                const [bx0, by0] = at(R1 - 3, mid)
                const [bx1, by1] = at(150, mid)
                const [tx, ty] = at((R1 + R2) / 2, mid)
                const [fx, fy] = at(R2 - 14, mid + step / 3)
                const href = s.href ?? '#'

                const enter = () => setShown(s)
                const leave = () => setShown(null)

                return (
                    <a
                        key={s.zh}
                        href={href}
                        className={`seg${s.here ? ' is-here' : ''}${s.alert ? ' is-alert' : ''}`}
                        style={{ '--i': i }}
                        aria-label={`${s.zh}：${s.big}${s.unit ?? ''}`}
                        onClick={e => {
                            if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault()
                                onNavigate(href)
                            }
                        }}
                        onPointerEnter={enter}
                        onFocus={enter}
                        onPointerLeave={leave}
                        onBlur={leave}
                    >
                        <path className="lock" d={`M${pt(l0)}A${R2 + 8} ${R2 + 8} 0 0 1 ${pt(l1)}`} pathLength={100} />
                        <line className="beam" x1={bx0} y1={by0} x2={bx1} y2={by1} pathLength={100} />
                        <path className="plate" d={`M${pt(o0)}A${R2} ${R2} 0 0 1 ${pt(o1)}L${pt(i1)}A${R1} ${R1} 0 0 0 ${pt(i0)}Z`} />
                        <text className="zh" x={tx} y={ty - 4} textAnchor="middle">{s.zh}</text>
                        <text className="en" x={tx} y={ty + 13} textAnchor="middle">{s.en ?? ''}</text>
                        {s.alert && <rect className="flag" x={fx - 7} y={fy - 7} width={14} height={14} />}
                    </a>
                )
            })}

            {/* 中心：一次只顯示一個讀數 */}
            <polygon
                className="core-tag"
                points={`${W - 44},${W - 32} ${W + 44},${W - 32} ${W + 44},${W - 19} ${W + 38},${W - 13} ${W - 44},${W - 13}`}
            />
            <text className="core-label on-tag" x={W} y={W - 18} textAnchor="middle">{readout.label ?? readout.zh}</text>
            <text className="core" x={W} y={W + 30} textAnchor="middle">
                {readout.big}
                {readout.unit && <tspan className="unit" dx={5}>{readout.unit}</tspan>}
            </text>
            <text className="core-label" x={W} y={W + 54} textAnchor="middle">{readout.sub ?? ''}</text>
        </svg>
    )
}