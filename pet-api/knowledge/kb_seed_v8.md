# PawCare 寵物健康知識庫 — 種子資料 v8（草稿：貓砂盆監測、飲水與排尿、行為改變，共 6 條）

> 狀態：**草稿，尚未經獸醫審閱**。
> 建立日期：2026-11-17。
> 配合老師要求補充的 AI 判斷依據：如廁頻率、如廁時間、飲水、行為。
> 本檔只含 v8 新增的 6 條（已直接寫入資料庫並補上向量）；v1～v7 仍在 kb_seed_v5.md、kb_seed_v7.md。
> 入庫用法與其他種子檔相同：`node scripts/ingest-kb.js --file knowledge/kb_seed_v8.md`（slug 已存在且內容沒變會略過）。
> 數字多來自「感測器監測」的研究參考區間，只能當提醒，不是獸醫診斷標準。

---
id: litter-box-frequency-baseline
title: 貓砂盆使用頻率：健康貓一天大約進幾次、怎麼看「變多」
species: cat
category: litter_box
related_event_types: [illness]
severity_hint: info
source: Shin et al. 2024, Journal of Veterinary Clinics 41:71-78（首爾大學，動作感測器監測 37 隻居家健康貓）；Dulaney et al. 2017, J Vet Intern Med 31:486-491（錄影計次）
source_url: https://doi.org/10.17555/jvc.2024.41.2.71
retrieved: 2026-11-17
status: draft_needs_review
note: 數字來自感測器研究的參考區間（2.5～97.5 百分位），感測器分不出尿尿或便便；已改寫成飼主能懂的說明。研究樣本以絕育貓為主、多為單貓家庭。
---
用動作感測器長期監測 37 隻居家健康貓的研究（首爾大學，2024）發現：健康貓平均每天進出貓砂盆約 3 次（中位數 3 次，95% 的健康貓落在 1～7 次之間）。這個次數包含尿尿與便便，感測器本身分不出是哪一種。

另一項用錄影計算的研究（2017）發現，健康貓平均每天排尿約 2 次，有泌尿或腎臟問題的貓約 3 次，而且飼主自己觀察到的次數，往往比實際發生的少。

幾個會影響「正常」的因素：老年貓比成貓更常進貓砂盆（平均約 4.6 次 vs 3.2 次），幼貓也偏多（約 3.8 次），公貓比母貓稍多（約 3.6 次 vs 3.2 次）。

怎麼用這些數字：一天超過約 7 次，已超出該研究健康貓的範圍，值得留意；但每隻貓差異很大，比起固定門檻，**「比這隻貓自己最近 1～2 週的平均明顯變多，而且連續幾天都這樣」**更有意義。次數增加可能和飲水變多、天氣、飲食改變、壓力，或泌尿、腸胃、腎臟等不舒服有關，無法單靠次數判斷原因。

---
id: litter-box-duration-baseline
title: 貓砂盆停留時間：一次大約多久、什麼情況要留意
species: cat
category: litter_box
related_event_types: [illness]
severity_hint: info
source: Shin et al. 2024, Journal of Veterinary Clinics 41:71-78（首爾大學，動作感測器監測 37 隻居家健康貓與 19 隻泌尿或腎臟疾病貓）
source_url: https://doi.org/10.17555/jvc.2024.41.2.71
retrieved: 2026-11-17
status: draft_needs_review
note: 秒數是感測器量到的「貓在砂盆旁動作範圍內的時間」，攝影機判斷進出的時間點可能不同，專題數字僅供介面參考。論文摘要與結論對「停留時間」的描述略有出入，這裡依表格數據整理：每次停留病貓較短、每日累計較長。
---
同一項感測器研究中，健康貓每次進貓砂盆的平均停留時間約 1 分鐘（中位數 59 秒，95% 的健康貓落在約 5 秒到 132 秒之間），一天累計約 3 分鐘（中位數 192 秒）。個體差異不小：母貓每次停留（約 71 秒）比公貓（約 52 秒）長，體重較重的貓停留也傾向更久。

