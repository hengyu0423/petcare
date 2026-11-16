-- =====================================================
-- 讓 AI 依「某則提問」建立的健康紀錄，記住是哪一則提問產生的
--
-- 目的：在健康諮詢刪除／重新編寫提問時，能精準連同
--       飲食管理、週報、通知裡的健康提醒一起移除。
--
-- 沒有套用這個檔案時，後端會退回「用時間區間猜」的舊行為：
-- 重新編寫過的提問，AI 回覆的時間會被排在原提問之後（+1ms），
-- 但健康紀錄是「現在」才建立的，落在時間區間外 → 提醒刪不掉。
--
-- 可重複執行（IF NOT EXISTS），不會影響現有資料。
-- =====================================================

ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS consultation_ids integer[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_health_records_consultation_ids
  ON health_records USING GIN (consultation_ids);
