import { useEffect } from 'react'

// ======================================================
// PawCare 的 Endfield 設計變體（變體卡）
//   產品：PawCare 寵物生活管理。每天打開看一眼，要溫暖、好讀，也要有資料的精準感。
//   強調色 lime     ← 呼應 PawCare 原本的綠，但是 Endfield 規定裡的那一種螢光綠
//   紙色   warm     ← 家、寵物，比中性灰白更暖
//   切角   standard
//   底紋   contours（等高線）
//   密度   standard
//   動態   full
// 強調色與紙色只在這一處設定。變體只掛在 <html> 上、而且只在登入後的畫面顯示期間；
// 登入、註冊等頁面不受影響。
// ======================================================
export const EF_VARIANT = {
    'data-ef-accent': 'lime',
    'data-ef-paper': 'warm',
    'data-ef-cut': 'standard',
    'data-ef-ground': 'contours',
    'data-ef-density': 'standard',
    'data-ef-motion': 'full'
}

export function useEfVariant() {
    useEffect(() => {
        const root = document.documentElement
        Object.entries(EF_VARIANT).forEach(([k, v]) => root.setAttribute(k, v))
        return () => Object.keys(EF_VARIANT).forEach(k => root.removeAttribute(k))
    }, [])
}