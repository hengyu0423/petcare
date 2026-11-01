# PawCare 寵物健康知識庫 — 種子資料 v7（草稿，含 v1～v6 全部條目，v7 補缺：跳蚤、搔癢、狗關節炎、貓甲狀腺）

> 狀態：**草稿，尚未經獸醫審閱**。
> 建立日期：2026-10-29。
> 每一條都是依來源頁面內容「改寫成繁體中文的短摘要」，只寫來源有寫的內容，沒有加入個人推測。
> 每一條都附來源名稱與網址，回答時請顯示來源。
> 使用前請自行確認各來源網站的使用條款（Merck、ASPCA 為版權所有；台灣政府網站請看其資料開放聲明）。
> 本檔用於 RAG 入庫；不是醫療建議，回答時仍須保留「不能取代獸醫診斷」的提醒。

## 檔案格式（方便寫入庫腳本解析）

每一條以 `---` 開頭的欄位區塊開始，欄位區塊結束的 `---` 之後是正文。

欄位：
- `id`：唯一代碼
- `title`：標題
- `species`：dog / cat / both
- `category`：food_toxin / poisoning / digestive / symptom / emergency / nutrition / feeding / vaccine / prevention / parasite / dental / chronic_disease / regulation / new_owner
- `related_event_types`：對應現有 `HEALTH_EVENT_TYPES`（vomiting、diarrhea、dehydration、poisoning、allergy、appetite_loss、illness…）
- `severity_hint`（v2 新增，部分條目才有）：emergency / urgent_if_persistent / urgent_if_puppy_or_worse / urgent_if_breathing_difficulty，可對應現有 normal / urgent / emergency 分級
- `source`、`source_url`、`retrieved`、`status`
- `note`：使用上的提醒

## 已知限制與待辦

- 英文來源的電話（例如 ASPCA 中毒專線）是美國號碼，**不適用台灣**，正文已略去。
- 台灣在地內容（`tw-rabies-annual-booster`、`tw-pet-registration-cats-2026`）：狂犬病那條改用政府公告（彰化縣政府 113 年度公告、防檢署「杜絕狂犬病」宣導轉載）為主，**農業部防檢署的原始頁面我還沒有直接讀到**；家貓登記那條仍只有新聞來源，會入庫但不啟用。
- **v5 覆蓋進度**（依你列的四大類）：
  - 緊急狀況：中毒（概念＋乙二醇）、排尿受阻、昏倒（含心肺復甦要點）、出血燒傷噎到、中暑失溫、貓腸胃道阻塞、貓呼吸困難、**急性腎損傷的常見毒物（防凍劑、葡萄、人用止痛藥、百合）**——已有；**狗的呼吸困難尚無專門條目**。
  - 常見症狀：狗——嘔吐、咳嗽；貓——嘔吐／胃炎、腹瀉／結腸炎、便秘、咳嗽／氣喘、排尿異常（FLUTD）、慢性嘔吐腹瀉、胰臟炎——已有；**狗貓食慾不振、搔癢、狗腹瀉與便秘專門條目，尚未有來源，不憑記憶補**。
  - 飲食安全：危險食物、營養基礎、餵食注意事項——已有；**尚缺：體態評分（BCS）、看寵物食品標示、換糧方法、肥胖與減重**。
  - 預防保健與疾病照護（v5 新增 17 條）：預防保健總覽、狗與貓的疫苗、絕育時機、寄生蟲總覽、蛔蟲、心絲蟲（預防、症狀）、狗與貓的口腔保健、慢性腎臟病（總覽、照護）、急性腎損傷、糖尿病（狗貓、貓照護）、台灣狂犬病與家貓登記——已有；**尚缺：跳蚤、壁蝨、疥蟎等體外寄生蟲，關節炎、甲狀腺機能亢進、心臟病等其他慢性病**。
- **v6 新手養寵物**（新增 26 條：23 條 `new_owner`、1 條 `emergency`、2 條 `regulation`）：狗——養狗責任、行為需求、運動、餵食基本功、床籠與室外、看獸醫與生病徵兆、梳毛洗澡餵藥、結紮時機、居家安全、幼犬看獸醫疫苗驅蟲、幼犬餵食、如廁訓練、籠子訓練、社會化；貓——幼貓第一週看獸醫、餵食、貓砂盆、居家安全（含百合）、抓板與指甲、玩耍與行為、日常保健、室內外、幼貓何時聯絡獸醫；狗貓共通——晶片；台灣——飼主法定責任（法務部函釋）、動保法修正草案（新聞，不啟用）。來源以 Merck 飼主版與 AAHA（美國動物醫院協會）為主，這兩個我都讀了完整頁面。
  - **尚缺**：選擇寵物（挑品種、幼犬或成犬、從哪裡領養）、第一次帶回家的介紹（多寵物家庭、貓狗互相介紹）、外出與旅行、單獨在家的分離焦慮、基本口令訓練（坐下、等待、過來）、預算與保險、台灣的領養管道與寵物登記的官方說明。
- **v7 補缺**（新增 7 條）：跳蚤（生活史、健康風險、控制方法、怎麼檢查）、跳蚤過敏性皮膚炎與搔癢、狗的關節炎、貓的甲狀腺機能亢進。跳蚤與搔癢的 4 條來自 Merck 專業版的完整頁面，狗關節炎與貓甲狀腺只讀到搜尋片段，已在 note 標明。
  - **仍缺**：壁蝨、疥蟎／毛囊蟲（搔癢的其他體外寄生蟲）、貓的關節炎、心臟病；狗的呼吸困難、食慾不振專門條目；體態評分（BCS）與肥胖減重、看寵物食品標示、換糧方法；選擇寵物、多寵物家庭的介紹、出門旅行、分離焦慮、基本口令訓練、預算與保險、台灣的領養管道與寵物登記的官方說明。
- 貓的條目（v3 新增）絕大多數來自 Merck 飼主版，其中「貓的消化道問題」「胰臟炎」「咳嗽氣喘」只讀到搜尋片段，已在 note 標明，入庫前請核對原頁。
- 數字（例如防凍劑致死量）直接照來源寫，上線前請獸醫確認是否適合顯示給飼主。

---
id: aspca-alcohol-yeast-dough
title: 酒精與生酵母麵團
species: both
category: food_toxin
related_event_types: [poisoning, vomiting, diarrhea]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 來源附的是美國中毒專線，不適用台灣；台灣請聯絡動物醫院。
---
含酒精的飲品與食品，寵物吃進去可能出現嘔吐、腹瀉、動作不協調、精神沉鬱、呼吸困難、顫抖、血液酸鹼值改變，嚴重時可能昏迷甚至死亡。酒精吸收很快，一旦接觸，應儘快尋求獸醫協助。

生的酵母麵團進到消化道後會發酵膨脹並產生氣體，可能造成疼痛與胃脹氣，嚴重時胃可能扭轉，成為危及生命的緊急狀況。酵母還會在胃裡產生酒精，所以誤食生麵團也可能併發酒精中毒。

懷疑誤食時，先記下大概的食用量，再聯絡獸醫。

---
id: aspca-chocolate-caffeine
title: 巧克力、咖啡與咖啡因
species: both
category: food_toxin
related_event_types: [poisoning, vomiting, diarrhea]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
巧克力、咖啡與咖啡因的毒性，來自一類叫甲基黃嘌呤（methylxanthine）的成分。寵物吃進去後，可能出現嘔吐、腹瀉、喘氣、異常口渴與多尿、過度興奮、心律不整、顫抖、癲癇，嚴重時可能死亡。

可可含量越高的巧克力、或咖啡因含量越高的食品，風險越大。白巧克力的甲基黃嘌呤含量最低，烘焙用巧克力與可可粉最高。

---
id: aspca-grapes-raisins
title: 葡萄與葡萄乾
species: dog
category: food_toxin
related_event_types: [poisoning, vomiting]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 來源僅就狗說明；貓的情況來源此頁未寫，不要自行推論。
---
葡萄與葡萄乾被推測含有毒性成分「酒石酸」，狗無法處理這種物質，吃進去可能造成腎臟損傷。來源用的是「推測」的說法，代表確切的毒性成分仍未完全確定，因此最穩妥的做法是不要給。

---
id: aspca-allium
title: 洋蔥、大蒜與韭菜（蔥屬植物）
species: both
category: food_toxin
related_event_types: [poisoning, vomiting, diarrhea]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
洋蔥、大蒜、韭菜都屬於蔥屬植物。寵物吃進去可能造成腸胃刺激，也可能傷害紅血球而導致貧血。貓比狗更敏感，但狗也會依食用量而有風險。

---
id: aspca-xylitol
title: 木糖醇
species: both
category: food_toxin
related_event_types: [poisoning, vomiting]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
木糖醇是常見的代糖，用在口香糖、糖果、烘焙食品與牙膏等產品。寵物吃進去可能造成低血糖，依攝取量不同，也可能傷害肝臟。

早期症狀包括嘔吐、精神不振與動作不協調，可能進一步發展成癲癇。肝損傷可能在 12 到 24 小時內出現，並引發出血異常。

---
id: aspca-macadamia-nuts
title: 夏威夷豆與其他堅果
species: both
category: food_toxin
related_event_types: [poisoning, vomiting, diarrhea]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 夏威夷豆的症狀描述，來源是針對狗。
---
狗吃到夏威夷豆，可能出現虛弱、動作不協調、精神沉鬱、嘔吐、顫抖與體溫過高。症狀通常在食用後 12 小時內出現，預期在 24 到 72 小時內恢復。

杏仁、胡桃、核桃等其他堅果含有大量油脂，可能引起嘔吐與腹瀉，部分寵物還可能因此發生胰臟炎。

---
id: aspca-milk-dairy
title: 牛奶與乳製品
species: both
category: food_toxin
related_event_types: [diarrhea, vomiting]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
寵物體內通常沒有足夠的乳糖酶（分解牛奶中乳糖的酵素），所以牛奶與乳製品可能引起腹瀉或其他消化不適。

---
id: aspca-raw-meat-eggs-bones
title: 生肉、生蛋與生骨頭
species: both
category: food_toxin
related_event_types: [vomiting, diarrhea, illness]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
生肉與生蛋可能帶有沙門氏菌、大腸桿菌等細菌，對寵物和人都有害。生蛋含有一種會干擾部分維生素吸收的酵素，長期可能造成皮膚與毛髮問題。

生骨頭看起來像是貼近自然的飲食，但對家養的寵物並不安全：狗或貓啃骨頭，可能造成消化道受傷或阻塞，嚴重時需要動手術。

---
id: aspca-salt
title: 過量的鹽分與過鹹食物
species: both
category: food_toxin
related_event_types: [poisoning, vomiting, diarrhea, dehydration]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
攝取過多鹽分會讓寵物更口渴、尿量增加，依攝取量不同，也可能造成血液電解質異常。鹽中毒的症狀包括嘔吐、腹瀉、精神沉鬱、顫抖、癲癇，嚴重時可能死亡。

---
id: aspca-avocado-citrus-coconut
title: 酪梨、柑橘類與椰子
species: both
category: food_toxin
related_event_types: [vomiting, diarrhea, poisoning]
source: ASPCA — People Foods to Avoid Feeding Your Pets
source_url: https://www.aspca.org/pet-care/aspca-poison-control/people-foods-avoid-feeding-your-pets
retrieved: 2026-10-29
status: draft_needs_review
note: 酪梨一條，來源指出主要問題在鳥、兔、驢、馬與反芻動物；對犬貓的情況此頁未特別描述，不要自行延伸。
---
酪梨：來源指出主要的風險是在鳥類、兔子、驢、馬與山羊綿羊等反芻動物，鳥和兔可能發生心血管損傷甚至死亡。

柑橘類：莖、葉、果皮、果肉與種子含有檸檬酸與精油，大量吃進去可能造成刺激甚至精神沉鬱；少量（例如只吃果肉）通常只會造成輕微的胃部不適。

椰子與椰子油：少量通常不太可能造成嚴重傷害，但新鮮椰子的果肉與椰奶含有油脂，可能造成胃部不適、軟便與腹瀉。

---
id: merck-dog-digestive-signs
title: 狗的消化道疾病：常見徵兆與可能原因
species: dog
category: digestive
related_event_types: [vomiting, diarrhea, constipation, dehydration, appetite_loss, illness]
source: Merck Veterinary Manual（飼主版）— Introduction to Digestive Disorders of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/digestive-disorders-of-dogs/introduction-to-digestive-disorders-of-dogs
retrieved: 2026-10-29
status: draft_needs_review
note: 來源為狗；貓請另外查貓的對應條目，不要直接套用。
---
消化道問題的徵兆包括：大量流口水、腹瀉、便秘、嘔吐或反芻、食慾不振、出血、腹痛與脹氣、排便用力、休克與脫水。

嘔吐通常是胃或腸黏膜發炎（胃腸炎）造成，原因可能是感染或刺激，但也可能來自非消化道的疾病，例如腎臟病。腹瀉的原因很多：細菌感染可造成大量水瀉；犬小病毒、冠狀病毒、輪狀病毒等病毒可造成吸收不良。短時間大量流失水分時，可能出現脫水與電解質失衡，嚴重時進展成休克。

糞便的顏色、軟硬度與次數改變，也是重要線索。黑色焦油狀的糞便，可能代表胃或小腸出血。排便用力，通常與直腸、肛門發炎有關。腹部脹大可能是氣體、液體或食物堆積造成，也可能是異物或腸套疊等阻塞，或只是吃太多。腹痛時，狗可能出現哀鳴、踱步，或前肢伸直、胸部貼地、後腿抬高等異常姿勢。

就診時，飼主清楚描述年齡、症狀、目前飲食、過去病史與接觸其他狗的情況，對獸醫判斷很有幫助；可以詢問獸醫是否要帶近期的糞便樣本。

---
id: merck-dog-digestive-treatment-principles
title: 狗的消化道問題：治療原則與預防
species: dog
category: digestive
related_event_types: [vomiting, diarrhea, dehydration]
source: Merck Veterinary Manual（飼主版）— Introduction to Digestive Disorders of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/digestive-disorders-of-dogs/introduction-to-digestive-disorders-of-dogs
retrieved: 2026-10-29
status: draft_needs_review
note: 本條只說明獸醫的治療原則，不提供飼主自行用藥的建議。
---
獸醫治療的首要目標是找出並排除原因，同時處理症狀、減輕疼痛，讓身體有機會復原。

幾個一般原則：
- 在有脫水風險時（例如嘔吐、腹瀉過多），需要補充水分與電解質。
- 止瀉或通便的藥物並非每種情況都有益；腹瀉有時是身體排除有害微生物與毒素的防禦機制，藥物效果也不一定穩定，是否使用要依個案由獸醫判斷。
- 給狗使用止痛藥時要密切觀察，避免疼痛被壓下去，卻讓病情在背後惡化。
- 病毒性疾病目前沒有特效藥；抗生素是否使用，由獸醫依疑似疾病、可能的益處與過去結果決定，過量或使用過久反而可能傷害消化道。

預防方面：保持良好的衛生與環境清潔、提供足夠空間、適當的營養與居住環境以減輕壓力，並且適當接種疫苗，可預防部分消化道疾病（例如犬小病毒）。

---
id: merck-young-animals-gi-risk
title: 幼齡動物腹瀉可能快速惡化
species: both
category: digestive
related_event_types: [diarrhea, vomiting, dehydration]
source: Merck Veterinary Manual（飼主版）— Drugs Used to Treat Digestive Disorders
source_url: https://merckvetmanual.com/special-pet-topics/drugs-and-vaccines/drugs-used-to-treat-digestive-disorders
retrieved: 2026-10-29
status: draft_needs_review
note: 這條只根據搜尋結果的片段，尚未讀完整頁；入庫前請再打開原頁確認上下文。
---
來源指出，幼齡動物的腸胃道特別容易發生腹瀉與發炎，而且可能因為腹瀉而快速惡化。這支持系統對幼貓、幼犬出現腹瀉或嘔吐時，採取較保守、較早建議就醫的判斷。

---
id: merck-ethylene-glycol
title: 乙二醇（汽車防凍劑）中毒
species: both
category: poisoning
related_event_types: [poisoning, vomiting, dehydration, illness]
source: Merck Veterinary Manual（飼主版）— Ethylene Glycol (Antifreeze) Poisoning
source_url: https://merckvetmanual.com/special-pet-topics/poisoning/ethylene-glycol-antifreeze-poisoning
retrieved: 2026-10-29
status: draft_needs_review
note: 這條只根據搜尋結果的片段，尚未讀完整頁；致死量數字照來源寫，上線前請獸醫確認是否適合顯示給飼主。
---
多數乙二醇中毒來自汽車水箱防凍劑。所有動物都可能中毒，以狗和貓最常見。防凍劑味道偏甜、很少量就可能致死（來源提到狗約 3 到 4 茶匙、貓約 1 到 2 茶匙），而且常被不當存放或棄置，所以相當常見。

症狀：先出現腸胃刺激的嘔吐、非常口渴、大量排尿，接著出現神經症狀，例如精神沉鬱、恍惚、動作不協調。嚴重腎衰竭通常在狗身上於 36 到 72 小時出現，貓則在 12 到 24 小時出現，症狀包括精神差、食慾不振、脫水、嘔吐、腹瀉、口腔潰瘍、流口水、呼吸急促，甚至可能癲癇或昏迷。腎臟常會腫大且疼痛。

治療的時間很關鍵：狗有解毒劑，但必須在腎衰竭出現前給才有效；貓在誤食後早期，可以用靜脈注射乙醇治療。已經發生嚴重腎衰竭的狗和貓，預後不佳。所以懷疑誤食防凍劑時，應立即聯絡獸醫。

預防：防凍劑要妥善存放、舊的要丟棄、洩漏要立刻清理；市面上也有以丙二醇（而非乙二醇）為主成分的防凍劑產品。

