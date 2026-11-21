-- =====================================================
-- 清掉貓砂盆的誤判紀錄（人走過去、開關燈造成的短紀錄）
--
-- 舊版 pet-camtwo.py 只要有一幀偵測到貓就建立紀錄，
-- 所以資料庫裡会有一些停留 0～3 秒、甚至沒有結束時間的記錄。
-- 這些都被推估成 urine（< 45 秒），會讓尿尿次數偏高。
--
-- 新的 pet-camtwo.py 已改為「連續停留 ≥ 6 秒」才建立紀錄，
-- 這個檔案只用來清掉之前已經存進去的雜訊。
-- =====================================================

-- 1) 先看有哪些明顯是誤判的紀錄（不會改動資料）
SELECT
  id,
  camera_id,
  entered_at,
  exited_at,
  duration_seconds,
  visit_type,
  date
FROM litter_box_visits
WHERE camera_id = 'cam2'
  AND type_source = 'auto'
  AND (
    -- 停留時間短到不像真的上過廁所
    (exited_at IS NOT NULL AND duration_seconds < 6)
    -- 或沒有正常收到 leave（程式當掉、斷線留下的空紀錄）
    OR (exited_at IS NULL AND entered_at < NOW() - INTERVAL '30 minutes')
  )
ORDER BY entered_at DESC;

-- 2) 確認無誤後再取消註解執行（手動改過類型 type_source = 'manual' 的記錄不會被刪）
-- DELETE FROM litter_box_visits
-- WHERE camera_id = 'cam2'
--   AND type_source = 'auto'
--   AND (
--     (exited_at IS NOT NULL AND duration_seconds < 6)
--     OR (exited_at IS NULL AND entered_at < NOW() - INTERVAL '30 minutes')
--   );

-- 3) 清完後重新確認今天的統計
-- SELECT
--   COUNT(*)                                              AS visits,
--   COUNT(*) FILTER (WHERE visit_type = 'urine')          AS urine,
--   COUNT(*) FILTER (WHERE visit_type = 'poop')           AS poop,
--   ROUND(AVG(duration_seconds))                          AS avg_seconds
-- FROM litter_box_visits
-- WHERE camera_id = 'cam2'
--   AND date = (NOW() AT TIME ZONE 'Asia/Taipei')::date;
