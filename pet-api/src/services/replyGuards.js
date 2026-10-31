// ======================================================
// AI 回覆的後處理防護
//
// 模型（gpt-oss-20b）實測會直接寫出「先暫停食物 12–24 小時」這類
// 對飼主的指示，即使 prompt 與知識庫都已要求不要。
// 禁食、暫停進食屬於獸醫依個別狀況決定的處置，所以在程式端補上提醒，
// 不依賴模型自己遵守。
// ======================================================

const FASTING_PATTERN =
  /禁食|斷食|空腹|暫停(?:進食|食物|餵食|餵)|停止(?:餵食|進食|餵)|先不(?:要)?(?:餵|吃)/

const FASTING_NOTICE =
  '※ 是否需要暫停進食、暫停多久，請依獸醫的指示，不要自行決定。' +
  '幼齡寵物的嘔吐、腹瀉可能快速惡化，建議儘早就醫。'

function addFastingNotice(content) {
  const text = String(content || '')

  if (!FASTING_PATTERN.test(text)) return text
  if (text.includes(FASTING_NOTICE)) return text

  return text + '\n\n' + FASTING_NOTICE
}

module.exports = { addFastingNotice, FASTING_NOTICE }
