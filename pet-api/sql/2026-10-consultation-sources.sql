-- AI 回覆參考來源（顯示在對話裡的「參考來源」）
-- 已於 2026-10-31 套用到 Neon（project: pet-app, branch: production）。
-- 可為空；舊訊息維持 NULL。格式：[{ slug, title, source, url }, ...]

ALTER TABLE health_consultations ADD COLUMN IF NOT EXISTS sources JSONB;