---
id: wsava-core-vaccines-2024
title: WSAVA 2024 全球犬貓疫苗指南：核心疫苗重點
species: both
category: vaccine
related_event_types: [illness]
source: WSAVA 2024 Guidelines for the vaccination of dogs and cats（Journal of Small Animal Practice，摘要頁）
source_url: https://researchonline.jcu.edu.au/87272/
retrieved: 2026-10-29
status: draft_needs_review
note: 這條只根據摘要頁的片段，細節（疫苗時程、各國差異）需讀完整指南；WSAVA 另有亞洲區域版指南，台灣的實際做法請以農業部動植物防疫檢疫署與獸醫師建議為準。
---
WSAVA（世界小動物獸醫師協會）的指南提醒：指南的建議是廣泛原則，各國與地區的實際做法可能不同。

重點整理：
- 核心疫苗是不論住在哪裡，所有犬貓都應該接種的疫苗，針對的是全球分佈、會致命的嚴重疾病。
- 在狂犬病流行的地區，狗和貓都應視為必須接種狂犬病疫苗，即使當地沒有法律要求。
- 貓白血病疫苗（FeLV）對一歲以下的幼貓、以及能到戶外或與戶外貓同住的成貓，應視為核心疫苗。
- 住在一般家庭的寵物犬，呼吸道疾病相關疫苗屬於非核心疫苗；但對收容所的狗，則應視為核心疫苗。
- 指南支持在 20 週齡之後，用抗體檢測確認犬（犬瘟熱、犬腺病毒、犬小病毒）與貓（貓泛白血球減少症）接種後是否產生保護力。
- 核心與非核心疫苗都要正確保存與施打，只在必要的頻率下使用，以提供長期的保護。

---
id: merck-dog-vomiting
title: 狗的嘔吐：短期與長期嘔吐的處理原則
species: dog
category: symptom
related_event_types: [vomiting, dehydration]
severity_hint: urgent_if_persistent
source: Merck Veterinary Manual（飼主版）— Vomiting in Dogs
source_url: https://www.merckvetmanual.com/dog-owners/digestive-disorders-of-dogs/vomiting-in-dogs
retrieved: 2026-10-29
status: draft_needs_review
note: 禁食是獸醫在特定條件下的處置，來源明確提醒除非有補液否則不可限水；AI 不應直接叫飼主自行禁食或禁水。本條刻意不寫具體禁食時數（實測模型會照抄成對飼主的指示），原文時數請見來源頁面。
---
嘔吐是胃與上段小腸的內容物被用力排出，通常之前會有噁心、大量流口水、乾嘔，以及腹肌與橫膈膜的強力收縮。原因很多，包括消化道疾病、腎或肝衰竭、胰臟炎、神經系統疾病，以及吃到刺激性物質或毒物。

嘔吐和「反芻」不同：反芻是被動的，不需要用力，吐出來的食物通常沒有消化、可能呈管狀；反芻比較常伴隨咳嗽或呼吸困難。

短期或偶爾的嘔吐，通常沒有其他異常。但咳嗽，或長期、反覆的嘔吐，可能伴隨虛弱、精神差、體重下降、脫水與電解質失衡。

短期嘔吐（不到 3～4 天、沒有其他症狀）：獸醫可能會詢問有沒有接觸到垃圾或毒物，檢查腹部與口腔，也常會照 X 光，因為這有助於找出像異物這類可能致命的問題。若沒有發現重大問題，只處理症狀就可能足夠。獸醫針對這類嘔吐，可能會視情況安排暫時禁食；是否禁食、要持續多久，必須由獸醫依這隻狗的狀況決定，飼主不要自行決定。來源特別強調：**除非狗正在接受皮下或靜脈補液，否則不可以限水**，因為嘔吐本來就會脫水，限水會讓情況更糟；脫水、或有腎臟、心臟疾病的動物，可能需要靜脈輸液。何時、以多少量恢復餵食，也由獸醫指示；要仔細遵照獸醫的指示，水或食物給太多或太少都可能傷害寵物。

長期嘔吐：包括一天嘔吐超過一、兩次，或伴隨血、腹痛、精神沉鬱、脫水、虛弱、發燒、體重下降等，需要更詳細的檢查，可能包括血液、糞便與尿液檢查、X 光、內視鏡與切片、腹部超音波、CT 或 MRI。治療以找出並排除原因為主，並處理脫水、電解質與酸鹼失衡；持續嘔吐、脫水、虛弱的動物，獸醫可能開止吐藥，用藥前會先評估整體狀況。

---
id: merck-dog-kennel-cough
title: 狗的犬傳染性氣管支氣管炎（俗稱犬舍咳）
species: dog
category: symptom
related_event_types: [illness]
severity_hint: urgent_if_puppy_or_worse
source: Merck Veterinary Manual（飼主版）— Tracheobronchitis (Bronchitis) in Dogs
source_url: https://www.merckvetmanual.com/dog-owners/lung-and-airway-disorders-of-dogs/tracheobronchitis-bronchitis-in-dogs
retrieved: 2026-10-29
status: draft_needs_review
note: 來源為狗；貓的咳嗽此版本尚未有來源。
---
犬舍咳是上呼吸道的發炎，通常症狀輕微，多半會自行好轉。但在幼犬可能進展成致命的支氣管肺炎，在虛弱、生病或年老的狗則可能轉成慢性支氣管炎。它在狗群聚集的密閉環境（動物醫院、寄宿犬舍等）傳播很快，多種病毒與細菌都可能造成，也常同時感染多種病原。壓力以及通風、溫度、濕度的極端變化，似乎會增加感染機會與嚴重度。

最典型的症狀是一陣陣粗而乾的咳嗽，之後可能伴隨乾嘔、作嘔。咳嗽的嚴重度通常在前 5 天減輕，但整個病程會持續 10 到 20 天。除了食慾稍差，通常沒有太多其他症狀，體溫通常正常。

如果出現更嚴重的症狀，例如發燒、帶膿的鼻分泌物、精神沉鬱、食慾不振、咳出痰（有濕咳），特別是幼犬，通常代表合併了其他感染，例如犬瘟熱或支氣管肺炎，需要儘快就醫。恢復期間，壓力、環境不良與營養不當，可能導致復發。

因為高度傳染且多半會自行好轉，多數情況下不建議住院；良好的營養與衛生、必要時改善居住環境，有助恢復。咳嗽抑制劑有時會用來控制持續的乾咳；抗生素通常只在嚴重的慢性病例才需要；是否使用由獸醫決定。

疫苗可以預防犬瘟熱、副流感、犬腺病毒 2 型與支氣管敗血性博德氏桿菌等主要病原；要接種哪些、時程如何，請與獸醫討論。

---
id: merck-dog-chronic-bronchitis
title: 狗的慢性支氣管炎與長期咳嗽
species: dog
category: symptom
related_event_types: [illness]
severity_hint: urgent_if_breathing_difficulty
source: Merck Veterinary Manual（飼主版）— Tracheobronchitis (Bronchitis) in Dogs
source_url: https://www.merckvetmanual.com/dog-owners/lung-and-airway-disorders-of-dogs/tracheobronchitis-bronchitis-in-dogs
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
氣管支氣管炎是氣管與支氣管的急性或長期發炎，也可能延伸到肺部，常發生在已有呼吸道或肺部疾病的狗。其他原因包括寄生蟲、口腔與咽部疾病、與心臟或肺部疾病有關的長期咳嗽、吸入煙霧，以及接觸化學氣體。

慢性支氣管炎的定義是：咳嗽持續至少 2 個月，且不是由其他呼吸道疾病造成。它好發於中年以上的狗，多見於小型犬，大型犬也會發生；天氣突然改變或其他環境壓力可能讓症狀惡化。

最突出的症狀是一陣陣的咳嗽，目的是清除呼吸道裡累積的黏液與分泌物，通常在休息後、環境改變後或開始運動時最嚴重。體溫可能稍微升高。急性期通常 2～3 天會過去，但咳嗽可能持續數週。嚴重的支氣管炎與肺炎很難區分，支氣管炎也常延伸成肺炎。

獸醫會依病史、檢查與臨床症狀，並排除其他咳嗽原因來診斷，必要時會做胸部 X 光、支氣管鏡與採樣。輕症或剛發作時，支持性照護可能有效，包括休息、保暖與良好衛生；若有潛在疾病也需要處理。獸醫可能依情況開類固醇（減輕氣道發炎）、抗生素（有細菌感染時）或咳嗽抑制劑；使用哪一種由獸醫判斷。

---
id: merck-urethral-obstruction
title: 尿道阻塞（尿不出來）：緊急狀況，貓特別需要注意
species: both
category: emergency
related_event_types: [illness, vomiting, dehydration]
severity_hint: emergency
source: Merck Veterinary Manual（專業版）— Urethral Obstruction in Small Animals
source_url: https://www.merckvetmanual.com/urinary-system/urolithiasis-in-small-animals/urethral-obstruction-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 來源是給獸醫看的專業版（2025 年 5 月修訂），已改寫成飼主能懂的說明，並刻意略去治療用藥與劑量。Merck 另有飼主版（貓尿路結石頁、狗泌尿道疾病頁），日後可補。
---
尿道阻塞是尿液排不出去，是小動物常見的泌尿系統緊急狀況。原因可能是尿道結石、泌尿道腫瘤、狹窄、攝護腺疾病，或鄰近器官的壓迫，也可能是功能性的阻塞。公貓特別容易因下泌尿道疾病而阻塞，多數情況是尿道栓塞造成。

典型表現：頻繁地想排尿卻排不出來（無效的排尿動作），排尿時還可能發出叫聲。**貓的飼主特別容易把這些表現誤認成便秘。**

阻塞後，代謝廢物會累積。完全阻塞時，約 36 到 48 小時內會出現尿毒症，接著出現精神沉鬱、嘔吐、腹瀉、脫水、昏迷，並大約在 72 小時內死亡。獸醫檢查時，常會摸到硬、脹且疼痛的膀胱。嚴重時可能出現休克，以及會危及生命的高血鉀。

治療的關鍵是儘快解除阻塞，並先穩定動物的狀況（例如輸液）。公貓通常需要在全身麻醉下處理，因為過程有尿道痙攣、撕裂或日後狹窄的風險；因此這不是能在家處理的問題。

因此，只要看到「一直想尿卻尿不出來、或只有幾滴」，尤其是公貓，或排尿時叫、很痛、精神變差、嘔吐，都應視為緊急狀況立即就醫。

---
id: merck-emergency-go-now
title: 什麼情況要立刻就醫、先打電話給獸醫
species: both
category: emergency
related_event_types: [poisoning, illness]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— What to Do in a Dog or Cat Emergency
source_url: https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
需要立即就醫的緊急狀況，例子包括：中毒、劇烈疼痛、嚴重或止不住的出血、呼吸困難、眼睛受傷，以及疑似骨折或肢體無法動。

緊急處理通常從打電話給獸醫開始：先準備好說明發生什麼事，獸醫可能會指示急救與安全運送的方法，並能在電話中幫你判斷是否有氣道、呼吸或循環方面危及生命的問題。照著獸醫的指示處理並前往診所；事先打電話也能讓診所先做好準備。

現場注意：受傷或疼痛的動物可能咬人或抓人，先保護自己。狗在安全的情況下可以用口套（可用布條自製），但**有胸部受傷、或鼻子短的品種（如巴哥、鬥牛犬）不可戴口套，也不要把戴口套的狗獨自留著**。用布蓋住頭和眼睛可以讓動物比較平靜；貓可以用毛巾包起來限制活動，再放進有透氣孔的暗色箱子。

---
id: merck-emergency-unconscious-cpr
title: 失去意識（昏倒）時：檢查呼吸與心跳，以及心肺復甦
species: both
category: emergency
related_event_types: [illness]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— What to Do in a Dog or Cat Emergency
source_url: https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency
retrieved: 2026-10-29
status: draft_needs_review
note: 只收錄來源有寫的要點（觀察呼吸、摸心跳、胸部按壓速度）；不要加入來源沒有的按壓比例或人工呼吸細節，需要時請打電話問獸醫或急救專線。
---
如果寵物失去意識，先觀察胸部有沒有起伏來確認有沒有呼吸，並把手放在胸口，感覺有沒有心跳。需要時，打電話給獸醫或緊急專線，請他們指導如何做胸部按壓。

和人一樣，寵物的心肺復甦從胸部按壓開始，速度大約是每分鐘 100 到 120 次，持續到動物自己恢復呼吸，或獸醫接手為止。如果必須開車前往醫院，在進行心肺復甦的同時，必須由另一個人開車。

---
id: merck-emergency-bleeding-burns-choking
title: 出血、燒燙傷、噎到與體內插入異物
species: both
category: emergency
related_event_types: [illness]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— What to Do in a Dog or Cat Emergency
source_url: https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
**出血**：用手掌或手指用力按壓傷口，再用紗布、乾淨的毛巾或布巾，加上鬆緊適中（不要過緊）的繃帶包紮。如果繃帶被血浸透，不要拆掉，在上面繼續加敷料並保持壓迫。運送時可在繃帶外用膠帶固定。

**燒燙傷**：被毛會掩蓋傷勢，所以很難評估。大面積、很深、化學性、電擊造成的燒傷，或臉部、呼吸道的燒傷，需要立即處理。可以用涼水輕輕沖洗患處，再用不沾黏的敷料覆蓋。

**噎到**：徵兆包括咳嗽、流口水、乾嘔、用腳扒嘴巴，或嘴巴張著且很焦躁。**不要把手指伸進寵物的嘴巴，可能被咬。** 可以嘗試拍打兩肩胛骨之間，或同時從兩側快速擠壓肋骨幾次，幫助排出異物。

**插入體內的異物**：不要拔出插入頭顱、胸部或腹部的物體，應設法避免它繼續移動，並儘快就醫。

---
id: merck-emergency-heat-cold-transport
title: 中暑、失溫、勒傷與運送受傷的動物
species: both
category: emergency
related_event_types: [illness, dehydration]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— What to Do in a Dog or Cat Emergency
source_url: https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency
retrieved: 2026-10-29
status: draft_needs_review
note: 正常體溫、處置方式皆照來源（原文為華氏，已換算為攝氏）。
---
**中暑**是緊急狀況。狗貓的正常肛溫大約 38.6～38.9°C。有些品種（特別是短鼻品種）即使天氣不熱，也可能因壓力或興奮而過熱。中暑的徵兆包括皮膚發燙、嘔吐、流口水、快速喘氣、焦躁不安、動作不協調、倒下或失去意識。處理：先把動物移出高溫環境，用涼水、冰袋或濕毛巾（特別是腹部）幫頭部與身體降溫，也可以用風扇，然後立刻送醫。體溫開始下降後，可以給少量的水。**不要把動物泡在冷水裡。**

**失溫**通常發生在動物走失或暴露在嚴寒中。徵兆包括脈搏變慢、呼吸淺、意識混亂、倒下或失去意識；**顫抖並不是可靠的徵兆**。如果動物是濕的，先擦乾，再用溫（不是熱）的水瓶包在身體周圍。如果懷疑凍傷，要慢慢解凍，不要搓揉，也不要敷雪或用很燙的水。

**勒傷**（例如被項圈勒住懸掛）：頸部或喉嚨受傷需要立刻就醫，先取下項圈，改用臨時的胸背帶或牽繩控制動物。

**運送受傷動物**：盡量減少頭、頸與脊椎的移動，用平整堅硬的板子、厚紙板或折起的毯子支撐動物。如果動物受傷後意識混亂，要讓頭保持水平或略為抬高，避免猛然拉扯，也不要讓任何東西壓到頸部。貓要放在有洞的箱子裡，才有安全感，也方便觀察。

---
id: merck-poisoning-intro
title: 中毒的基本概念
species: both
category: poisoning
related_event_types: [poisoning]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— Introduction to Poisoning
source_url: https://www.merckvetmanual.com/special-pet-topics/poisoning/introduction-to-poisoning
retrieved: 2026-10-29
status: draft_needs_review
note: 來源列出的中毒專線（Pet Poison Helpline、ASPCA）是美國機構，不適用台灣；台灣請直接聯絡動物醫院。
---
中毒是指有毒物質被吞下、吸入，或經由皮膚、眼睛、黏膜接觸而被吸收。寵物不會分辨物質有沒有毒，所以常常因為吃到有毒的東西而中毒，例如防凍劑或有毒植物；也可能被毒蟲或蛇咬傷、螫傷，甚至是飼主出於好意，餵了對動物有毒的人用藥物。

單次接觸後，影響通常在最初 24 小時最明顯；重複或長期接觸也可能中毒。毒性取決於劑量與動物的種類：很小的劑量可能沒有明顯傷害，大劑量則可能致命。

中毒屬於需要立即就醫的緊急狀況。看到寵物可能吃了什麼，請記下大概的種類與量，並聯絡獸醫。

---
id: merck-cat-digestive-signs
title: 貓的消化道問題：常見徵兆、可能原因與就診準備
species: cat
category: digestive
related_event_types: [vomiting, diarrhea, constipation, dehydration, appetite_loss, illness]
severity_hint: urgent_if_persistent
source: Merck Veterinary Manual（飼主版）— Introduction to Digestive Disorders of Cats
source_url: https://merckvetmanual.com/cat-owners/digestive-disorders-of-cats/introduction-to-digestive-disorders-of-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 這條是根據搜尋結果的多個片段整理，尚未讀完整頁；入庫前請再打開原頁核對。
---
貓的消化道問題，徵兆可能包括：大量流口水、腹瀉、便秘、嘔吐或反芻、食慾不振、出血、腹痛與脹氣、排便用力、休克與脫水。貓腹痛時可能會哀鳴、叫，並出現異常姿勢，例如蜷縮並拱起背部。

嘔吐通常是胃或腸黏膜發炎（胃腸炎）造成，由感染或刺激引起；但也可能來自非消化道的疾病，例如腎臟病。大量水瀉通常和腸道分泌過多有關，可能由細菌感染引起；吸收不良則可能由病毒（例如貓泛白血球減少症病毒）、腸道吸收液體的能力受限，或胰臟分泌的消化液不足造成。

