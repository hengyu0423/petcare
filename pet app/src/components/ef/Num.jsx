import { useEffect, useState } from 'react'

// 大數字讀數：數值出現或改變時，各位數字像讀數器一樣依序落定（約 0.6 秒）。
// 「減少動態效果」開著時直接顯示。
const stand = ch => {
    if (/\d/.test(ch)) return String(Math.floor(Math.random() * 10))
    if (/[A-Za-z]/.test(ch)) return String.fromCharCode((ch < 'a' ? 65 : 97) + Math.floor(Math.random() * 26))
    return ch
}

export default function Num({ value, ms = 600, as: Tag = 'b' }) {
    const text = String(value)
    const [spin, setSpin] = useState(null) // 轉動中的字串；null = 顯示真值

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        if (!/[0-9A-Za-z]/.test(text)) return

        let frame
        let started
        const step = now => {
            started ??= now
            const done = Math.min(1, (now - started) / ms)
            const locked = Math.floor(done * text.length)
            setSpin(done < 1 ? text.slice(0, locked) + [...text.slice(locked)].map(stand).join('') : null)
            if (done < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame)
    }, [text, ms])

    // 轉動中的亂數字只給眼睛看（aria-hidden）；讀屏軟體永遠讀到真正的值。
    // 朗讀用的文字放在 <b> 外面：套件的 .ef-figs span 會把裡面的 span 縮成小字，不能包在數字裡。
    return (
        <>
            <Tag aria-hidden="true">{spin ?? text}</Tag>
            <span className="pc-sr">{text}</span>
        </>
    )
}