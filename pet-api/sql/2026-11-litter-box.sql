-- =====================================================
-- 貓砂盆進出紀錄（次數、平均上廁所時間、排泄狀況評估）
--
-- pet-camtwo.py 偵測到貓進入畫面 → POST /api/litter-box/enter
--                     離開畫面 → POST /api/litter-box/leave
--
-- 相機分不出尿尿或大便，離開時依停留時間推估：
--   停留 < 45 秒 → urine（尿尿）
--   停留 ≥ 45 秒 → poop（排便）
-- 可用 PATCH /api/litter-box/visits/:id 手動修正。
--
-- 這張表由程式啟動時的 initDB() 自動建立，這個檔案是給
-- 手動套用／留底用（可重複執行）。
-- =====================================================

CREATE TABLE IF NOT EXISTS litter_box_visits (
  id               BIGSERIAL PRIMARY KEY,
  camera_id        VARCHAR(50) NOT NULL DEFAULT 'cam2',
  pet_type         VARCHAR(20) NOT NULL DEFAULT 'cat',
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at        TIMESTAMPTZ,
  duration_seconds INTEGER,
  visit_type       VARCHAR(10),                  -- urine / poop
  type_source      VARCHAR(10) NOT NULL DEFAULT 'auto',  -- auto / manual
  date             DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei')::date,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE litter_box_visits
  ADD COLUMN IF NOT EXISTS visit_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS type_source VARCHAR(10) NOT NULL DEFAULT 'auto';

CREATE INDEX IF NOT EXISTS idx_litter_box_visits_cam_date
ON litter_box_visits(camera_id, entered_at DESC);

-- 常用查詢：今天的尿尿／排便次數與平均停留時間
-- SELECT
--   COUNT(*) FILTER (WHERE visit_type = 'urine') AS urine,
--   COUNT(*) FILTER (WHERE visit_type = 'poop')  AS poop,
--   ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'urine')) AS avg_urine_sec,
--   ROUND(AVG(duration_seconds) FILTER (WHERE visit_type = 'poop'))  AS avg_poop_sec
-- FROM litter_box_visits
-- WHERE camera_id = 'cam2'
--   AND date = (NOW() AT TIME ZONE 'Asia/Taipei')::date;