持續的腹瀉一定要處理，因為大量流失水分會造成脫水與電解質失衡，進而可能導致休克。黑色焦油狀的糞便，可能代表胃或小腸出血。腹部脹大可能來自氣體、液體或食物堆積，也可能是異物或腸套疊造成的阻塞，或只是吃太多。

就診時，清楚描述貓的年齡、症狀、目前飲食、過去病史，以及有沒有接觸其他貓，對判斷很有幫助；也可以問獸醫是否要帶近期的糞便樣本。

獸醫的治療原則：排除原因；在有脫水風險（例如大量嘔吐或腹瀉）時，需要補充水分與電解質；止瀉藥並非每種情況都適用，因為腹瀉有時是身體排除有害微生物與毒素的防禦機制。

---
id: merck-cat-gastritis-vomiting
title: 貓的嘔吐與胃炎
species: cat
category: symptom
related_event_types: [vomiting, dehydration]
severity_hint: urgent_if_persistent
source: Merck Veterinary Manual（飼主版）— Disorders of the Stomach and Intestines in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-stomach-and-intestines-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
胃炎是胃黏膜發炎造成的突發或長期嘔吐。原因包括吃到刺激或傷害胃黏膜的東西，或感染、寄生蟲、全身性疾病、藥物、毒物、免疫系統異常與胃腫瘤。

短期胃炎：嘔吐來得突然，吐出物可能看得到貓吃下去的東西（例如草），也可能出現膽汁、泡沫、鮮血，或看起來像咖啡渣的消化後血液。依原因不同，可能同時有腹瀉等其他症狀。

長期嘔吐通常是間歇性的，可能伴隨虛弱、精神差、體重下降、脫水與電解質失衡。長期胃炎可能需要內視鏡檢查與組織採樣。

診斷主要依據病史、身體檢查與對治療的反應，必要時做血液、尿液、糞便檢查，以及 X 光或腹部超音波。治療方式與一般嘔吐相同；其中屬於免疫性的類型（淋巴球漿細胞性、嗜伊紅性胃炎）可能需要抑制免疫的藥物，預後取決於嘔吐的原因與是否能矯正。

看到嘔吐物帶血或像咖啡渣，應盡快就醫。

---
id: merck-cat-constipation
title: 貓的便秘
species: cat
category: symptom
related_event_types: [constipation, appetite_loss, vomiting]
severity_hint: urgent_if_ill
source: Merck Veterinary Manual（飼主版）— Disorders of the Stomach and Intestines in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-stomach-and-intestines-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 公貓「用力卻排不出尿」常被誤認為便秘，請同時參考 merck-urethral-obstruction；AI 遇到公貓排便姿勢但沒有糞便時，應先提醒確認是否其實是尿不出來。
---
便秘是排便次數少或排便困難，糞便通常又乾又硬，在貓很常見，多數情況容易矯正；但若貓有較嚴重的疾病，伴隨的症狀可能很嚴重。糞便在結腸裡停留越久，就越乾、越硬、越難排出；「便祕嚴重到硬糞團完全排不出」稱為嚴重便秘（obstipation）。長期便秘的貓可能發展成巨結腸（結腸肌肉無力而變大），原因常常查不出來。

常見原因：貓吞進難以消化的東西（毛髮、骨頭、貓砂），與糞便混在一起造成阻塞；飲水不足；不願意排便（例如貓砂盆太髒、被同住的貓守住貓砂盆、排便會痛）；腸道內或外的阻塞或壓迫、結腸神經肌肉問題；有些藥物也會造成便秘。

徵兆：排便用力、排出乾硬的糞便；有些貓病得更重，還會精神差、沉鬱、食慾不振、嘔吐與腹部不適。建議就醫，並告訴獸醫貓有沒有吃骨頭、貓砂或其他硬物的習慣。

處理：確保貓喝到足夠的水。輕度便秘常可以透過改成高纖維飲食、避免貓吃到骨頭或異物、讓貓隨時有水喝、增加貓砂盆數量並更勤勞清理，以及（通常只短期使用的）適當瀉藥來改善。**只能使用獸醫開的瀉藥，人用的瀉藥對寵物可能非常危險。** 較嚴重時，獸醫需要在全身麻醉下用灌腸或人工方式移除滯留的糞便；對藥物沒有反應的慢性便秘或巨結腸，可能需要切除一段結腸。

---
id: merck-cat-colitis-diarrhea
title: 貓的結腸炎與腹瀉（排便用力、帶黏液或鮮血）
species: cat
category: symptom
related_event_types: [diarrhea, constipation]
severity_hint: urgent_if_persistent
source: Merck Veterinary Manual（飼主版）— Disorders of the Stomach and Intestines in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-stomach-and-intestines-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 「禁食 24～48 小時」是獸醫在特定情況下的建議，不要讓 AI 直接叫飼主自行禁食，需提醒依獸醫指示。
---
大腸（結腸）負責維持水分與電解質平衡、吸收營養、暫存糞便。大腸受損時，常見結果是腹瀉。結腸發炎（結腸炎）可能是短期或長期的。慢性結腸炎的貓多半是中年，且常是純種貓；多數情況原因不明，可能與細菌、寄生蟲、外傷、腎臟相關或過敏有關，也可能是結腸免疫功能缺陷、對飲食或腸道細菌反應過度、遺傳傾向，或過去感染的後遺症。

典型表現：排便用力、頻繁排出帶黏液的糞便，有時帶鮮紅色血；每次糞量少、較稀。體重下降與嘔吐不常見。

獸醫會詢問詳細病史並檢查，有時用特定食物做試驗來找原因，也可能需要血液、尿液與糞便檢查、X 光或超音波、內視鏡或切片。治療依原因而定：先找出並處理原因，並依獸醫指示調整飲食。獸醫可能會視情況請你讓貓暫時禁食讓消化道休息（是否需要與時間由獸醫決定）；恢復餵食後，常會加入可溶性纖維，也可能建議換成貓沒吃過的蛋白質來源（例如羊肉、鹿肉、兔肉），以找出可能的食物過敏。有些貓只靠飲食管理就會好轉；也可能加上抗生素、消炎藥或驅蟲藥。

長期的結腸炎起初多半會改善，但症狀常會復發；多數發炎性腸病的貓需要長期治療。

另外，**貓腸道冠狀病毒**在近距離接觸的貓之間傳染力很強，通常症狀輕微甚至沒有症狀，偶爾會出現嚴重嘔吐、腹瀉與打噴嚏、咳嗽等呼吸道症狀；沒有特效治療，必要時以輸液等支持性治療。

---
id: merck-cat-gi-obstruction
title: 貓的腸胃道阻塞（異物、線狀異物）
species: cat
category: emergency
related_event_types: [vomiting, appetite_loss, dehydration, illness]
severity_hint: emergency_if_suspected
source: Merck Veterinary Manual（飼主版）— Disorders of the Stomach and Intestines in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-stomach-and-intestines-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
腸胃道阻塞是消化道被堵住。阻塞可能發生在消化道外部、管壁內或管腔內，會妨礙食物與液體通過、傷害消化組織，並可能造成危及生命的後果。胃出口的阻塞可能由腫瘤、異物、息肉、胃組織過度增生造成；腸道阻塞可能是部分或完全的，原因包括異物、腸套疊、被卡在疝氣中的腸，以及腫瘤。

**線狀異物**（例如線、毛線、布）特別危險：它可能卡在舌根，如果長度夠長、延伸進腸道，腸道正常的蠕動會對腸壁產生鋸割般的作用，進而造成腸穿孔與腹腔感染。

徵兆不一，但常見嘔吐與食慾不振；也可能有精神差、腹瀉、腹痛或腹部腫脹、發燒或體溫偏低、脫水與休克。就診時，請盡量告訴獸醫貓平常的進食習慣，是否接觸過線、縫衣針，或有玩具不見了，這些都很重要。

治療：精神不佳或發燒的貓可從靜脈輸液獲益；有些胃內的異物可用內視鏡取出，但無法取出的異物或腸道阻塞需要手術。突然出現腹部症狀且原因不明、或持續惡化的貓，也可能需要手術。來源指出，只要及時診斷、治療，很多貓恢復得很好。

---
id: merck-cat-chronic-gi
title: 貓的慢性嘔吐、腹瀉與體重下降：發炎性腸病、吸收不良、潰瘍
species: cat
category: digestive
related_event_types: [vomiting, diarrhea, appetite_loss, illness]
severity_hint: urgent_if_persistent
source: Merck Veterinary Manual（飼主版）— Disorders of the Stomach and Intestines in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-stomach-and-intestines-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
**發炎性腸病（IBD）**是一類原因不明的消化道發炎疾病，會有持續的症狀：嘔吐、腹瀉、食慾改變與體重下降，症狀常是長期的，也可能時好時壞。各年齡、性別、品種都可能發生，純種貓可能較常見；貓的平均發病年齡約 7 歲。IBD 與肝臟發炎、胰臟炎之間有關聯（合稱 triaditis），嚴重的 IBD 也可能與腸道腫瘤有關。因為症狀和許多疾病相似，診斷需要先排除其他疾病，並以內視鏡或手術取得的組織切片確認。

治療目標是減少腹瀉與嘔吐、促進食慾與體重增加、減輕腸道發炎。獸醫可能建議低過敏或排除飲食：只餵貓沒吃過的蛋白質，至少 4 到 6 週，除非獸醫同意，不要給任何零食。有些貓不願意換食物，這時應與獸醫討論；**不要強迫餵食，也不要讓貓挨餓。** IBD 通常能被控制，但很少完全治癒，可能復發。

**吸收不良**是營養素消化或吸收受阻，典型表現是長期腹瀉、體重下降，以及食慾改變（食慾下降，或吃得特別多）；即使病得很重也可能沒有腹瀉，貓可能在食慾很好的情況下體重大幅下降，其他方面看起來還算健康。

**胃腸潰瘍**在貓不常見，常與腫瘤有關。可能沒有症狀，卻突然發生危及生命的消化道出血；也可能有嘔吐（有時帶血）、腹部不適。**黑色焦油狀糞便、牙齦蒼白（可能貧血）**是需要盡快就醫的警訊。

**消化道腫瘤**在貓不常見（少於所有癌症的 10%），好發於約 10 到 12 歲的老貓，最常見的症狀是嘔吐（有時帶血）、腹瀉（也可能帶血）、食慾不振、體重下降與精神差。

---
id: merck-cat-pancreatitis
title: 貓的胰臟炎與胰臟外分泌功能不全
species: cat
category: digestive
related_event_types: [vomiting, appetite_loss, dehydration, illness]
severity_hint: urgent
source: Merck Veterinary Manual（飼主版）— Disorders of the Pancreas in Cats
source_url: https://www.merckvetmanual.com/cat-owners/digestive-disorders-of-cats/disorders-of-the-pancreas-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 這條根據搜尋結果片段整理，尚未讀完整頁。
---
嚴重的胰臟炎，症狀和許多其他消化道疾病相同：精神差、食慾不振、脫水、體重下降、體溫偏低、嘔吐、黃疸、發燒與腹痛。

獸醫可能建議使用預防噁心與嘔吐的藥物；只有在貓即使用藥仍然嘔吐時，獸醫才可能建議讓貓暫時完全禁食讓胰臟休息（是否需要與時間由獸醫決定）。可能需要靜脈輸液，而且多數情況會給止痛藥，因為貓被認為有腹痛。輕度胰臟炎，貓可能改吃低脂飲食與低脂零食。

胰臟外分泌功能不全的貓通常是中年到老年，常見表現是吃得特別多、體重下降與軟便或腹瀉，有些貓也可能有嘔吐與食慾不振。常與糖尿病同時出現。胰臟膿瘍是胰臟炎的併發症，可能出現嘔吐、精神沉鬱、腹痛、食慾不振、發燒、腹瀉與脫水。

---
id: merck-cat-cough-asthma
title: 貓的咳嗽：支氣管炎與貓氣喘
species: cat
category: symptom
related_event_types: [illness]
severity_hint: urgent_if_breathing_difficulty
source: Merck Veterinary Manual（飼主版）— Tracheobronchitis (Bronchitis, Bronchial Asthma) in Cats
source_url: https://www.merckvetmanual.com/cat-owners/lung-and-airway-disorders-of-cats/tracheobronchitis-bronchitis-bronchial-asthma-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 這條根據搜尋結果片段整理，尚未讀完整頁。貓咳嗽與嘔吐、乾嘔容易混淆。
---
貓的氣管支氣管炎可能由免疫異常、寄生蟲、口腔與咽部疾病，或與心臟或肺部疾病有關的長期咳嗽引起；吸入煙霧與接觸化學氣體也是原因之一。最明顯的症狀是一陣陣的咳嗽，在休息後或開始運動時最嚴重，也可能有輕微發燒。急性期通常 2 到 3 天會過去，但咳嗽可能持續數週。

**貓氣喘（過敏性支氣管炎）**與人的氣喘有相似之處，年輕的貓以及暹羅貓、喜馬拉雅貓最常受影響；老貓突然發生氣喘的情況極為少見。症狀包括呼吸急促、咳嗽或喘鳴，可能時有時無。**但老貓的慢性咳嗽，常常是肺炎造成的。** 如果呼吸急促很嚴重，可能看到黏膜發紫（表示血中缺氧）。

獸醫會依病史、檢查與臨床症狀，並排除其他咳嗽原因來診斷，必要時做胸部 X 光、支氣管鏡與採樣。治療上，獸醫可能用噴霧（或洗熱水澡的蒸氣）幫助化痰；貓氣喘以口服或吸入型類固醇治療，另有專為貓設計的吸入艙與吸入器；是否使用由獸醫決定。管理上也要避免會加重病情的噴霧產品與過敏原，例如香菸煙霧、香水、花粉、黴菌與灰塵。

---
id: merck-cat-breathing-difficulty
title: 貓的呼吸困難：立刻就醫
species: cat
category: emergency
related_event_types: [illness]
severity_hint: emergency
source: Merck Veterinary Manual（飼主版）— What to Do in a Dog or Cat Emergency；Merck（貓咳嗽與氣喘頁）；VCA Animal Hospitals — Emergencies in Cats
source_url: https://www.merckvetmanual.com/special-pet-topics/emergencies/what-to-do-in-a-dog-or-cat-emergency
retrieved: 2026-10-29
status: draft_needs_review
note: 這條整合三個來源的片段（VCA 頁面：https://vcahospitals.com/know-your-pet/emergencies）；VCA 部分只讀到搜尋片段。狗的呼吸困難尚未有專門條目。
---
呼吸困難是需要立即就醫的緊急狀況（Merck 的緊急清單把「呼吸困難」列為必須立刻看獸醫的情況）。

對貓來說，如果貓有呼吸困難，特別是張口呼吸或喘氣，應立刻帶去看獸醫（VCA 的貓急症說明）。呼吸急促很嚴重時，黏膜可能呈藍紫色，表示血中缺氧（Merck 貓氣喘頁）。

行前建議先打電話給獸醫說明情況，並照指示準備運送；運送時讓貓待在有透氣孔的箱子裡，盡量減少刺激。

---
id: merck-cat-flutd
title: 貓的排尿異常：下泌尿道疾病（血尿、頻尿、排尿困難、亂尿）
species: cat
category: symptom
related_event_types: [illness]
severity_hint: urgent_and_emergency_if_cannot_urinate
source: Merck Veterinary Manual（專業版）— Lower Urinary Tract Disease in Cats；Overview of Infectious Diseases of the Urinary System in Small Animals
source_url: https://www.merckvetmanual.com/en-us/veterinary/urinary-system/noninfectious-diseases-of-the-urinary-system-in-small-animals/lower-urinary-tract-disease-in-cats
retrieved: 2026-10-29
status: draft_needs_review
note: 來源是給獸醫看的專業版，已改寫成飼主能懂的說明，並略去藥名與劑量；UTI 數字來自另一頁（https://merckvetmanual.com/urinary-system/infectious-diseases-of-the-urinary-system-in-small-animals/overview-of-infectious-diseases-of-the-urinary-system-in-small-animals）的搜尋片段。「尿不出來」請見 merck-urethral-obstruction。
---
貓下泌尿道疾病（FLUTD）不是單一疾病，而是一組和下泌尿道有關的問題，公貓、母貓都可能發生。典型症狀有：血尿、頻尿（一次尿很少但一直尿）、排尿困難（用力尿）、以及在貓砂盆以外的地方排尿。

原因可能是尿路結石、泌尿道感染、尿道栓塞或腫瘤，但**大多數有下泌尿道症狀的貓，是「貓特發性膀胱炎」**：原因不明，推測和下泌尿道、壓力與神經荷爾蒙的交互作用有關。診斷靠排除其他原因，需要 X 光、超音波、尿液檢查與尿液培養。

另一個有用的觀察：成年貓出現下泌尿道症狀時，通常是非感染性的原因（特發性膀胱炎、膀胱結石）；細菌性膀胱炎在貓相對少見（來源提到，1～10 歲且有下泌尿道症狀的貓，培養出細菌的比例不到 2%）；但老年貓、免疫力低下的貓，或有其他全身疾病（例如慢性腎臟病、甲狀腺機能亢進）的貓，比較容易有細菌性泌尿道感染。

因為原因不明，治療的目標是降低膀胱炎發作的嚴重度與頻率。可以考慮的方向包括：減輕環境壓力、貓砂盆管理、留意多貓家庭中貓與貓的互動、調整飲食（例如使用罐頭食品）、使用費洛蒙，以及由獸醫給予止痛。市面上常有針對泌尿道的保健品，但來源指出它們在貓身上還沒有被充分研究。