注意：這些秒數是用貓砂盆旁的動作感測器量的；用攝影機判斷「進入、離開」的時間點可能不同，所以只能當參考。

在這項研究裡，有泌尿或腎臟疾病的貓，一天進貓砂盆的次數與累計時間偏高，但**每次停留反而略短**（約 56 秒 vs 62 秒）。所以不能只用「停留很久」來判斷，單次停留特別久只是其中一種可能的情況，不是診斷依據。

比較有參考價值的是：這隻貓的停留時間突然和自己平常不同、反覆進出、在盒內用力或叫，或同時出現其他症狀（血尿、尿很少、亂尿、食慾下降、精神變差）。這些情況建議持續觀察，必要時請獸醫檢查。

---
id: litter-box-data-interpretation-limits
title: 用貓砂盆數據判斷健康的限制：次數和時間只能當「提醒」
species: cat
category: litter_box
related_event_types: [illness]
severity_hint: info
source: Shin et al. 2024, Journal of Veterinary Clinics 41:71-78（首爾大學）
source_url: https://doi.org/10.17555/jvc.2024.41.2.71
retrieved: 2026-11-17
status: draft_needs_review
note: AUC 低於 0.6 與「需要加入飲水量、進食量、尿量與糞便量、體重」是論文的結論；最後一段的實務建議是專題的設計建議，不是論文結論。
---
同一個研究團隊評估「只靠進貓砂盆的次數和停留時間」能不能分辨健康與生病的貓，結果鑑別能力不高（ROC 曲線下面積都低於 0.6，接近隨機猜測）。作者認為，要做出更可靠的早期預警，還需要加入飲水量、進食量、尿量與糞便量、體重等資料。

這代表：貓砂盆數據適合用來做**「和自己過去相比有沒有改變」的提醒**，不適合直接用來判斷有沒有生病，更不能判斷是哪一種病。

實務上的做法：先收集至少 1～2 週的資料當作這隻貓自己的基準；公貓、母貓與不同年齡（幼貓、老貓次數較多）要分開看；多貓家庭要先確認是哪一隻貓；盡量記錄是尿尿還是便便；提醒用語使用「可能」「建議觀察」，並說明這些數據不是獸醫診斷。

---
id: litter-box-urinary-warning-signs
title: 貓砂盆監測：哪些組合要提高警覺，尿不出來要立刻就醫
species: cat
category: litter_box
related_event_types: [illness]
severity_hint: urgent_and_emergency_if_cannot_urinate
source: Merck Veterinary Manual（專業版）— Lower Urinary Tract Disease in Cats；Overview of Infectious Diseases of the Urinary System in Small Animals
source_url: https://www.merckvetmanual.com/en-us/veterinary/urinary-system/noninfectious-diseases-of-the-urinary-system-in-small-animals/lower-urinary-tract-disease-in-cats
retrieved: 2026-11-17
status: draft_needs_review
note: 內容整合自已入庫的 merck-cat-flutd 與 merck-urethral-obstruction，改寫成「貓砂盆監測數據如何對應警訊」。最後一句（平常有尿的貓一整天都沒有尿）是常見的獸醫建議，審核時請再對照原始來源確認。
---
貓下泌尿道疾病的典型症狀有：血尿、頻尿（一次尿很少但一直尿）、排尿困難（用力尿）、在貓砂盆以外的地方排尿。如果貓砂盆監測看到「進出次數明顯變多」，同時伴隨每次幾乎沒有尿、蹲很久用力、叫、舔生殖器、尿團很小或帶血，要提高警覺，建議盡快聯絡獸醫。

**公貓特別容易因這類問題進展成尿道阻塞。如果一直想尿卻尿不出來、只有幾滴、排尿時叫、精神變差或嘔吐，要視為緊急狀況立刻就醫，不要等待觀察。**

另外，平常有排尿的貓如果一整天都沒有尿團、也沒有進貓砂盆，也要留意，可能是尿不出來或脫水，建議盡快聯絡獸醫。

