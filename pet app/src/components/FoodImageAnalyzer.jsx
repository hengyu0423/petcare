import { useState, useRef } from "react"
import { api } from "../lib/api" // ✅ 修正 #3：改用共用 api 實例，不再寫死 localhost

export default function FoodImageAnalyzer() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // ✅ 修正 #4：追蹤 objectURL 以便釋放記憶體
  const prevUrlRef = useRef("")

  // 選圖片
  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImage(file)
    setError("")
    setResult(null)

    // ✅ 修正 #4：釋放前一張預覽的記憶體
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    prevUrlRef.current = url
    setPreview(url)
  }

  // 呼叫 AI
  const analyzeFood = async () => {
    if (!image) {
      alert("請選擇圖片")
      return
    }

    const formData = new FormData()
    formData.append("image", image)

    setLoading(true)
    setError("")

    try {
      // ✅ 修正 #3：改用共用 api 實例，自動帶 baseURL 和 token
      const { data } = await api.post("/food/ai-analyze-image", formData)

      if (!data.success) {
        throw new Error(data.error || "分析失敗")
      }

      const payload = data?.data || {}
      setResult({
        food_name:
          payload.food_name ||
          payload.image_food_name ||
          payload.foodName ||
          "未知食物",
        image_food_name:
          payload.image_food_name ||
          payload.food_name ||
          payload.foodName ||
          "未知食物",
        calories_per_100g: payload.calories_per_100g ?? 0,
        protein_pct: payload.protein_pct ?? 0,
        fat_pct: payload.fat_pct ?? 0,
        carb_pct: payload.carb_pct ?? 0,
        fiber_pct: payload.fiber_pct ?? 0,
        notes:
          payload.notes ||
          `已辨識為 ${payload.image_food_name || payload.food_name || "未知食物"}`
      })
    } catch (err) {
      console.error(err)
      setError(err.message || "分析失敗")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>AI 食物分析</h2>

      <input type="file" accept="image/*" onChange={handleImage} />

      {/* ✅ 修正 #5：加上 alt 屬性 */}
      {preview && (
        <img
          src={preview}
          alt="食物預覽"
          width="250"
          style={{ borderRadius: 8, marginTop: 8 }}
        />
      )}

      <button onClick={analyzeFood} disabled={loading}>
        {loading ? "分析中..." : "開始分析"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div>
          <h3>分析結果</h3>
          <p>食物：{result.food_name}</p>
          <p>熱量：{result.calories_per_100g} kcal/100g</p>
          <p>蛋白質：{result.protein_pct}%</p>
          <p>脂肪：{result.fat_pct}%</p>
          <p>碳水：{result.carb_pct}%</p>
          <p>纖維：{result.fiber_pct}%</p>
          <p>建議：{result.notes}</p>
        </div>
      )}
    </div>
  )
}