**提醒：公貓特別容易因這類疾病進展成尿道阻塞。** 如果看到一直想尿卻尿不出來、只有幾滴、排尿時叫、精神變差或嘔吐，要視為緊急狀況立刻就醫（見尿道阻塞條目）。

---
id: merck-complete-balanced-diet
title: 什麼是「完整且均衡」的飲食，以及自製飯的風險
species: both
category: nutrition
related_event_types: [appetite_loss, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 來源是給獸醫看的專業版（Sanderson，2023 年 11 月審閱、2024 年 9 月更新），已改寫成飼主能懂的說明。文中的營養標準（AAFCO、NRC）是美國的標準，台灣產品標示可能不同。
---
來源指出：「完整且均衡」的飲食，是指能提供健康犬貓在特定生命階段所需全部營養素的飲食，這對犬貓的整體健康非常重要。

在高收入國家，只要飼主餵的是品質良好、完整均衡的商業飼料，或是由獸醫營養專科醫師設計的自製飯，犬貓很少出現營養性疾病。營養問題最常出現在這幾種情況：餵不均衡的自製飯、把狗糧餵給貓、純素飲食，或使用不常見原料（例如無穀飲食）而且用量超出已知安全範圍。

只用少數幾種食材做成的飯，往往不夠：例如只餵肉、或只餵漢堡肉配白飯，可能造成鈣不足並引發繼發性營養性副甲狀腺機能亢進；只餵肝臟可能造成維生素 A 中毒（狗與貓都會）。

生食與熟食的營養也不同：有些生食含有抗營養因子，煮熟才會被破壞（例如生蛋中的抗生物素蛋白會破壞生物素、生魚中的硫胺素酶會破壞維生素 B1、生大豆中的胰蛋白酶抑制劑會干擾蛋白質消化）；但烹調方式和溫度也可能影響營養含量。

---
id: merck-cat-vs-dog-nutrition
title: 貓和狗的營養需求不同：貓不能吃狗糧
species: cat
category: nutrition
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
貓的飲食需求和狗不同，若吃為狗設計的食物，可能出現營養缺乏。例如，和狗不同，貓需要從飲食中取得維生素 A、花生四烯酸與牛磺酸；貓對精胺酸等部分胺基酸，以及菸鹼酸（B3）與吡哆醇（B6）的需求量也比較高。

牛磺酸是貓的必需胺基酸。牛磺酸缺乏可能造成貓的擴張性心肌病與視網膜中央退化；植物性蛋白質不含牛磺酸，所以貓的飲食必須含有動物性蛋白質，或另外添加合成牛磺酸。

貓無法把植物中的 β-胡蘿蔔素轉換成維生素 A，所以需要現成的維生素 A 來源（例如肝臟、魚油或合成維生素 A）。貓也不能把亞麻油酸有效轉換成花生四烯酸，而花生四烯酸存在於肉、禽類脂肪與蛋，植物油裡沒有。

貓的維生素 A 中毒比狗常見，幼貓若長期吃大量肝臟，可能造成頸椎骨骼異常增生，導致脖子活動受限、無法好好理毛。

---
id: merck-calories-rer-mer
title: 每日熱量需求怎麼估：RER 與 MER
species: both
category: nutrition
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals；Daily Maintenance Energy Requirements for Dogs and Cats（表格）
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 公式與倍數照來源；計算範例是我依來源公式算的，不是來源原文，上線前請獸醫確認。來源強調任何公式都只是「起點」，需依體重與體態反應調整，AI 回答時應提醒這一點，不要給出絕對數字。表格頁：https://www.merckvetmanual.com/multimedia/table/daily-maintenance-energy-requirements-for-dogs-and-cats
---
犬貓每日熱量需求不是體重的直線函數。簡單的估算方式，是先算**靜止能量需求（RER）**，再乘上依年齡與是否絕育而定的倍數，得到**維持能量需求（MER）**。

RER 有兩種公式：
- 指數公式：RER = 70 × 體重（公斤）的 0.75 次方，適用任何體重。
- 直線公式：RER = 30 × 體重（公斤）+ 70，只適用於體重大於 2 公斤、小於 45 公斤的動物。

MER 的倍數（來源表格）：
- 成犬：未絕育 1.8 × RER；已絕育 1.6 × RER；易胖體質 1.4 × RER。
- 幼犬：4 個月以下 3 × RER；4 個月以上 2 × RER。
- 成貓：未絕育 1.4 × RER；已絕育 1.2 × RER；易胖體質 1 × RER。
- 幼貓：2.5 × RER（幼貓也可以自由採食）。

計算範例（依上述公式算出，僅供示意）：一隻 4 公斤的絕育成貓，RER 約 198 kcal，MER 約 238 kcal/天；一隻 10 公斤的絕育成犬，用直線公式 RER = 370 kcal，MER 約 592 kcal/天（若用指數公式，結果會略有不同）。

來源特別強調：這些數字只是起點。同樣體重的動物，實際需求可能比公式多或少 30%；品種、活動量、年齡、瘦肉比例、環境都會影響。家犬通常比犬舍裡的狗需要更少熱量。要依體重與體態（BCS）的變化持續調整。

---
id: merck-weight-management-diets
title: 吃得比包裝建議少還是會胖？體重管理飲食的注意點
species: both
category: nutrition
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
如果吃成犬貓維持飼料的動物，只需要吃比包裝建議量少 10% 到 30% 的食物，就能維持理想體重與體態（BCS），可以考慮改成能量密度較低的飲食。

一般維持飼料是為「中等活動量、吃正常份量」的成年動物設計的，若硬把維持飼料少餵，所有營養素的攝取量都會跟著減少，而維持飼料並不是設計成這樣餵的。市售的體重管理飼料能量密度較低，營養素濃度也會調整，確保動物在吃進較少熱量的同時，仍能攝取足夠營養；但即便用體重管理飼料，如果熱量限制得太嚴格，仍可能造成營養缺乏。

當動物維持理想體重所需的熱量似乎低得不尋常時，好的做法是先檢查有沒有潛在疾病（例如狗的甲狀腺機能低下）。有些情況，可能需要「治療性減重飲食」，它的設計是低熱量、但仍提供動物所需的全部營養素。

---
id: merck-water-hydration
title: 飲水：隨時有乾淨的水，貓特別需要多個水源
species: both
category: nutrition
related_event_types: [dehydration]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
水是最重要的營養素；缺水可能在數天內致命。應隨時提供乾淨的新鮮水。設置多個水源可以鼓勵飲水，這對常常不太喝水的貓尤其重要。

每日需水量取決於飲食、環境、活動量與健康狀況，個體差異很大。在溫度適中的環境下，多數哺乳動物每公斤體重約需要 44 到 66 毫升的水。

食物含水量不同：罐頭食品的水分約 60% 到超過 87%，乾飼料只有約 3% 到 11%，半濕食品約 25% 到 35%。因此，主要吃罐頭的犬貓，通常喝水比較少；主要吃乾飼料的喝得比較多。

只要水量充足，健康的動物能自己調節飲水量，一般不應該限制飲水。缺水可能來自照顧不當或疾病；脫水在消化道、呼吸道與泌尿道的許多疾病中都是嚴重問題。

---
id: merck-protein-fat-basics
title: 蛋白質、脂肪、碳水化合物與纖維的基礎
species: both
category: nutrition
related_event_types: [appetite_loss, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 以下最低蛋白質比例是美國 AAFCO 的標準（乾物質基礎），僅供參考；台灣產品標示方式與基準可能不同。
---
營養素分六大類：水、蛋白質、脂肪、碳水化合物、維生素、礦物質；其中只有蛋白質、脂肪、碳水化合物提供能量。

**蛋白質**：AAFCO 的最低要求（乾物質基礎）是：成犬 18%、成長期幼犬與繁殖期 22.5%；成貓 26%、成長期幼貓與繁殖期 30%。蛋白質需求會隨年齡、活動量、生命階段、健康狀況與蛋白質品質而不同。蛋白質不足或蛋白質與熱量比例不當，可能造成幼犬幼貓生長減緩、貧血、體重下降、肌肉萎縮、毛髮粗糙、食慾不振，以及對疾病或傷口的反應變差。

**脂肪**：脂肪提供必需脂肪酸，也幫助脂溶性維生素（A、D、E、K）的吸收。多數成犬商業飼料的脂肪含量約 5% 到 15%（乾物質基礎），幼犬飼料約 8% 到 20%；貓的飲食中，脂肪最多可占熱量的 60%。必需脂肪酸缺乏，在吃完整均衡飲食的犬貓身上極為罕見，但可能造成毛髮乾燥、鱗屑、無光澤。

**碳水化合物**：對成年、非繁殖期的犬貓不是必需營養素，因為身體可以用胺基酸與脂肪合成葡萄糖；但只要適當煮熟，犬貓都能以 90% 以上的效率消化穀物等澱粉。貓需要的是中等量的複合碳水化合物；貓習慣少量多餐，一天可吃到 18 次小餐。

**纖維**：犬貓沒有纖維的飲食需求，但適當的纖維有益處（例如腸道益生菌的食物來源）；纖維太高則可能干擾營養吸收。

---
id: merck-diet-imbalance-pitfalls
title: 常見餵食地雷：只吃肝、生蛋白、生魚、大量鮪魚、亂補充營養品
species: both
category: feeding
related_event_types: [illness, poisoning]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
來源列出幾種因餵食方式不當造成的營養問題：
- **只餵肝臟**：可能造成維生素 A 中毒（狗和貓都會）。幼貓長期吃大量肝臟，可能造成頸椎骨骼增生。
- **以肉為主、全肉飲食**：這類飲食磷高鈣低，可能造成鈣缺乏。
- **生蛋白**：含有抗生物素蛋白，會結合生物素並阻礙吸收（蛋黃則是生物素的良好來源）。生物素缺乏的徵兆包括生長不良、皮膚炎、精神差與神經異常。
- **生的淡水魚與蛤蜊**：含硫胺素酶，會破壞維生素 B1；煮熟可破壞硫胺素酶，所以含魚的罐頭貓食因為加熱處理，不會有這個問題。
- **大量罐頭鮪魚**：曾有貓因為吃大量罐頭鮪魚而缺乏維生素 E，造成黃脂病（脂肪組織發炎）。
- **亂補充營養品**：來源明確指出，應避免不加選擇的礦物質補充，因為可能造成礦物質失衡。完整均衡的飲食不需要額外補充鈣、磷或維生素 D；過量鈣對生長期的大型犬與巨型犬尤其有問題。
- **過量維生素 C**：對有草酸鈣結石病史的犬貓有疑慮，因為維生素 C 分解後會形成草酸，增加尿中草酸排出量。

---
id: merck-feeding-adult-dogs
title: 成犬的餵食方式：定量、兩餐、零食不超過 10% 熱量
species: dog
category: feeding
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Feeding Practices in Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/feeding-practices-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
狗長到預期成犬體重的約 90% 之後，一般建議改吃營養密度比成長期飲食低的飲食。目標是維持這隻狗的理想體重與體態。

有些成犬可以自由採食，但大多數狗這樣吃會變胖。**為預防肥胖，多數成犬最好的餵法是定量餵食**，例如每天固定時間餵兩餐、預先量好份量。多數狗會馬上吃完，但有些狗會整天慢慢吃。

很多飼主會給零食，這也是人與動物情感連結的重要部分。有些零食是低脂高纖維且完整均衡的，但**多數零食並不完整均衡，為了避免營養不足，每天零食的總量應低於總熱量的 10%**。易胖的動物要把所有零食的熱量都算進去。

營養補充品不是必要，有些情況甚至可能有害。定期評估體態，有助於避免成年後體重過度增加。

---
id: merck-feeding-puppies
title: 幼犬的餵食：餐數、成長期飲食與避免長太快
species: dog
category: feeding
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Feeding Practices in Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/feeding-practices-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
幼犬在前 5 個月成長非常快，6 個月後成長速度逐漸趨緩；小型與中型犬約在 8 到 12 個月達到骨骼成熟，大型與巨型犬要到 10 到 16 個月。**應該餵幼犬完整均衡的成長期飲食，直到骨骼成熟，而不是只到看起來不再長大為止。**

一般建議：離乳到 6 個月的幼犬一天餵三餐，6 到 12 個月一天餵兩餐；小型犬幼犬可能需要一天餵超過三餐。

大型與巨型犬的幼犬，要餵標示為適合大型犬成長的完整均衡成長期飲食（AAFCO 聲明中會寫明包含成年體重 32 公斤以上的大型犬成長）。小型與中型犬可以吃成長期或全生命階段飲食。

過度餵食會讓成長太快，這不僅不利骨骼正常發育，也會增加日後肥胖的風險。成長慢比成長快好。建議每週量體重，調整餵食量，讓幼犬每週都「有小幅增加」。額外補充鈣、磷與維生素 D 很少有需要，甚至可能有害。

---
id: merck-feeding-cats-kittens
title: 貓與幼貓的餵食：轉換成貓飼料的時間、少量多餐、肥胖風險
species: cat
category: feeding
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Feeding Practices in Small Animals；Nutritional Requirements of Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/feeding-practices-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
幼貓前 3 到 4 個月成長非常快，每週增加 50 到 100 克；約在 150 到 160 天成長開始趨緩，200 到 220 天左右成長大多完成。**幼貓通常在 8 到 12 個月之間，轉換成成貓飲食。**

對幼貓，來源建議的成長期飲食：脂肪 10% 到 35%、蛋白質 30% 到 40%、纖維低於 5%（乾物質基礎）。成長中的幼貓與懷孕、哺乳的母貓，可以自由採食，或一天分數次餵食。幼貓的熱量需求也可以自由採食來滿足。

成貓方面，一些不活動的絕育成貓，可以自由採食低脂（約 9% 乾物質基礎）的飲食，但這不一定適合每隻貓。經常待在戶外、接觸溫度變化的貓，冬天可能吃得比較多。

貓的飲食習慣是少量多餐：貓習慣一天吃多達 18 次小餐，讓血糖緩慢穩定上升。

---
id: merck-feeding-seniors
title: 老年犬貓的餵食：不是一律減量
species: both
category: feeding
related_event_types: [appetite_loss, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Feeding Practices in Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/feeding-practices-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
老年犬代謝蛋白質的效率可能不如年輕的狗，所以反而可能需要更多的蛋白質來維持體內的蛋白質儲備。老年貓消化脂肪與蛋白質的能力下降，所以可能需要更高脂肪、而且高度可消化的飲食。中年貓肥胖風險增加，而老貓常常難以維持體重。

有些犬貓進入老年時已經過重，也有些開始出現體態下降。需要依個體，調整能量、脂肪或纖維含量較高或較低的食物，以維持理想的體重與體態。

老年犬貓建議納入預防保健計畫，定期評估體重與體態、器官功能（狗還包括認知功能）。慢性退化性器官疾病隨年齡增加，早期診斷有助於更早治療與更有效的營養管理。

---
id: merck-feeding-pregnancy-lactation
title: 懷孕與哺乳期的母犬、母貓餵食
species: both
category: feeding
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Feeding Practices in Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/feeding-practices-in-small-animals
retrieved: 2026-10-29
status: draft_needs_review
note: 
---
**母犬**：懷孕初期就應轉成完整均衡的成長期飲食。懷孕前三分之二時間，熱量需求大致與維持期相同（假設懷孕時體態不過瘦）；常見的錯誤是懷孕初期餵太多、哺乳期卻餵太少。懷孕最後三分之一，總餵食量應比維持期至少增加 20% 到 30%（依胎數與體態而定）。哺乳的母犬，能量需求常為維持期的 2 到 4 倍，建議用完整均衡的成長期飲食自由採食。

**母貓**：和母犬不同，母貓在整個懷孕期間體重呈直線增加，所以一懷孕就需要吃比較多。懷孕最後三分之一，食量與營養攝取通常平均增加約 25%（有估計高達 40%）；懷孕初期與生產前，有些母貓會吃比較少，只有持續很久才需要擔心。哺乳期需要正常食量的 2 到 3 倍。

不論犬貓，已經均衡的飲食不需要再額外添加補充品。

---
id: merck-preventive-care-overview
title: 預防保健總覽：健康檢查頻率與項目
species: both
category: prevention
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Preventative Health Care for Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-in-small-animals/preventative-health-care-for-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 來源是給獸醫看的專業版（2022 年 11 月審閱、2025 年 6 月更新），已改寫成飼主能懂的說明。疫苗時程採美國 AAHA / AAFP 指引，台灣實際做法請依獸醫與農業部規定。
---
預防保健包含：健康監測、疫苗、生殖與遺傳諮詢、寄生蟲控制、營養、行為健康與臨終照護。

獸醫檢查的重點已從過去只管疫苗與驅蟲，擴大到整體健康，包括身體、營養與行為。建議的頻率是：幼犬、幼貓在約 20 週齡之前，每隔幾週檢查一次；之後的犬貓至少每年檢查一次。老年或有慢性病的動物，可能需要更頻繁的檢查。

這些檢查的目的，是做健康監測與健康規畫，內容包括適合的疫苗與寄生蟲控制、營養諮詢、行為健康評估與生殖諮詢。

另外，幫飼主監測寵物的體態評分（BCS）、讓寵物保持精實，來源指出可以為寵物的壽命加上好幾年，因為過度餵食與過量補充營養品可能造成許多問題。

---
id: merck-vaccines-dogs
title: 狗的疫苗：核心與非核心、幼犬接種時程
species: dog
category: vaccine
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Preventative Health Care for Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-in-small-animals/preventative-health-care-for-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 時程是美國指引（AAHA）的整理，只供了解概念，實際何時打、打哪些，請依獸醫建議。狂犬病疫苗在台灣依法每年施打，見 tw-rabies-annual-booster，不要套用本條的「每 3 年」。
---
犬疫苗分為核心與非核心。核心疫苗包括：狂犬病、犬瘟熱、犬小病毒、腺病毒 2 型。其中犬瘟熱、犬小病毒、腺病毒 2 型通常是一劑合併疫苗。

狂犬病疫苗：來源提到有 1 年與 3 年兩種滅活疫苗；初次接種的年齡與追加的頻率，由當地法規決定（台灣的規定請見台灣狂犬病那一條）。

幼犬時程（美國指引）：通常約 6 到 8 週齡開始，之後每 2 到 4 週再打一次，直到超過 16 到 20 週齡。第一次追加最晚在初次系列最後一劑之後 1 年內，之後成犬的追加間隔為 3 年以上。

非核心疫苗（包括博德氏桿菌、鉤端螺旋體、萊姆病、犬流感）依這隻狗的生活型態與感染風險評估後再決定。冠狀病毒疫苗雖然有，但已不再被建議。

---
id: merck-vaccines-cats
title: 貓的疫苗：核心與非核心、幼貓接種時程與注射部位
species: cat
category: vaccine
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Preventative Health Care for Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-in-small-animals/preventative-health-care-for-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 時程是美國指引（AAHA / AAFP 2020）的整理，只供了解概念，實際請依獸醫建議。狂犬病疫苗在台灣依法每年施打，見 tw-rabies-annual-booster。
---
貓的核心疫苗是貓泛白血球減少症（FPV）、貓皰疹病毒 1 型（FHV-1）與貓卡里西病毒（FCV）。依來源，在最新的指引更新中，狂犬病與貓白血病病毒（FeLV）疫苗也被列為核心。

FPV-FCV-FHV-1 的幼貓時程：約 6 到 8 週齡開始，之後每 3 到 4 週一次，直到 16 到 20 週齡，6 個月大時再打一次，之後每 3 年一次。

FeLV 疫苗：8 到 12 週齡開始，3 到 4 週後追加，之後高風險的貓每年一次，風險較低的貓每 2 到 3 年一次。

其他疫苗（披衣菌、博德氏桿菌）依感染風險建議，例如多貓同住的情況。貓傳染性腹膜炎（FIP）疫苗已不再被建議。

來源也提到：貓可能在疫苗注射部位長出纖維肉瘤，原因並不完全清楚；因此指引建議，把疫苗打在可以手術切除的部位（例如遠端肢體，而不是軀幹）。

---
id: merck-spay-neuter-timing
title: 結紮（絕育）的時機
species: both
category: prevention
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Preventative Health Care for Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-in-small-animals/preventative-health-care-for-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 台灣對絕育的法規與罰則本條不涉及。
---
過去為了對抗寵物過剩，常在 4 到 6 個月大時就替犬貓結紮。這個建議現在對大型犬有所不同，因為有研究顯示，等狗度過青春期之後再結紮，可能帶來長期的健康好處。實際時機請與獸醫討論。

---
id: merck-parasite-control-overview
title: 寄生蟲控制總覽：體內、體外與人畜共通
species: both
category: parasite
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Preventative Health Care for Small Animals
source_url: https://www.merckvetmanual.com/management-and-nutrition/preventative-health-care-and-husbandry-in-small-animals/preventative-health-care-for-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 
---
寄生蟲控制仍然很重要。小動物主要的體內寄生蟲，包括蛔蟲、鞭蟲與絛蟲等消化道寄生蟲；心絲蟲病對狗和貓都很重要，可以靠預防性用藥避免。貓的心絲蟲目前沒有安全、可接受的治療方式。主要的體外寄生蟲包括跳蚤、壁蝨與疥蟎，犬貓都有口服與外用的跳蚤控制產品。

另一個重點是預防人畜共通疾病，例如內臟幼蟲移行症、弓蟲症；巴爾通氏菌感染也可能是影響人類的重要蟲媒疾病。

用什麼預防藥、多久用一次，請依獸醫的建議與這隻寵物的風險決定。

---
id: merck-roundworm-prevention
title: 蛔蟲：幼犬幼貓最常見，驅蟲時程與衛生
species: both
category: parasite
related_event_types: [diarrhea, vomiting, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Roundworms in Small Animals
source_url: https://www.merckvetmanual.com/digestive-system/gastrointestinal-parasites-of-small-animals/roundworms-in-small-animals
retrieved: 2026-10-31
status: draft_needs_review
note: 來源有藥名與劑量表，本條刻意全部略去；驅蟲藥請由獸醫開立，不要讓 AI 或飼主自行決定藥物與劑量。幼犬幼貓驅蟲的週齡時程照來源寫，但仍以獸醫指示為準。
---
蛔蟲（弓首蛔蟲、獅弓蛔蟲）是犬貓很常見的感染，特別是幼犬與幼貓。感染常常沒有症狀，生病的多半是幼小的動物：最先看到的是生長停滯與體況變差，被毛無光澤，常有「大肚子」，可能吐出蟲或在糞便中看到蟲，也可能有帶黏液的腹瀉。幼蟲移行經過肺部時，可能引起咳嗽；嚴重感染的幼犬可能出現蟲性肺炎等問題。

犬的弓首蛔蟲與貓的弓首蛔蟲都可能感染人。蟲卵在環境中約 2 到 4 週會變成具感染力；多數人類感染沒有症狀，但可能出現內臟幼蟲移行症，少見時也會造成眼部問題。來源也提到，貓的 *Toxocara malaysiensis* 常見於中國、馬來西亞與越南等地，它的人畜共通風險目前還不明確。

來源的結論是：**所有犬貓都應該做預防性驅蟲。** 診斷靠糞便檢查找蟲卵。

幼小動物的建議時程：幼犬最好在出生後 2 週開始處理，之後每 2 週一次到 3 個月大，再改成每月一次到 6 個月大；哺乳中的母犬與幼犬在同一時間處理。幼貓是 2 週開始，每 2 週一次到 12 週，再每月一次到 6 個月大；哺乳的母貓也一起。成年動物的頻率，應依所處環境的風險評估決定。

衛生很重要：糞便要盡快撿起處理，並且至少每年做一次糞便檢查，確認預防計畫有效。蟲卵會附著在許多表面、混在土壤與灰塵中，所以接觸可能受污染的動物或場所時，尤其是小孩，要嚴格注意衛生。

---
id: merck-heartworm-prevention
title: 心絲蟲預防：蚊子傳染，全年預防
species: both
category: parasite
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Heartworm Disease in Dogs, Cats, and Ferrets
source_url: https://www.merckvetmanual.com/circulatory-system/heartworm-disease/heartworm-disease-in-dogs-cats-and-ferrets
retrieved: 2026-10-31
status: draft_needs_review
note: 來源有藥名與劑量，本條刻意略去。台灣是否屬於高風險區、當地蚊子狀況，請以獸醫與官方資訊為準；來源只說在熱帶與亞熱帶，傳播季節是全年。
---
心絲蟲病由犬心絲蟲（*Dirofilaria immitis*）造成，是透過帶有幼蟲的蚊子叮咬傳染。來源指出，至少有 70 種蚊子可以當媒介，常見的是家蚊、斑蚊與瘧蚊。

來源說，在熱帶與亞熱帶，傳播季節是全年。**不論室內或室外，任何狗、貓都可能被感染**，只是常待在戶外的狗貓風險最高。

預防：來源強調，**全年**定期使用心絲蟲預防藥，是唯一可靠的預防方式，因為蚊子活動的時間很難預測。預防藥有每月口服、外用，以及每半年或每年的注射等多種劑型。許多預防藥同時也能預防其他線蟲。另外，驅蟲藥或驅蚊產品、減少蚊子的環境管理，可以當作輔助，但不能單獨取代預防藥。

貓：因為沒有經過充分研究、有效的治療方式，來源建議**所有貓都應該預防心絲蟲**，特別是在流行地區。

不要把給牲畜用的藥物拿來給犬貓用，因為計算錯誤或過量可能造成死亡或嚴重副作用。

---
id: merck-heartworm-signs
title: 心絲蟲病的症狀與檢查
species: both
category: parasite
related_event_types: [illness]
severity_hint: urgent_if_breathing_difficulty
source: Merck Veterinary Manual（專業版）— Heartworm Disease in Dogs, Cats, and Ferrets
source_url: https://www.merckvetmanual.com/circulatory-system/heartworm-disease/heartworm-disease-in-dogs-cats-and-ferrets
retrieved: 2026-10-31
status: draft_needs_review
note: 治療方式（含藥物）本條不收。
---
**狗**：多數感染的狗沒有症狀或只有輕微症狀，常在例行驗血時意外發現。有症狀時，最常見的是咳嗽；病情較重時可能出現運動不耐受、呼吸困難、暈厥、倒下與腹水（右心衰竭）。來源提醒，感染後約 5 個月才會驗到抗原，所以太早驗並不可靠，約 7 個月大之前驗抗原或微絲蟲沒有意義。年輕的狗開始預防後 6 到 7 個月要再檢查一次，之後每年做抗原檢查。

**貓**：貓可能沒有症狀，也可能很嚴重。症狀包括間歇性咳嗽、呼吸困難、嘔吐、嗜睡、食慾不振、體重下降與暈厥。早期症狀常被誤認成貓氣喘或支氣管炎。成蟲只要死掉一隻，就可能引起急性呼吸窘迫與休克，有時致命。貓的檢查比狗困難，抗體與抗原檢測各有侷限，陰性並不能完全排除感染。

出現呼吸困難、暈厥或倒下，應立刻就醫。

---
id: merck-dog-dental-care
title: 狗的牙齒保健：牙菌斑、牙結石、牙周病與刷牙
species: dog
category: dental
related_event_types: [appetite_loss, illness]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Dental Disorders of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/digestive-disorders-of-dogs/dental-disorders-of-dogs
retrieved: 2026-10-31
status: draft_needs_review
note: 
---
牙周病是細菌感染牙齒周圍的組織，造成牙齦、固定牙齒的韌帶與周圍骨頭發炎；沒有治療，牙齒會因為失去支撐而掉落，這是狗掉牙最主要的原因。成因是細菌（牙菌斑）累積在牙齦線，部分和口腔衛生不足有關，品種、遺傳、年齡與飲食也有影響。

牙周病分兩種：
- **牙齦炎**：牙齦因牙菌斑發炎，顏色從珊瑚粉色變成紅色或紫色，邊緣腫脹，碰到容易流血，常有口臭。牙齦炎可以藉由適當的清潔逆轉，但沒處理可能發展成牙周炎。牙齦炎通常約 2 歲開始被注意到。
- **牙周炎**：組織傷害更嚴重，包含牙齦、韌帶與骨頭，通常是多年的牙菌斑、牙結石與牙齦炎之後出現，**是不可逆的**，會永久失去牙齒的支撐。小型犬比大型犬更容易有牙周炎，通常 4 到 6 歲開始；後排牙齒、上排牙齒比較常受影響。

吃硬的乾飼料的狗，因為咀嚼有機械清潔效果，問題比較少。

治療：獸醫會在麻醉下做完整的洗牙，包括牙齦線以下；常會拍口內 X 光；牙周炎常常需要拔牙，狗拔牙後通常適應得很好。治療後仍要在家持續口腔清潔。

預防：乾淨的牙齒周圍不會長牙周病。最好每天刷牙；如果狗不讓你刷，至少每 2 到 3 天用紗布擦拭牙齒，清掉牙菌斑。只需要刷或擦牙齒的外側。**不要使用人用牙膏。** 獸醫也可能建議有助於清除牙菌斑的食物、玩具與零食，可參考「獸醫口腔健康委員會（VOHC）」認可的產品清單。

牙齒也可能因為啃咬不適當的東西（例如真正的骨頭、蹄、鹿角、硬的尼龍玩具、石頭）而斷裂。牙痛的徵兆包括不願意被碰觸牙齒、牙齒變色（紅褐、紫或灰）、可見的斷裂、臉部腫脹、食慾下降；但多數狗會隱藏疼痛，所以不容易發現。

---
id: merck-cat-dental-care
title: 貓的牙齒保健：牙周病、吸收性病變、口炎與刷牙
species: cat
category: dental
related_event_types: [appetite_loss, illness]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Dental Disorders of Cats
source_url: https://merckvetmanual.com/cat-owners/digestive-disorders-of-cats/dental-disorders-of-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 這條是根據搜尋結果的多個片段整理，尚未讀完整頁；入庫前請再打開原頁核對。
---
貓的牙齒問題很多和人類相似，但**貓幾乎不會蛀牙**。牙周病分成牙齦炎和牙周炎兩種，都需要由獸醫在麻醉下做專業洗牙；沒有麻醉的「洗牙」可能讓牙齒看起來乾淨，但沒有處理真正的問題：牙齦線以下的牙菌斑。

- **牙齦炎**：牙齦因牙菌斑發炎、容易流血，常有口臭；適當清潔可以逆轉，沒處理可能發展成牙周炎。部分貓在 6 到 8 個月大時，會出現幼年型牙齦炎。
- **牙周炎**：牙齦、韌帶與骨頭受到傷害，是不可逆的，有些貓在 1 歲就能看到。常常需要拔牙，貓拔牙後通常適應得很好。治療後建議每 3 個月到 1 年做預防性洗牙，以免復發。
- **牙齒吸收性病變**（頸部病變）：這是貓**最常見**的牙齒異常，牙齒結構逐漸被破壞，常伴隨鮮紅發炎的牙齦，牙冠可能完全消失。徵兆包括碰到會痛、食慾不振、流口水與精神不好；但貓很會隱藏疼痛，可能看不出來。大部分吸收性病變無法預防，因為原因通常不明。
- **口炎**：貓的口腔可能反應強烈而嚴重發炎，徵兆包括口痛、流口水、口臭與食慾不振；許多病毒與細菌都可能促成。來源提到，唯一有效的治療常常是拔掉大部分或全部牙齒，多數貓之後仍能吃濕食，甚至固體食物。治療沒有反應的貓，要檢查是否有免疫問題、糖尿病，特別是貓抓病（巴爾通氏菌）。

預防：乾淨的牙齒很少長牙周病。牙菌斑留在牙齒上超過 72 小時就會開始變硬成牙結石，牙刷刷不掉。最好每天幫貓刷牙；貓不讓你刷時，至少每 2 到 3 天用紗布擦拭牙齒。有些零食與乾糧也可能幫助清除牙菌斑，請獸醫推薦。

---
id: merck-ckd-overview
title: 慢性腎臟病（CKD）：常見於老年貓狗，早期不明顯
species: both
category: chronic_disease
related_event_types: [illness, vomiting, appetite_loss, dehydration]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Renal Dysfunction in Dogs and Cats
source_url: https://www.merckvetmanual.com/urinary-system/noninfectious-diseases-of-the-urinary-system-in-small-animals/renal-dysfunction-in-dogs-and-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 來源是給獸醫看的專業版（2025 年 3 月審閱、2026 年 10 月更新），已改寫成飼主能懂的說明，刻意略去藥名與劑量，也不收錄抽血數值分期表。盛行率數字來自轉診機構的老年族群，不代表一般族群。
---
慢性腎臟病（CKD）是腎臟功能組織因為長期、通常持續進行的過程而逐漸減少。它常常在數月到數年間慢慢發生，等到出現症狀時，已經是不可逆、而且常會持續惡化的狀態。盛行率從 5 到 6 歲後隨年齡上升；在轉診機構的老年族群中，影響最多可達 10% 的狗與 60% 的貓。

一般要等到腎臟功能組織損失約 75% 以上，才會出現直接由 CKD 造成的症狀。最早出現的通常是**喝水增加、尿量增加**。病情進展到第 3、4 期（在狗是數個月、貓可以是數年），才會出現食慾不振、體重下降、脫水、口腔潰瘍、嘔吐與腹瀉。晚期還可能因貧血而牙齦蒼白。

因為早期沒有症狀，**定期監測腎功能的抽血指標，是早期發現的關鍵**，特別是老年的犬貓。尿液濃縮能力下降也是早期警訊。

CKD 沒有治癒方法，但如果早期發現，可以控制很多年；獸醫會依分期（IRIS 分期）制定治療與監測計畫。在適當治療下，動物可以在只剩一小部分腎功能的情況下，存活很長一段時間。

---
id: merck-ckd-care
title: 慢性腎臟病的日常照護：腎臟病處方飲食、補水與血壓
species: both
category: chronic_disease
related_event_types: [appetite_loss, dehydration, vomiting]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Renal Dysfunction in Dogs and Cats
source_url: https://www.merckvetmanual.com/urinary-system/noninfectious-diseases-of-the-urinary-system-in-small-animals/renal-dysfunction-in-dogs-and-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 本條不收任何藥名與劑量；飲食變更請由獸醫決定。
---
來源指出，慢性腎臟病的治療重點是：營養、補水，以及處理併發症。

**飲食**：腎臟病處方飲食的特色是低磷、適量且高品質的蛋白質，吃這類飲食的狗貓，存活時間與延後到尿毒危機的時間都比較長。這類飲食建議用在第 2 期（含）以上的犬貓。吃得下與體重要定期監測：晚期的狗貓特別容易食慾不振、體重下降與惡病質；獸醫可能使用食慾促進劑，必要時會輔助餵食。

**補水**：CKD 的狗貓因為尿液濃縮能力下降，後期又可能噁心、嘔吐、不愛喝水，脫水風險增加。**並不是每隻有氮血症的動物都需要皮下輸液**。可以先藉由提供罐頭食品、多處新鮮飲水、在食物中加水或低鈉的湯來幫助補水；後期或無法自己喝夠水的動物，才需要由獸醫安排補充輸液。

**血壓**：高血壓是 CKD 常見的併發症，任何分期都可能發生，所以所有 CKD 的狗貓都應該監測血壓，高血壓可能傷害腎臟、眼睛、中樞神經與心血管。

**蛋白尿**：CKD 的狗貓都應該檢查尿蛋白（尿蛋白肌酸酐比），蛋白尿是不好的預後指標。

**噁心嘔吐**：晚期尿毒症會造成噁心與嘔吐，影響生活品質，獸醫可以用藥物控制。

晚期還可能發生貧血（缺乏紅血球生成素），造成虛弱、嗜睡與食慾下降，獸醫有對應的治療。

---
id: merck-aki-toxins
title: 急性腎損傷：常見毒物（防凍劑、葡萄、人用止痛藥、百合）與警訊
species: both
category: emergency
related_event_types: [poisoning, vomiting, appetite_loss, dehydration]
severity_hint: emergency
source: Merck Veterinary Manual（專業版）— Renal Dysfunction in Dogs and Cats
source_url: https://www.merckvetmanual.com/urinary-system/noninfectious-diseases-of-the-urinary-system-in-small-animals/renal-dysfunction-in-dogs-and-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 來源是專業版；本條只收「原因與警訊」，不收治療細節。
---
急性腎損傷（AKI）是腎功能在短時間內突然下降，通常在受到突發、重大的傷害後出現。來源列出的主要原因包括：**毒物**（例如乙二醇（汽車防凍劑）、特定抗生素、葡萄或葡萄乾、非類固醇消炎止痛藥（NSAIDs）、百合）、缺血（嚴重或長時間的血流不足），以及感染（例如鉤端螺旋體、萊姆病、腎盂腎炎）。長時間的尿路阻塞也可能造成急性腎損傷。

臨床表現包括：食慾不振、精神沉鬱、脫水、口腔潰瘍、嘔吐或腹瀉，以及尿量異常（變得很多、很少，或完全沒有）。輕度的 AKI 常常沒被發現，嚴重或反覆發作可能轉成慢性腎臟病。

嚴重到需要醫療介入的 AKI，存活率約 50%；有毒物原因的預後最差，可治療的感染預後最好。因此，懷疑誤食防凍劑、葡萄、人用止痛藥，或貓接觸到百合時，應立刻聯絡獸醫，不要等症狀出現。

---
id: merck-diabetes-dogs-cats
title: 糖尿病：多喝、多尿、多吃卻變瘦
species: both
category: chronic_disease
related_event_types: [illness, appetite_loss]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Diabetes Mellitus in Dogs and Cats
source_url: https://www.merckvetmanual.com/endocrine-system/the-pancreas/diabetes-mellitus-in-dogs-and-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 這條是根據搜尋結果的多個片段整理（專業版，2026 年 5 月更新），尚未讀完整頁，入庫前請再打開原頁核對。
---
糖尿病是狗貓常見的內分泌疾病。典型症狀是：**多吃、多喝、多尿與體重下降**，這是高血糖與尿糖造成的。狗還常見白內障（貓不常見）。有些狗與最多一半的貓，食慾反而下降。多數自發性糖尿病發生在中年的狗，與中年到老年的貓。

肥胖會讓狗貓更容易有胰島素阻抗；長期使用類固醇或黃體素類藥物，也會增加風險，並讓症狀惡化。貓如果體重超過 4 公斤，似乎比較常見糖尿病。

治療是**注射胰島素，並調整飲食**。貓有機會緩解；狗如果沒有其他促成的疾病，通常是終身性的。

診斷靠持續的高血糖與尿糖。貓常因緊迫造成暫時的高血糖，所以可能要多次採血或尿液檢查，來確認是不是真的糖尿病。

---
id: merck-diabetes-cat-care
title: 糖尿病貓的照護：低血糖與酮酸中毒的警訊
species: cat
category: chronic_disease
related_event_types: [illness, appetite_loss]
severity_hint: urgent
source: Merck Veterinary Manual（飼主版）— Disorders of the Pancreas in Cats
source_url: https://www.merckvetmanual.com/cat-owners/hormonal-disorders-of-cats/disorders-of-the-pancreas-in-cats
retrieved: 2026-10-31
status: draft_needs_review
note: 這條是根據搜尋結果片段整理，尚未讀完整頁；入庫前請再打開原頁核對。胰島素的種類與劑量不收。
---
貓的糖尿病常常慢慢發展，一開始的症狀可能不被注意；常見的是喝水與排尿增加、食慾增加與體重下降。壓力、肥胖與使用皮質類固醇，會讓症狀更嚴重。

治療結合體重控制、飲食、胰島素注射，有時加上口服藥物。**在沒有詢問獸醫之前，不要自己改變胰島素的量或時間，也不要改變飲食。** 部分新診斷的貓會出現糖尿病緩解（逆轉），不再需要胰島素，通常在開始調整飲食與胰島素治療後的 3 到 4 個月內；需要仔細監測血糖才能得知。

警訊：
- **低血糖**：徵兆包括虛弱、動作不協調、癲癇與倒下。如果在打完胰島素後看到這些徵兆，要立刻聯絡獸醫。
- **酮酸中毒**：徵兆包括喝水與排尿增加、嗜睡、虛弱、食慾下降與呼吸困難。出現這些徵兆，應立刻就醫。

---
id: tw-rabies-annual-booster
title: 台灣：狂犬病「二不一要」、犬貓每年施打狂犬病疫苗
species: both
category: vaccine
related_event_types: [illness]
severity_hint: info
source: 彰化縣政府「113 年度動物狂犬病預防注射及寵物登記工作公告」；農業部動植物防疫檢疫署「杜絕狂犬病」宣導（學校網站轉載）；新北市動保處（聯合新聞網報導）
source_url: https://files.chcg.gov.tw/files/65_20240320145145796_113年度動物狂犬病預防注射及寵物登記工作公告.pdf
retrieved: 2026-10-31
status: draft_needs_review
note: 以政府公告為主，但農業部防檢署的原始頁面我還沒有直接讀到（只看到學校網站轉載的公告）；各縣市的做法與年度公告可能略有差異，建議之後換成防檢署官網的狂犬病專區頁面。罰則數字出自防檢署公告轉載。
---
防檢署提醒大家，預防狂犬病要記住「二不一要」：
- 不棄養家中寵物。
- 不接觸、捕捉及飼養野生動物。
- 要每年為犬、貓，以及人工飼養的食肉目動物施打狂犬病疫苗。

依防檢署的公告，若被查獲未依規定完成狂犬病疫苗注射，依法可處新台幣 3 萬元到 15 萬元罰鍰。

彰化縣政府的年度公告（以 113 年度為例）說明：出生滿 3 個月齡且健康的犬、貓，或距離上次狂犬病預防注射已超過 1 年的犬、貓與人工飼養陸生食肉目動物，都應該注射狂犬病疫苗；飼主應每年帶動物到動物醫院、縣府巡迴注射地點，或由執業獸醫師到府注射，並取得狂犬病預防注射證明書（由飼主保管）與證明牌（掛在動物頸部以利辨識）。

新北市動保處指出，狂犬病仍是台灣須持續防範的動物傳染病，近年國內主要是在野生動物監測中發現病例，犬貓定期接種疫苗是降低傳播風險的重要措施。

---
id: tw-pet-registration-cats-2026
title: 台灣：家貓自 2026 年起納入寵物登記，晶片與罰則
species: both
category: regulation
related_event_types: [illness]
severity_hint: info
source: 工商時報、聯合新聞網報導（引用農業部公告與縣市動保機關）
source_url: https://www.ctee.com.tw/news/20260104700407-431401
retrieved: 2026-10-31
status: needs_primary_source
note: **這是新聞報導，不是原始官方來源**，所以入庫時會被設為不啟用。請換成農業部公告或寵物登記管理系統的官方頁面後，再把 status 改成 draft_needs_review 並重新入庫。罰則金額以官方公告為準。
---
依報導，農業部在 113 年 12 月修正公告，將原本只適用於犬隻的寵物登記制度，擴大為犬、貓共同適用，自 115 年（2026 年）1 月 1 日起，家貓正式納入寵物登記的強制對象。

登記需要植入晶片，貓走失時，只要掃描晶片就能聯繫飼主。報導提到的罰則：犬貓未辦理晶片植入及寵物登記，可處新台幣 3,000 元到 15,000 元罰鍰；未依法完成絕育，可處 5 萬元到 25 萬元；未依規定每年定期施打狂犬病疫苗，可處 3 萬元到 15 萬元。

---
id: beginner-dog-responsibility
title: 新手養狗前要想清楚：這是一輩子的責任與花費
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Providing a Home for a Dog
source_url: https://www.merckvetmanual.com/dog-owners/selecting-and-providing-a-home-for-a-dog/providing-a-home-for-a-dog
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
狗是家人，需要一輩子的照顧，也會帶來責任。要先想清楚住所、好的食物與獸醫照護的花費，包括定期健康檢查、疫苗、寄生蟲控制（例如心絲蟲預防）、生病或緊急狀況的治療，以及牙齒保健。

養狗也有好處：人與動物之間會建立很深的連結。來源指出，養寵物有助於降低飼主的壓力、血壓、焦慮與憂鬱，對孤單、年長或行動不便的人特別有幫助，也能讓孩子學會負責與關懷他人。

---
id: beginner-dog-behavior-needs
title: 狗需要陪伴：無聊與孤單會造成行為問題
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Providing a Home for a Dog
source_url: https://www.merckvetmanual.com/dog-owners/selecting-and-providing-a-home-for-a-dog/providing-a-home-for-a-dog
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
狗是群居的社交動物，需要主人的關注。又無聊又孤單的狗，可能出現破壞東西，甚至傷害自己的行為問題。

不同品種的活力差很多：例如愛爾蘭長毛獵犬與大麥町比較有活力，紐芬蘭犬或貝吉格里芬（巴吉度）等比較沉穩，活力高的狗可能需要更多關注。如果家裡有小孩或其他寵物，選狗時要考慮牠的個性是否適合。

---
id: beginner-dog-exercise
title: 狗要運動多少：不足不行，過度也不行
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Providing a Home for a Dog
source_url: https://www.merckvetmanual.com/dog-owners/selecting-and-providing-a-home-for-a-dog/providing-a-home-for-a-dog
retrieved: 2026-11-01
status: draft_needs_review
note: 來源沒有給具體的運動分鐘數，AI 回答時不要自行編造；實際量請依品種、年齡與獸醫建議。
---
狗需要規律的運動才能保持健康、避免行為問題；運動量足夠的狗通常比較健康也比較快樂。

但運動過量也可能有害，特別是體能不好、很年幼或很年老的狗。要特別小心不要在炎熱或潮濕的天氣讓狗運動過度。像法國鬥牛犬、巴哥這類有呼吸問題的品種，可能無法應付長時間的運動，但短時間的散步仍然有益。

---
id: beginner-dog-feeding-basics
title: 新手餵狗基本功：看標示、餐數、零食與水
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Providing a Home for a Dog
source_url: https://www.merckvetmanual.com/dog-owners/selecting-and-providing-a-home-for-a-dog/providing-a-home-for-a-dog
retrieved: 2026-11-01
status: draft_needs_review
note: AAFCO 是美國的飼料標準；台灣的寵物食品標示方式可能不同，請與獸醫討論怎麼選。
---
營養對狗的健康很重要，但不是所有狗食都一樣。來源建議選擇有 AAFCO（美國飼料管理協會）標示的狗食，代表符合一定的營養標準。乾飼料通常比罐頭更好，因為有助於牙齒與牙齦健康，同時提供相同的營養。不同生命階段（幼犬、成犬、老年）都有適合的飼料；針對肥胖或過敏等問題的特殊飲食，有些只能透過獸醫取得。

多數成犬每天餵 1 到 2 次，幼犬需要更頻繁。大型犬要分成較小份、至少一天兩餐，以預防胃脹氣（胃擴張）。餵食要在安靜、不被打擾的地方。獸醫可以幫你算出該餵多少。

常見的問題是餵太多，會造成肥胖與其他健康問題。**零食與餐桌上的食物要限量，絕不能超過每天熱量的 10%。** 隨時提供乾淨的新鮮水，除非獸醫指示，否則不要限制飲水。**判斷是否過胖的簡單方式：** 大多數品種的狗，你應該隨時摸得到脊椎與肋骨，但看不出來。

---
id: beginner-dog-bed-crate-outdoor
title: 狗的床、籠子與室外飼養的條件
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Providing a Home for a Dog
source_url: https://www.merckvetmanual.com/dog-owners/selecting-and-providing-a-home-for-a-dog/providing-a-home-for-a-dog
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
室內的狗和人共用空間，有時也會共用家具。幼犬很適合有一個專屬的休息空間，通常是狗籠，有助於如廁訓練與其他訓練；許多成犬也會因為籠子是自己的空間而覺得安全。你也可以另外準備一張舒適的狗床。

來源提到，打獵犬與看門犬常常全年養在室外，這類狗有特別的需求：
- **住所**：要有乾淨、能遮風避雨的窩，大到狗能站起來與轉身；要有實心的屋頂，並且離地，避免潮濕；可用軟門簾擋雨雪。
- **營養**：寒冷天氣下，室外的狗需要兩倍的熱量保暖，要餵平常兩倍的高品質狗食，並分成較小的餐次，以避免消化問題。
- **陪伴**：狗是群居動物，不喜歡孤單；室外的狗仍需要其他狗的陪伴與人類頻繁的接觸，一起養的狗要有足夠空間，否則要有各自的窩。

---
id: beginner-dog-vet-visits-sick-signs
title: 帶狗看獸醫的頻率，以及怎麼知道狗生病了
species: dog
category: new_owner
related_event_types: [illness, appetite_loss, vomiting, diarrhea]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Routine Health Care of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/routine-health-care-of-dogs
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
看獸醫的頻率：
- **成犬**：至少每年一次完整健檢。
- **幼犬**：每 3 到 4 週一次，直到 4 個月大。
- **老年犬（7～8 歲以上）**：每年兩次或更頻繁。老狗比較容易生病，獸醫可能建議抽血或 X 光，及早發現問題。

狗可能生病的徵兆：不吃東西、活動力下降、嘔吐或腹瀉、排尿比平常多或少、咳嗽或打噴嚏、眼睛耳朵或鼻子有分泌物、掉毛、特別癢或皮膚出現紅點、跛行或不願意踩地。

如果狗出現這些徵兆超過一兩天，來源建議安排就醫；若同時有呼吸困難、倒下、持續嘔吐等嚴重狀況，不要等，請立即就醫。

---
id: beginner-dog-grooming-medicine
title: 幫狗梳毛、洗澡與餵藥的基本方法
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Routine Health Care of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/routine-health-care-of-dogs
retrieved: 2026-11-01
status: draft_needs_review
note: 來源也建議把藥藏在花生醬裡，本條刻意略去：部分花生醬含木糖醇，木糖醇對狗有毒（見 aspca-xylitol）。藥物一律依獸醫處方與標示使用。
---
**梳毛與洗澡**：要定期替狗梳毛，去除脫落的毛並預防毛結，毛厚或毛長的狗尤其重要。毛結會刺激皮膚，甚至造成感染。**不要用剪刀剪毛結**，很容易剪到皮膚；請改用寵物專用的電動剪。洗澡用寵物專用的洗毛精，大約每個月一次（依季節），或在毛很髒、有異味時洗。

**餵藥**：
- 藥丸：可以藏在一小塊起司或寵物專用的包藥零食裡；有時也可以輕輕握住狗的嘴，讓牠吞下去。若用其他食物包藥，要先確認成分不含木糖醇。
- 液體藥：用針筒對準後排牙齒附近噴進嘴裡，頭稍微向上抬，避免流出來。
- 外用藥：直接塗在皮膚或被毛上（頸部上方，讓狗舔不到）。滴眼藥或耳藥，請獸醫先示範給你看。

一律閱讀並遵守藥品標示。

---
id: beginner-dog-spay-neuter
title: 狗的結紮時機（母犬、公犬、大型犬）
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Routine Health Care of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/routine-health-care-of-dogs
retrieved: 2026-11-01
status: draft_needs_review
note: 台灣對結紮的法規與罰則本條不涉及。體重換算：45 磅約 20 公斤。
---
來源建議，除非要繁殖，所有的狗都應該結紮（母犬稱為絕育、公犬稱為去勢）。這可以避免意外懷孕，並降低日後某些健康問題的風險。

- **母犬**：大約在 6 個月大、第一次發情之前結紮，有助於預防乳腺癌與子宮癌。不過來源指出，對**大型犬（超過約 20 公斤）**的建議已經改變，會延後到 12 到 24 個月大才結紮，以降低髖關節發育不良等骨骼與關節疾病的風險。
- **公犬**：在 5 到 10 個月大時結紮，有助於預防尿液標記等行為問題。

實際時機請與獸醫討論。

---
id: beginner-dog-home-safety
title: 讓家裡對狗安全：化學品、防凍劑、有毒植物與電線
species: dog
category: new_owner
related_event_types: [poisoning]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Routine Health Care of Dogs
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/routine-health-care-of-dogs
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
要把有害的化學品，例如清潔用品、防凍劑與某些植物，放在狗拿不到的地方。愛啃咬的幼犬特別容易吞下這些有毒的東西。

幼犬愛咬電線，要把電線綁高、收到拿不到的地方；也可以在電線上噴苦味噴劑（例如苦蘋果噴劑）來讓牠不想咬。

另外，房子裡的小東西（可能被吞下去）、有毒植物、家用化學品，都應該收好或移出幼犬活動的範圍。

---
id: beginner-puppy-first-vet-vaccines
title: 幼犬剛回家：看獸醫、疫苗與驅蟲
species: dog
category: new_owner
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Puppy Care
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/puppy-care
retrieved: 2026-11-01
status: draft_needs_review
note: 疫苗細節請見 merck-vaccines-dogs；狂犬病在台灣的規定見 tw-rabies-annual-booster。本條是飼主版的簡化說明。
---
幼犬大約在 7 到 8 週齡可以離開媽媽，這時牠們可以自己吃東西。幼犬需要很多照顧，包括看獸醫、餵食、社會化與訓練。

**疫苗**：幼犬出生時與吃母乳時，會從媽媽那裡得到一些保護力（母源抗體）；在這個保護力消退之前，疫苗不太有效，所以要頻繁接種（每 2 到 3 週一次），直到大約 4 個月大。在完成全部疫苗之前，幼犬容易受感染，要避免接觸沒有打疫苗、或不確定疫苗狀況的狗。

**驅蟲**：幼犬常有腸道寄生蟲，可能從媽媽傳來。通常會在出生後幾週預防性驅蟲，獸醫每 2 到 4 週檢查一次糞便，直到連續兩次陰性。

---
id: beginner-puppy-feeding
title: 幼犬怎麼餵：餐數表與何時換成成犬飼料
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Puppy Care
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/puppy-care
retrieved: 2026-11-01
status: draft_needs_review
note: 這是飼主版的餐數建議，與專業版（merck-feeding-puppies：離乳到 6 個月一天三餐）略有差異（飼主版對 6～12 週建議 4 餐）；實際請依獸醫指示。
---
幼犬需要專門的幼犬飼料，提供成長所需足夠的熱量、脂肪、蛋白質、維生素與礦物質。選擇有 AAFCO 標示的幼犬飼料，代表符合一定的營養標準。多數的狗在 9 到 12 個月大成年，但大型與巨型犬可能要接近 2 年才成年。成年後，依品種從幼犬飼料換成成犬飼料。

幼犬年紀小時要一天餵好幾次，次數隨年齡遞減：

| 年齡 | 每天餐數 | 飼料種類 |
|---|---|---|
| 6～12 週 | 4 餐 | 幼犬飼料 |
| 3～6 個月 | 3 餐 | 幼犬飼料 |
| 6～12 個月 | 2 餐 | 幼犬飼料 |
| 超過 12 個月 | 1 或 2 餐 | 成犬飼料 |

---
id: beginner-puppy-housetraining
title: 幼犬如廁訓練：先做這件事，幾週內多半能學會
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Puppy Care；AAHA — What to do when you first bring home a new puppy
source_url: https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/puppy-care
retrieved: 2026-11-01
status: draft_needs_review
note: AAHA 頁面：https://www.aaha.org/resources/what-to-do-when-you-first-bring-home-a-new-puppy/
---
來源建議，最先要訓練的是如廁，讓幼犬不會在家裡大小便。及早開始，帶牠到正確的地方；只要有耐心與一致的做法，通常只要幾個星期。一開始要多帶幼犬出去，牠做對時要稱讚。

幼犬自然會想上廁所的時機：早上第一件事、晚上最後一件事、吃完飯、喝很多水之後、睡醒之後、玩耍之後，很小的幼犬在夜裡也會需要。

AAHA 補充了幾個重點：
- **監督**是最重要的因素：幼犬要隨時在有人看得到的範圍，才能在意外發生前帶牠出去。
- 建立固定的作息：固定時間餵食，規律的玩耍與休息。慢慢你會看出牠要上廁所的訊號，例如聞地面或轉圈。
- 做對時用輕鬆的方式稱讚、給一點零食。
- **意外一定會發生，那不是幼犬的錯。** 處罰幼犬會讓牠對如廁產生焦慮，反而更難訓練；請平靜地清理，並確保牠下一次有機會在正確的地方上。
- 要有睡眠不足的心理準備，特別是第一個月，需要半夜起來帶牠上廁所，可能要好幾個月牠才能整晚憋住。

---
id: beginner-puppy-crate-training
title: 幼犬的籠子訓練：用正向連結，不要強迫
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — What to do when you first bring home a new puppy
source_url: https://www.aaha.org/resources/what-to-do-when-you-first-bring-home-a-new-puppy/
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
籠子訓練對每隻幼犬都很重要：坐車、看獸醫與其他必要的情況，籠子能提供安全。要用正向的連結讓幼犬習慣，**絕不要硬把牠關進去，或讓牠哭到放棄**。

做法：把籠子放在幼犬看得到家人的地方，門保持打開，裡面放舒適的墊子，一整天在裡面放零食。**在牠願意主動進去休息之前，不要關門或上鎖。**

晚上用籠子不是絕對必要的。如果選擇晚上使用，要放在靠近你床邊的地方，讓幼犬感覺到你在身邊，你也聽得到牠需要上廁所。幼犬是社交動物，有陪伴會比較有安全感。

---
id: beginner-puppy-socialization
title: 幼犬的社會化：怎麼做、何時做，以及先建立信任
species: dog
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — What to do when you first bring home a new puppy；Merck Veterinary Manual（飼主版）— Puppy Care
source_url: https://www.aaha.org/resources/what-to-do-when-you-first-bring-home-a-new-puppy/
retrieved: 2026-11-01
status: draft_needs_review
note: Merck 頁面：https://www.merckvetmanual.com/dog-owners/routine-care-of-dogs/puppy-care 。疫苗未完成前能不能外出與接觸其他狗，請問獸醫。
---
社會化不是讓幼犬玩樂派對，而是幫助牠在各種情況下，學會對人與其他動物保持平靜放鬆。目標是讓幼犬看到其他狗時仍然專注在你身上，而不是不受控地玩成一團。

Merck 指出，社會化在 2 到 4 個月大尤其重要，與人、其他動物互動能讓幼犬習慣新的人與經驗，預防日後的恐懼或行為問題。有些訓練班收 8 週齡以上、已接種疫苗的幼犬。

AAHA 提醒：什麼時候安全（健康上）和社會化的發展期何時結束，是兩件不同的事，疫苗狀況與當地風險請問獸醫。實際做法：
- **受控的見面**：獸醫說安全後，安排安靜、有人監督、短暫而愉快的見面。
- **安全的暴露**：散步時可以抱著幼犬或用嬰兒推車，特別是附近可能有沒打疫苗的狗，讓牠遠遠觀察其他狗與人，不必強迫互動。
- **新奇事物**：每天在家裡讓幼犬認識一件新東西（吹風機、爆米花、搬動餐椅），散步時從遠處看滑板、機車、卡車；搭配零食與遊戲，建立適應力。

要先學會讀懂幼犬的肢體語言：往前（自信）或往後退（不確定或害怕）、尾巴夾住（焦慮）或放鬆搖擺（放鬆）、身體前傾（投入）或眉頭緊皺（擔心）。幼犬不舒服時，你要當牠的避風港，不要推開牠說「去交朋友」；如果 5 到 10 分鐘後牠仍然不想加入，就結束，改天再試。

AAHA 強調：**信任比服從更重要**。基本服從（坐下、待著）有用，但不該放在信任之前。日後的焦慮、過度反應與不想要的行為，幾乎都可以追溯到需求沒被滿足，而不是服從訓練不足。有小孩的家庭，孩子與幼犬的互動一定要有人監督，孩子要用玩具而不是手跟幼犬玩。

---
id: beginner-kitten-first-vet
title: 幼貓剛回家：第一週看獸醫、疫苗、驅蟲、結紮與晶片
species: cat
category: new_owner
related_event_types: [illness]
severity_hint: info
source: AAHA — New Kitten Checklist；Merck Veterinary Manual（飼主版）— Kitten Care
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: Merck 頁面：https://www.merckvetmanual.com/cat-owners/caring-for-cats/kitten-care 。AAHA 此頁說疫苗系列之後至少每年追加一次，與 Merck 專業版的疫苗指引（FPV-FCV-FHV-1 每 3 年）不同；AI 不要自行下結論，追加頻率請依獸醫。疫苗細節見 merck-vaccines-cats。
---
**第一週內帶去看獸醫**：獸醫會檢查整體健康，篩檢跳蚤與腸道蠕蟲等寄生蟲，也可能檢測貓白血病與貓免疫缺乏病毒，結果有助於決定幼貓能不能和其他貓接觸。獸醫還會檢查先天問題（例如心雜音、疝氣、顎裂），並開始疫苗系列。

去看獸醫之前，要先讓幼貓習慣外出籠：選舒服、能當床或可拆上蓋的籠子，讓牠先自己探索，並用零食獎勵牠待在裡面。

Merck 的飼主版指出，幼貓要每 3 到 4 週看一次獸醫，直到約 6 個月大，接受疫苗與寄生蟲處理；因為幼貓一開始有母源抗體，疫苗要按規律的時程接種，一般從 2 到 3 個月大開始。完成疫苗之前，要避免接觸沒打疫苗的貓。幼貓的腸道寄生蟲很常見，獸醫通常會預防性驅蟲，並重新檢查糞便；體外寄生蟲（跳蚤、壁蝨）只能用適合幼貓的產品。

**結紮**：AAHA 建議在 5 個月大之前安排。**晶片**：建議第一次就診或之後不久就植入。貓常會隱藏疼痛，要注意活動量、行為或食慾的小變化，並告訴獸醫。

---
id: beginner-kitten-feeding
title: 幼貓怎麼餵：幼貓飼料、餐數與熱量
species: cat
category: new_owner
related_event_types: []
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Kitten Care；AAHA — New Kitten Checklist
source_url: https://www.merckvetmanual.com/cat-owners/caring-for-cats/kitten-care
retrieved: 2026-11-01
status: draft_needs_review
note: AAHA 頁面：https://www.aaha.org/resources/new-kitten-checklist/ 。熱量數字是 AAHA 的整理，只當概念參考，實際餵多少請依幼貓體重與獸醫建議。
---
營養在整個貓生都很重要，在幼貓時期更是關鍵。成長中的幼貓需要額外的熱量、脂肪、蛋白質、維生素與礦物質，要吃專為幼貓設計的飼料，每天餵好幾餐。餐數可以隨年紀慢慢減少，但要持續餵營養均衡的幼貓飼料，直到成年（約 9 到 12 個月）。

AAHA 補充：多數幼貓在 3 到 5 週大轉換成市售幼貓食物；10 週大時每公斤體重每天約需 200 大卡，到 10 個月大降到約 80 大卡。結紮會增加體重上升的風險，要和獸醫一起規畫餵食。餵食要在安靜、低壓力的地方，也可以把小份食物藏起來、或用益智餵食器，讓貓維持自然的覓食行為。

---
id: beginner-litter-box
title: 貓砂盆怎麼設：數量、大小、位置、清潔
species: cat
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
- **數量**：每隻貓一個貓砂盆，再多加一個（一隻貓就準備兩個）。
- **位置**：放在不同、容易到達的地方。
- **大小**：貓砂盆的長度至少要是貓身長的 1.5 倍；許多市售貓砂盆太小，收納箱也可以，只要幼貓爬得進去。
- **貓砂**：讓幼貓及早接觸不同種類的貓砂，可能提高日後的接受度。
- **清潔**：每天鏟，並定期用熱水清洗貓砂盆，避免用強烈的清潔劑。

如果貓開始在貓砂盆以外的地方大小便，或和其他貓發生攻擊，就是該看獸醫的時候，不要讓貓自己「打出結果」，要盡量把牠們分開並尋求建議。

---
id: beginner-kitten-home-safety
title: 讓家裡對幼貓安全：有毒植物（百合）、藥物與繩線
species: cat
category: new_owner
related_event_types: [poisoning]
severity_hint: info
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
在幼貓回家之前，先把有毒植物移走。**百合對貓的風險很高，即使只接觸一點點，也可能造成腎衰竭。**（見 merck-aki-toxins）

藥物要收在關起來的門後面，掉在地上的藥丸要馬上撿起來。常見的風險包括乙醯胺酚（普拿疼類）、注意力不足過動症的藥物與避孕藥。

也要檢查環境中的危險：電線、繩子、沒固定好的紗窗；窗簾與百葉窗的拉繩要收好，避免勒住幼貓。

---
id: beginner-cat-scratching-claws
title: 貓為什麼抓東西，怎麼準備抓板與修剪指甲
species: cat
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
貓抓東西是正常的行為：它能磨掉舊指甲、用費洛蒙在物品上留下氣味當作標記，也能留下領域的視覺記號。

**要提供多處可以抓的地方**，放在休息的地方附近與經常經過的動線上。一項研究發現，幼貓與年輕的貓比較喜歡繩子材質，勝過地毯或紙板，但每隻貓都不同；簡單的直立式抓板，或兩層以上、高度至少約 1 公尺的貓跳台，被使用的次數比較多；底座較窄的抓板，比底座很寬的更常被使用。

以前幼貓結紮時順便被去爪的做法已經過時，現在飼主可以輕鬆自己處理貓的指甲照護：先和幼貓玩腳掌，按壓腳墊讓指甲露出來，用小型的人用指甲剪或貓用指甲剪，剪掉尖端；**避開看起來粉紅色的部分，那是血管。**

---
id: beginner-kitten-play-behavior
title: 幼貓的玩耍與行為：溫柔對待、不要用手腳當玩具
species: cat
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — New Kitten Checklist；Merck Veterinary Manual（飼主版）— Kitten Care
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: Merck 頁面：https://www.merckvetmanual.com/cat-owners/caring-for-cats/kitten-care 。
---
驚嚇或粗魯的對待可能讓幼貓產生終身的恐懼，所以要溫柔對待，慢慢讓牠正向地適應各種刺激，用食物或有吸引力的獎勵，讓牠用自己的步調靠近你。

幼貓的玩耍慾很強，會從觀察、拍、追、撲、抓學習狩獵行為；12 週大以前想和其他幼貓玩，之後比較想玩物品。**不要用手或腳當玩具**，貓會以為這樣可以，造成日後的咬傷與抓傷。

Merck 指出，貓和母貓、同胎的貓學習如何社交；要成為習慣和人相處的好寵物，幼貓通常在 10 到 12 週大前就需要接觸人類。陪牠玩、提供互動式玩具，有助於建立親密的關係並減少破壞行為。

AAHA 提醒，行為問題是貓被送進收容所的主要原因之一，早點處理很重要。有科學資料支持用費洛蒙噴霧或插電式擴香來幫助貓保持平靜。

---
id: beginner-cat-routine-care
title: 養貓日常保健：看獸醫頻率、生病徵兆、刷牙
species: cat
category: new_owner
related_event_types: [illness, appetite_loss, vomiting, diarrhea]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Routine Health Care of Cats；AAHA — New Kitten Checklist
source_url: https://www.merckvetmanual.com/cat-owners/caring-for-cats/routine-health-care-of-cats
retrieved: 2026-11-01
status: draft_needs_review
note: AAHA 頁面：https://www.aaha.org/resources/new-kitten-checklist/ 。
---
看獸醫的頻率：
- **成貓**：至少每年一次完整健檢。
- **幼貓**：每 3 到 4 週一次，直到約 6 個月大。
- **老年貓（超過 8～9 歲）**：每年兩次或更頻繁；獸醫可能建議定期抽血，檢查慢性病的早期徵兆。
- **看起來不舒服的貓**：立刻帶去看獸醫。

疫苗對所有的貓都很重要，不論是否出門；獸醫會依你住的地方與貓的生活型態建議。

貓常見的生病徵兆：不吃東西、嘔吐（包括頻繁吐毛球）、腹瀉或糞便又乾又硬、喝水與排尿增加、咳嗽或喘鳴、打噴嚏（特別是眼鼻有分泌物）、耳朵癢或髒、掉毛或全身癢、僵硬、跛行或不願意踩腳。若出現這些，或其他讓你擔心的事，建議看獸醫。

貓一輩子都需要牙齒保健。AAHA 指出，約 80% 的貓在 3 歲前就會有牙科疾病；牙刷最理想是每天刷，但一週一次比較實際。多數貓需要慢慢習慣：先把有味道的牙膏凝膠放在牙刷上讓幼貓舔，再慢慢進展到碰牙齒。牙齒保健細節見 merck-cat-dental-care。

---
id: beginner-cat-indoor-outdoor
title: 貓要不要出門：室內飼養的好處與要補的功課
species: cat
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
研究顯示，只養在室內的貓，感染、寄生蟲與受傷的風險比較低。但室內生活可能增加肥胖、生病與行為問題的風險。

有些飼主選擇讓貓有受監督的戶外時間來增加豐富度，例如牽繩散步，或使用封閉的戶外空間。獸醫團隊可能會問你有沒有其他寵物、旅行或寄宿，這些資訊有助於擬定照護計畫。

---
id: beginner-pet-microchip
title: 寵物晶片：用來找回走失的寵物，不是 GPS
species: both
category: new_owner
related_event_types: []
severity_hint: info
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 這條是 AAHA 對幼貓的建議，概念同樣適用於狗；台灣的寵物登記規定見 tw-pet-registration-cats-2026（待官方來源）與 tw-owner-legal-duties。
---
建議在第一次看獸醫時，或之後不久，就幫寵物植入晶片。晶片是永久的身分識別，有助於讓走失的寵物回到飼主身邊。

**晶片不是 GPS，不能追蹤位置**；收容所與診所可以掃描晶片，取得你的聯絡資料。所以聯絡資料變更時，記得更新。如果想追蹤貓的位置，要另外買貓專用的追蹤項圈，狗用的追蹤項圈太重、精準度也不夠。

---
id: beginner-kitten-when-to-call-vet
title: 幼貓什麼時候要聯絡獸醫：不吃、行為突變、公貓用力尿不出來
species: cat
category: emergency
related_event_types: [appetite_loss, illness]
severity_hint: emergency_if_male_straining
source: AAHA — New Kitten Checklist
source_url: https://www.aaha.org/resources/new-kitten-checklist/
retrieved: 2026-11-01
status: draft_needs_review
note: 公貓用力尿不出來的處置見 merck-urethral-obstruction。
---
如果幼貓不吃東西，或行為突然改變，要聯絡獸醫，這常常代表有潛在問題。上呼吸道感染會讓幼貓聞不到食物的味道而降低食慾，有些情況需要獸醫處理。

**公貓可能因為泌尿道阻塞而用力想尿，這種情況可能很快危及生命。** 如果看到用力排尿、叫、或一直進出貓砂盆，要立刻就醫。

---
id: tw-owner-legal-duties
title: 台灣：誰是飼主、飼主的基本法定責任
species: both
category: regulation
related_event_types: []
severity_hint: info
source: 法務部 114.09.15 法律字第 11403511100 號函（引用動物保護法第 3、5、20 條）
source_url: https://laws.gov.taipei/law/Interpretation/ContentExport/FE392533?type=5
retrieved: 2026-11-01
status: draft_needs_review
note: 這是政府機關的法律函釋，引用動保法條文；我沒有直接讀到動保法全文，罰則金額（含近期修法）本條刻意不寫。動保法在 2026 年 1 月曾有修正草案（見 tw-animal-protection-act-amendment-2026-draft），實際現行條文請以全國法規資料庫為準。
---
依動物保護法（引用自法務部函釋）：
- **飼主**是指動物的所有人，或實際管領動物的人。
- 飼主如果是自然人，**以成年人為限**。未成年人飼養動物時，是以他的法定代理人或監護人為飼主，所以未成年人養寵物，法律上的責任落在家長或監護人身上，不論他們有沒有疏於管教。
- 飼主對於管領的動物有照護責任，包括要避免動物遭受騷擾、虐待或傷害；**不得棄養動物**。
- 寵物出入公共場所或公眾得出入的場所，**不得沒有 7 歲以上的人陪同**。
- 任何人都不得騷擾、虐待或傷害動物。

---
id: tw-animal-protection-act-amendment-2026-draft
title: 台灣：動保法修正草案（2026 年 1 月行政院通過，送立法院審議）
species: both
category: regulation
related_event_types: []
severity_hint: info
source: 聯合新聞網、今周刊（Business Today）、台灣新聞報導（引用農業部與行政院）
source_url: https://udn.com/news/story/7470/9253243
retrieved: 2026-11-01
status: needs_primary_source
note: **這是新聞報導，而且只是草案**；我不知道目前（2026 年 11 月）是否已經三讀通過、內容有沒有修改。所以入庫時會設為不啟用；請查農業部或全國法規資料庫的現行條文再決定。
---
依報導，行政院在 2026 年 1 月 8 日通過動物保護法部分條文修正草案，送立法院審議，共修正 27 條，重點包括：
- 明確棄養的構成要件：把寵物送到收容所如果不符合「一定條件」，視為棄養；寵物遺失後，飼主必須在遺失事實發生次日起 5 日內申報，否則（沒有受傷、住院等正當理由時）也視為棄養。
- 棄養的罰鍰，草案從現行的 3 萬到 15 萬元，提高為 10 萬到 100 萬元。
- 強化犬貓絕育規範，免絕育由申報制改為申請制。
- 提高虐待動物的刑責，並加重非法繁殖買賣、擅自經營寵物寄養的罰則。

這些都是草案內容，是否生效、細節是否修改，需以官方公告為準。

---
id: merck-fleas-life-cycle
title: 跳蚤的生活史：為什麼只治寵物不夠，環境也要處理
species: both
category: parasite
related_event_types: [allergy, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Fleas in Dogs and Cats
source_url: https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/fleas-in-dogs-and-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 來源是給獸醫看的專業版（2026 年 4 月全面審閱），已改寫成飼主能懂的說明；物種與氣候資料以北美為例，台灣的季節（較溫暖潮濕）請依獸醫建議。Merck 另有飼主版（狗：https://www.merckvetmanual.com/dog-owners/skin-disorders-of-dogs/fleas-of-dogs ；貓：https://www.merckvetmanual.com/cat-owners/skin-disorders-of-cats/fleas-of-cats），我沒有讀到。
---
全世界有超過 2,200 種跳蚤，但狗和貓身上最常見的是貓蚤（*Ctenocephalides felis*），不管是狗還是貓，主要都是被貓蚤寄生。

**成蟲才住在寵物身上**，卵、幼蟲、蛹都在環境裡：
- **卵**：母蚤把卵產在被毛裡，卵很容易掉到床墊、地毯或土壤，約 1～6 天孵化。母蚤在第一次吸血後 24～48 小時開始產卵，高峰期每天可產 40～50 顆，平均約 27 顆。
- **幼蟲**：住在環境裡，吃環境中的有機碎屑與成蟲排出的糞便，會躲到地毯深處或陰暗潮濕的地方，**怕乾燥**（長時間濕度低於 50% 會死亡）。幼蟲期通常 5～11 天，可拉長到 2～3 週。
- **蛹**：幼蟲結繭化蛹，繭會沾上灰塵與地毯纖維。蛹約 1～2 週後可羽化；但羽化出來的成蟲可以在繭裡等待，最長可延遲約 30 週，等到有溫度、二氧化碳、震動等刺激才出來。
- **成蟲**：剛羽化、還沒吸血的成蟲會找上寵物，也會叮人。成蟲上了寵物後約 5 分鐘就開始吸血，吸血後多半留在同一隻宿主身上。

在一般家庭，整個生活史大約 3～8 週完成（最快 12～14 天，最長可到 350 天）。

家裡跳蚤容易滋生的地方：寵物的床、沙發、寵物吃飯或睡覺的角落、地毯深處、木地板縫隙。戶外則是**有遮蔭又潮濕**的地方，例如陽台、門廊、狗屋、灌木叢下、沙地。

跳蚤怕冷：連續幾天低於 3°C，各階段都無法存活；但成蟲可以在沒治療的狗貓、或浣熊等小型野生動物身上過冬。

跳蚤吸血後排出的**「跳蚤糞便」是紅黑色的小顆粒或短捲條**，常被誤認成髒污。

---
id: merck-fleas-health-risks
title: 跳蚤不只是癢：貧血、絛蟲、巴爾通氏菌與人畜共通
species: both
category: parasite
related_event_types: [allergy, illness, diarrhea]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Fleas in Dogs and Cats
source_url: https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/fleas-in-dogs-and-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 疾病分布（例如斑疹傷寒的流行地區）來源以美國為例，台灣的情況請以官方與獸醫說明為準；本條只說明機轉與風險，不評估台灣的流行率。
---
跳蚤的唾液含有類組織胺的物質、酵素與抗原蛋白，可能刺激皮膚或引起過敏，所以會造成嚴重搔癢，是跳蚤過敏性皮膚炎的原因（見 merck-flea-allergy-dermatitis）。

跳蚤還會帶來這些問題：
- **貧血**：嚴重寄生時，可能造成缺鐵性貧血，**幼小的動物特別容易**。
- **絛蟲**：常見的犬貓腸道絛蟲（*Dipylidium caninum*）以跳蚤為中間宿主。跳蚤幼蟲會吃進絛蟲卵；狗貓在理毛時吃下帶蟲的跳蚤，絛蟲就進到消化道（偶爾也會感染小孩）。
- **巴爾通氏菌（貓抓病）**：細菌住在跳蚤身上，**人是因為跳蚤糞便碰到抓傷或咬傷的傷口而被感染**。貓被感染通常沒有症狀，偶爾有自限性的發燒；狗反而比較可能出現臨床症狀，包括發燒、淋巴結發炎、心內膜炎。
- **人類的斑疹傷寒（跳蚤傳播的立克次體）**：症狀包括頭痛、發冷、皮疹，來源說美國的傳播循環涉及負鼠、貓與貓蚤。

所以跳蚤的控制不只是為了寵物不癢，也和家人的健康有關。

---
id: merck-fleas-control
title: 跳蚤控制：三個步驟、為什麼要三個月、為什麼要長期做
species: both
category: parasite
related_event_types: [allergy, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Fleas in Dogs and Cats；Flea Allergy Dermatitis in Dogs and Cats
source_url: https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/fleas-in-dogs-and-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 來源有完整的藥名、機轉、頻率表，本條刻意全部略去；除蚤產品要依物種與體重選擇，請由獸醫開立或建議，不要讓 AI 或飼主自行決定產品。來源也沒有說明各產品對貓、狗的物種安全差異，AI 不要自行推論。FAD 頁面：https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/flea-allergy-dermatitis-in-dogs-and-cats
---
跳蚤控制有三個目標：**消滅寵物身上的跳蚤、清除環境裡既有的跳蚤、預防再度感染**；同時對皮膚發炎做必要的照護。

**第一步是先消滅寵物身上的跳蚤。** 現在已有外用、口服、注射等多種長效產品。不同產品起效的速度不一樣：有些外用藥要 12～36 小時才擴散到全身，有些會被吸收進血液、能在約 12 小時內殺死大部分跳蚤。有些除蚤產品會同時含心絲蟲、腸道寄生蟲的預防成分，方便飼主持續使用。選哪一種、多久用一次，請問獸醫。

**第二步是處理環境。** 使用有殘效的藥物，能在新跳蚤開始產卵前就殺死它們，也能阻止繁殖。輔助的做法是**機械式清除**：定期清洗寵物的毯子、地墊、外出籠，仔細吸塵寵物睡覺與休息的地方、沙發椅墊縫隙、沙發與床底下。只有在大量寄生、或寵物或人嚴重過敏時，才可能需要用環境藥劑處理，這類情況請問獸醫。

**為什麼要三個月：** 就算用的產品 100% 有效，環境裡已經存在的蛹、卵與幼蟲還是會陸續羽化，所以要完全控制，**通常需要 2～3 個月**。

**不要期待一用藥就立刻看不到跳蚤：** 許多產品不是驅蚊式的「驅避」，也不會在幾分鐘內殺光新來的跳蚤。跳蚤可能存活 6～24 小時才碰到藥，所以治療期間，寵物身上仍可能偶爾看到幾隻跳蚤，**最長可到約 8 週**，直到環境裡的感染源被清掉。

**同住的動物都要一起處理。** 來源強調：只治療其中一隻、或是治好就停藥，都容易復發；**要持續終身的跳蚤控制**。另外，院子裡可能有野生動物、流浪貓狗帶來跳蚤，人也可能把跳蚤帶回家。跳蚤只在遮蔭、潮濕的地方發育，在沒有遮蔭的大片草皮上大範圍噴藥通常沒有幫助，也不環保。

---
id: merck-flea-allergy-dermatitis
title: 跳蚤過敏性皮膚炎與搔癢：狗和貓癢的位置不一樣
species: both
category: symptom
related_event_types: [allergy, illness]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Flea Allergy Dermatitis in Dogs and Cats
source_url: https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/flea-allergy-dermatitis-in-dogs-and-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 來源是給獸醫看的專業版（2026 年 4 月全面審閱），已改寫成飼主能懂的說明，刻意略去藥名與劑量（類固醇、止癢藥等一律由獸醫處方）。搔癢不一定是跳蚤，本條已列出其他可能原因，AI 回答時不要直接斷定。
---
跳蚤過敏性皮膚炎（FAD）是對**跳蚤叮咬時注入的唾液**過敏，不是蟲多才會發生，只要少量的叮咬就可能很癢。診斷時會看病史、症狀、是否看到跳蚤或跳蚤糞便，並排除其他原因；對除蚤的反應也可以當作診斷的依據。

**狗**：搔癢與皮膚病變主要出現在**背部中段到尾端、尾根、後大腿與大腿內側**。常見的是掉毛（因為舔、咬、抓造成）與小丘疹加結痂。慢性的話，皮膚可能整片禿毛、變黑、變厚；癢得很嚴重時，會一直舔、咬、抓、磨蹭，可能造成急性濕疹（熱點），也容易併發細菌或 *Malassezia* 酵母菌皮膚感染，這些都需要額外治療。久了，臉和耳朵也可能受影響。

**貓**：症狀從很輕微到很嚴重都有，常見是帶結痂的小丘疹（粟粒性皮膚炎）、**頭頸部搔癢**、自己舔到禿毛、被毛看起來亂糟糟，也可能出現嗜伊紅性肉芽腫複合症候群（潰瘍、肉芽腫、斑塊）。部位以背部、尾根、後大腿、鼠蹊、頭頸部最常見。

**搔癢不一定是跳蚤。** 來源列出的其他可能：狗的環境或食物過敏（異位性皮膚炎）、疥蟎或毛囊蟲、其他體外寄生蟲；貓的其他體外寄生蟲（例如耳疥蟲、恙蟎、虱子）、皮癬菌（黴菌）、環境或食物過敏、繼發感染。所以癢很久、一直在抓咬或皮膚破皮，建議看獸醫確認。

**重要觀察：** 非常過敏的貓（特別是愛理毛的貓）可能因為舔得太乾淨，身上幾乎找不到跳蚤，要靠「除蚤後症狀有沒有改善」來判斷。

治療的核心是先消滅跳蚤並持續預防（見 merck-fleas-control）。來源強調：止癢或消炎的藥只能讓動物舒服一點，**不能取代除蚤**；繼發的皮膚感染也要處理。

---
id: merck-flea-check-method
title: 怎麼檢查寵物有沒有跳蚤：看跳蚤糞便與用密齒梳
species: both
category: symptom
related_event_types: [allergy]
severity_hint: info
source: Merck Veterinary Manual（專業版）— Flea Allergy Dermatitis in Dogs and Cats
source_url: https://www.merckvetmanual.com/integumentary-system/fleas-and-flea-allergy-dermatitis/flea-allergy-dermatitis-in-dogs-and-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 
---
檢查跳蚤的方法：
- **逆著毛的方向慢慢撥開被毛**，常能看到快速移動的跳蚤，或是跳蚤糞便。
- 用**密齒的除蚤梳**（約每英寸 32 齒），更容易梳出跳蚤與糞便。
- **跳蚤糞便**是紅黑色、圓柱形、像小顆粒或逗點的東西。把它放在水裡、或放在濕的紙巾上壓碎，**會溶開變成紅褐色**（因為是乾掉的血），這樣就能和一般的髒污分辨。
- 也可以檢查寵物的床墊有沒有卵、幼蟲與糞便。

找不到跳蚤，不代表一定沒有：很敏感的動物（特別是貓）可能舔得很乾淨。

---
id: merck-dog-osteoarthritis
title: 狗的關節炎（退化性關節疾病）：徵兆、處理與減重
species: dog
category: chronic_disease
related_event_types: [illness]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Osteoarthritis (Degenerative Joint Disease)
source_url: https://www.merckvetmanual.com/dog-owners/bone-joint-and-muscle-disorders-of-dogs/osteoarthritis-degenerative-joint-disease
retrieved: 2026-11-01
status: draft_needs_review
note: 這條是根據搜尋結果片段整理（飼主版頁面很短，片段幾乎涵蓋全文），仍建議入庫前再打開原頁核對。貓的關節炎我沒有找到適合的飼主版來源，所以沒有收；用藥一律由獸醫決定。
---
關節炎是**自由活動的關節，軟骨隨著時間退化**，造成關節活動變差，許多情況會痛。退化可能由外傷、感染、自體免疫、或發育時的畸形造成，接著引起關節膜發炎、軟骨持續被破壞。

徵兆包括：**跛行、關節腫脹、肌肉萎縮**，以及關節膜變厚、有疤痕。

治療分藥物與手術：
- **一般性的處理**：需要的話要減重、在柔軟的地面運動、對患部熱敷。
- **藥物**：獸醫可能依狗的症狀、年齡與整體健康狀況，開立消炎止痛藥。來源提醒，狗**長期使用這類藥物**，有時會造成腸胃問題，例如食慾下降、嘔吐、胃腸發炎。類固醇也能抑制發炎，但通常只短期使用，避免長期的副作用。另有關節液調節劑或其他止痛方式。**用什麼藥由獸醫決定。**
- **手術**：包括關節鏡、關節穩定或融合、人工關節置換。預後依關節的位置與嚴重度而定。

人用止痛藥（消炎止痛藥類）也是動物急性腎損傷的常見原因之一（見 merck-aki-toxins），所以不要自行給藥。

---
id: merck-cat-hyperthyroidism
title: 貓的甲狀腺機能亢進：吃很多卻變瘦、愛叫、喝水尿尿變多
species: cat
category: chronic_disease
related_event_types: [illness, vomiting, diarrhea, appetite_loss]
severity_hint: info
source: Merck Veterinary Manual（飼主版）— Disorders of the Thyroid Gland in Cats；（專業版）— Hyperthyroidism in Animals
source_url: https://merckvetmanual.com/cat-owners/hormonal-disorders-of-cats/disorders-of-the-thyroid-gland-in-cats
retrieved: 2026-11-01
status: draft_needs_review
note: 這條是根據搜尋結果的多個片段整理，尚未讀完整頁，入庫前請再打開原頁核對。專業版頁面：https://www.merckvetmanual.com/endocrine-system/the-thyroid-gland/hyperthyroidism-in-animals 。藥名與劑量一律略去。
---
甲狀腺機能亢進是甲狀腺荷爾蒙（T3、T4）過多，**最常見於中年到老年的貓**（專業版說多半是 7 歲以上）。最常見的原因是產生荷爾蒙的**良性甲狀腺腫瘤**，通常兩側甲狀腺都會變大，獸醫有時摸得到。

症狀反映的是代謝變快，最常見的包括：**體重下降（但食慾很好、甚至很貪吃）**、過度興奮（專業版也提到愛叫）、喝水與排尿增加、嘔吐、腹瀉、糞便量變多。心臟方面可能出現心跳變快、心雜音、呼吸急促、心臟擴大，甚至充血性心臟衰竭。少數的貓反而是食慾下降、嗜睡、沒精神，但體重下降仍然很常見。

診斷依據病史、症狀與身體檢查，並用**抽血測甲狀腺荷爾蒙**確認。專業版提醒：甲狀腺機能亢進可能掩蓋慢性腎臟病，所以獸醫會一併評估腎功能（見 merck-ckd-overview）。

治療方式有：放射性碘（通常被建議，簡單、有效、安全）、手術切除甲狀腺、長期的抗甲狀腺藥物（每天給藥），或**終身的處方飲食**（限制碘）。處方飲食對輕度的貓比較有效，對嚴重的可能無效，而且**貓必須只吃這種食物，其他貓食、人的食物、零食都會讓療效失效。** 用藥治療的前 3 個月最容易出現副作用，所以前幾週到前 3 個月要頻繁抽血追蹤（每 2～4 週），之後通常每 3～6 個月檢查一次。

出現體重下降卻很能吃、變得愛叫、喝水尿尿變多等情況，建議帶去看獸醫，不要自行判斷。