---
id: water-intake-and-urination-together
title: 飲水量與排尿量要一起看：飲水變多、尿也變多不一定是病
species: both
category: hydration
related_event_types: [dehydration, illness]
severity_hint: info
source: dvm360（獸醫專業媒體）— The ins and outs of polyuria and polydipsia in veterinary practice；Shin et al. 2024, J Vet Clin 41:71-78
source_url: https://www.dvm360.com/ins-and-outs-polyuria-and-polydipsia
retrieved: 2026-11-17
status: draft_needs_review
note: 來源 dvm360 是專業媒體文章而非原始指引；「多飲」的門檻各來源不一致，因此只描述概念與趨勢。三種情境的解讀方向（飲水與如廁頻率聯合分析）是依文獻原理與老師提出的方向整理，不是獸醫診斷標準，審核時請確認。
---
獸醫文獻常把「喝很多水（多飲）」和「尿很多（多尿）」放在一起討論（PU/PD）。最常見的多尿其實是生理性的：動物喝得比需要多，身體就會把多餘的水排掉，所以尿變多是對喝水變多的正常反應。

所以解讀飲水量和如廁頻率時，兩者要一起看：①飲水增加、如廁次數也增加：較可能是水分攝取增加帶來的自然變化（天氣熱、換成乾飼料、剛腹瀉或嘔吐完），但持續多日仍建議留意；②飲水沒有明顯變化、如廁次數卻突然增加：較需要留意泌尿不適、壓力或其他原因，建議持續觀察並考慮就醫；③飲水明顯變多又多尿，同時食慾改變、體重下降、精神差或嘔吐：建議盡快就醫，可能和腎臟、糖尿病、甲狀腺等問題有關（見相關條目）。

飲水量「太多」的門檻各來源並不一致（有獸醫文章提到成貓超過約 45 mL/公斤/天就算多飲，也有來源用 60 或 100 mL/公斤/天），而且吃罐頭的貓本來就喝得少、吃乾飼料的喝得多。因此請用「和這隻貓自己平常相比的趨勢」來判斷，不要只看單一數字。

另外，研究團隊也建議未來把飲水量、進食量、尿量等資料一起納入貓砂盆監測，才可能做出更可靠的早期預警。

---
id: cat-behavior-change-signs
title: 貓的行為改變可能是生病的早期訊號：活動、睡眠、互動、理毛
species: cat
category: behavior
related_event_types: [illness, appetite_loss]
severity_hint: info
source: International Cat Care（icatcare.org）— 貓疾病與疼痛的早期徵兆、老年貓行為變化
source_url: https://icatcare.org/?p=1337
retrieved: 2026-11-17
status: draft_needs_review
note: 來源 icatcare.org 頁面的網址為站內短連結（https://icatcare.org/?p=1337 與 https://icatcare.org/?p=60808），審核時請換成正式文章網址。最後一段（攝影機與單張照片的限制）是專題的設計限制說明，不是獸醫來源的內容。
---
貓很會隱藏不舒服。國際貓咪組織（International Cat Care）強調，飼主要像偵探一樣留意「變化」：體重、進食與飲水、活動與睡眠、和家人互動的程度與方式、心情、理毛、玩耍與狩獵、想不想出門，以及在貓砂盆以外排泄。貓表現疼痛時，可能只是和家人互動變少、睡得更多、換了睡覺的地方，或比較少理毛。

重點是「和這隻貓自己過去比」：變多、變少、突然不同，都值得記錄。老年貓常見的行為改變（例如叫聲變多、更黏人、亂尿、食慾與理毛下降）很常見，但不應直接當成「老了就這樣」，仍建議和獸醫討論。

系統能做的是用攝影機與紀錄比較活動量、休息時間與貓砂盆使用的變化，提醒飼主「和平常不同」。但單張照片或短影片通常無法判斷跛行、傷口、皮膚病或排泄物異常，這些需要獸醫檢查。
