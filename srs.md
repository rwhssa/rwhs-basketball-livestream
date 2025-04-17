高中籃球賽事直播系統 \- 軟體需求規格 (SRS)
版本： 1.3 (採用 Svelte 5 與最佳實踐)
日期： 2025年4月22日

1. 簡介
   1.1. 目的
   本文件旨在說明「高中籃球賽事直播系統」的功能與非功能性需求。此系統的主要目標是將高中籃球比賽的準決賽與決賽，透過特定的畫面處理流程，即時串流至 Instagram Live。本文件將作為開發團隊進行設計、實作與測試的主要依據。
   1.2. 範圍
   本系統涵蓋以下範圍：
   * 接收來自手機端（最多兩支）的即時影像訊號。
   * 從 Google Sheets 即時擷取比賽分數資料。
   * 提供管理介面以監看比賽畫面及（決賽時）切換主要畫面來源。
   * 根據比賽階段（準決賽/決賽）動態合成最終輸出畫面。
   * 最終輸出畫面符合 Instagram Live 的垂直畫面比例 (9:16)。
   * 與 OBS 整合，由 OBS 擷取系統產生的畫面並推播至 Instagram Live。

   不在此範圍內：

   * OBS 軟體的安裝、設定與操作細節。
   * Instagram 帳號管理與直播權限設定。
   * Google Sheets 的建立與維護。
   * VPS 伺服器的購買、作業系統安裝與基礎網路設定。
   * 手機端直播 App 的原生開發。
2. 整體描述
   2.1. 產品願景
   本系統為 Web 應用程式，旨在簡化多路手機影像訊號與即時分數整合，並針對 Instagram Live 進行垂直畫面直播的流程。系統將利用 LiveKit 處理 WebRTC 通訊，Rust 後端處理資料整合與邏輯，Svelte 5 前端提供操作介面與最終畫面輸出。系統將作為 OBS 的一個畫面來源，並與外部的 LiveKit 伺服器、Google Sheets、OBS 以及 Instagram Live 平台互動。
   2.2. 產品功能
   * 即時影像接收：接收來自手機的即時影像串流。根據比賽階段分配手機角色。
   * 即時分數整合：從 Google Sheets 讀取比賽分數並即時更新。
   * 管理與監看：提供 Web 管理介面，供操作員監看畫面及執行必要操作。
   * 畫面動態合成：根據比賽階段及操作員指令，動態合成最終輸出畫面。
   * 垂直畫面輸出：確保畫面符合 9:16 比例。
   * OBS 整合：提供可由 OBS 透過「瀏覽器來源」擷取的網頁端點。

   2.3. 使用者特性管理員/操作員：需具備基本電腦操作能力，能理解直播流程。負責監看畫面、確認分數、在決賽時執行畫面切換。手機攝影操作員：負責操作手機進行拍攝。需能使用手機瀏覽器開啟指定網頁，並依照指示授權攝影機/麥克風權限及選擇當前拍攝情境（例如選擇場地或角度）。2.4. 一般限制

   * 技術棧：前端必須使用 Svelte 5，後端必須使用 Rust，WebRTC 基礎設施必須使用 LiveKit。
   * 部署環境：LiveKit 伺服器與 Rust 後端需部署於 VPS。
   * 輸出平台：直播最終目的地為 Instagram Live，輸出畫面需為 9:16 垂直比例。
   * 安全性：需實作基礎的 LiveKit Token 驗證機制。不應有硬編碼 (Hardcode) 的敏感資訊。

   2.5. 假設與依賴

   * 假設 VPS 具有足夠的 CPU、RAM 及頻寬來運行 LiveKit 與 Rust 後端。
   * 假設所有手機、管理端電腦、VPS 伺服器皆有穩定且足夠的網際網路連線。
   * 假設 Google Sheets 文件結構符合系統讀取要求，且能被 Rust 後端存取。
   * 假設操作員已正確安裝、設定 OBS，並了解如何新增瀏覽器來源及設定 Instagram 直播。
   * 假設 LiveKit 伺服器已正確安裝、設定（包含 TURN 伺服器以確保 NAT 穿透）。
   * 假設手機瀏覽器支援 WebRTC 及所需功能。
3. 具體需求
   3.1. 功能性需求 (Functional Requirements)
   * FR-MODE-SWITCH: 系統模式切換
     提供機制（例如透過管理介面操作觸發），讓 Admin Page 與 Output Page 能在「準決賽模式」與「決賽模式」之間切換，並相應地調整其行為與畫面佈局。此狀態切換需透過 Svelte 的狀態管理機制 (例如 writable 或 derived store) 實作，確保所有元件同步更新。
   * FR-AUTH-TOKEN: LiveKit 連線權杖產生
     Rust 後端應能使用 LiveKit Secret Key 安全地產生具有時效性及參與者身份/中繼資料 (Metadata) 的連線 Token。
     Metadata 應至少包含 phase (semi/final), game (game1/game2/final), angle (main/angle1/angle2) 等資訊，以利前端識別影像來源。
   * FR-INPUT-JOIN: 手機影像來源加入
     手機端 Svelte 頁面應能向 Rust 後端請求連線 Token。
     獲取 Token 後，手機端應使用 LiveKit JS SDK 加入指定的 LiveKit 房間。
     手機端 Svelte 頁面應提供機制（例如簡單的下拉選單或設定），讓操作員能指定當前手機所代表的比賽階段、場地或角度，並將此資訊包含在發布至 LiveKit 的 Metadata 中。 建議使用 Svelte 的表單綁定功能 (bind:value) 來簡化表單處理。
     手機端應請求攝影機權限，並將影像與聲音「發布 (Publish)」至 LiveKit 房間，同時帶上指定的 Metadata。
   * FR-SCORE-PUSH: 即時分數推送
     Rust 後端應建立 WebSocket 服務。
     當 Google 試算表中的分數資料有變動時，應透過 Google Apps Script 偵測此變動。
     Google Apps Script 應將更新的分數資料以 HTTP POST 請求發送至 Rust 後端的一個特定 API 端點。更明確地說，當 Google 試算表中的分數資料發生變化時，Google Apps Script 將會被觸發，並將更新的分數資料發送到 Rust 後端。
     Rust 後端接收到分數資料後，應透過 WebSocket 將包含階段 (phase) 與分數 (scores) 的結構化資料推送給所有已連線的前端客戶端（Admin Page, Output Page）。 建議使用 Svelte 的 store 來管理接收到的分數，以便在多個元件間共享。
   * FR-ADMIN-DISPLAY: 管理介面顯示
     Admin Page 應能從後端獲取 Token 加入 LiveKit 房間。
     Admin Page 應能根據目前系統模式顯示對應的介面佈局。 建議使用 Svelte 的動態元件 (\<svelte:component\>) 來根據模式切換顯示不同的 UI。
     * 準決賽模式: 應訂閱並同時顯示來自兩支手機（分別代表 game1 與 game2） 的主要影像畫面預覽，並顯示對應的即時分數。
     * 決賽模式: 應訂閱並同時顯示來自兩支手機（分別代表 angle1 與 angle2） 的影像畫面預覽，並顯示決賽的即時分數。
   * FR-ADMIN-CONTROL: 管理介面控制 (決賽模式)
     在決賽模式下，Admin Page 應提供清晰的控制項（例如按鈕），讓操作員選擇要作為主畫面的攝影機角度。 建議使用 Svelte 的事件處理機制 (on:click) 來處理按鈕點擊事件。
     當操作員選擇角度時，Admin Page 應透過 LiveKit DataChannel 發送包含 action: 'switch\_source' 與目標 targetSid (被選中手機的 Participant SID) 的指令訊息。
   * FR-OUTPUT-SEMI: 輸出畫面渲染 (準決賽模式)
     Output Page (obs-output.html) 應設計為 9:16 的垂直畫面比例。
     在準決賽模式下，Output Page 應：
     * 加入 LiveKit 房間並連接後端 WebSocket。
     * 根據 Metadata 訂閱來自兩支手機（分別代表 game1 與 game2） 的主要橫向 (16:9) 影像與聲音流。
     * 在垂直畫面中，以上下分割 (Top/Bottom Split) 的方式同時渲染這兩個橫向影像流。需使用 CSS (object-fit: cover 或其他策略) 處理畫面裁切或填滿。 建議使用 Svelte 的 {\#each} 區塊來動態渲染影像元素。
     * 接收並顯示兩個場次的即時分數，疊加在對應的影像區域附近。 建議將分數資料儲存在 Svelte 的 store 中，以便在畫面更新時自動更新。
   * FR-OUTPUT-FINAL: 輸出畫面渲染 (決賽模式)
     Output Page 應：
     * 加入 LiveKit 房間並連接後端 WebSocket。
     * 監聽 LiveKit DataChannel 上的 switch\_source 指令。
     * 初始狀態下，預設訂閱其中一個角度（例如 angle1）的垂直 (9:16) 影像與聲音流。
     * 收到 switch\_source 指令後，取消訂閱舊的流，並根據指令中的 targetSid 僅訂閱被選中的那個垂直 (9:16) 影像與聲音流。 建議使用 Svelte 的反應式宣告 ($:) 來處理 switch\_source 指令的副作用。
     * 將此單一垂直影像流渲染至 9:16 的頁面佈局中（應能完整顯示）。
     * 接收並顯示決賽的即時分數，作為疊圖顯示。
   * FR-OBS-INTEGRATE: OBS 整合
     Output Page (obs-output.html) 應能作為一個獨立的網頁被 OBS 的「瀏覽器來源」擷取。
     頁面背景可設定為透明，以便 OBS 進行進一步的畫面疊加（若需要）。 建議在 Svelte 元件中使用 CSS 模組 (\<style module\>) 來管理樣式，避免全局樣式污染。
   * FR-INSTAGRAM-STREAM: Instagram 直播 (外部)
     系統產生的畫面最終將由 OBS 推播至 Instagram Live。OBS 的串流設定需符合 Instagram 的要求 (此為系統外部設定)。

   3.2. 非功能性需求 (Non-Functional Requirements)

   * NFR-PERF-LATENCY: 效能 \- 延遲
     * 透過 LiveKit 傳輸的影像延遲應盡可能低（目標為 sub-second）。
     * 分數更新從 Google Sheets 到 Output Page 顯示的延遲應在數秒內。 應使用 Svelte 的 onMount 生命周期鉤子來啟動資料獲取，並使用 setInterval 定期檢查更新。
   * NFR-USABILITY-ADMIN: 易用性 \- 管理介面
     Admin Page 的介面應清晰直觀，特別是在決賽模式下切換畫面的操作應易於執行。模式切換應有明確提示。 建議使用 Svelte 的過渡動畫 (transition:...) 來提供流暢的使用者體驗。
   * NFR-RELIABILITY: 可靠性
     系統應能穩定運行至少數小時（比賽期間）。
     應考慮基本的錯誤處理（例如 LiveKit 連線中斷的提示，但不要求複雜的自動重連）。 建議使用 Svelte 的 try...catch 區塊來處理錯誤，並向使用者顯示友好的錯誤訊息。
   * NFR-DEPLOY: 部署
     * LiveKit Server 與 Rust 後端應能透過 Docker 或 Docker Compose 部署於 VPS。
     * Svelte 前端應能透過靜態檔案伺服器 (例如 Nginx, Apache, Vercel, Netlify) 部署。 Svelte 的建置輸出應進行最佳化，例如使用生產模式建置 (npm run build)。
   * NFR-SECURITY-BASIC: 安全性 \- 基礎
     * LiveKit 連線必須使用後端產生的 Token。
     * LiveKit 的 API Key / Secret Key 不應洩漏於前端程式碼或原始碼庫。 建議使用環境變數來管理敏感資訊，並在建置時注入。

   3.3. 介面需求 (Interface Requirements)

   * 使用者介面 (UI):
     * 手機輸入頁面：極簡，包含攝影機授權、選擇目前角色 (Metadata 設定，例如使用 Svelte 的 \<select\> 元素)、顯示連線狀態。
     * 管理員介面 (Admin Page)：多畫面預覽區 (使用 \<video\> 元素顯示)、即時分數顯示區、模式切換控制 (例如使用 Svelte 的 \<button\> 元素)、決賽畫面切換控制。
     * 輸出畫面頁面 (Output Page)：無使用者互動元素，僅用於顯示動態合成的畫面供 OBS 擷取。
   * 軟體介面 (API):
     * LiveKit JS/Rust SDK: 用於 Svelte 前端與 LiveKit Server 通訊。
     * LiveKit Server API: LiveKit 伺服器提供的管理介面。
     * WebSocket API: 由 Rust 後端提供，用於推送分數給 Svelte 前端。
     * LiveKit DataChannel API: 用於 Admin Page 與 Output Page 之間的即時指令傳遞。
   * 硬體介面：
     * 手機攝影機與麥克風。

   3.4. 資料需求 (Data Requirements)

   * LiveKit Participant Metadata:
     * 結構：JSON 物件
     * 範例：{ "phase": "semi" | "final", "game": string, "angle": string }
   * WebSocket Score Message:
     * 結構：JSON 物件
     * 範例 (準決賽):

   {
           "phase": "semi",
           "scores": {
               "game1": {
                   "\<classA\>": number | null,  //  班級名稱
                   "\<classB\>": number | null   //  班級名稱
               },
               "game2": {
                   "\<classC\>": number | null,  //  班級名稱
                   "\<classD\>": number | null   //  班級名稱
               }
           }
       }

       \* 範例 (決賽):

       {
           "phase": "final",
           "scores": {
               "final": {
                   "\<classA\>": number | null,  //  班級名稱
                   "\<classB\>": number | null   //  班級名稱
               }
           }
       }

   * LiveKit DataChannel Message (切換指令):
     * 結構：JSON 物件
     * 範例：{ "action": "switch\_source", "targetSid": string }
   * Apps Script 傳送的資料格式：
     * 準決賽階段 (Semi-final):

   {
           "phase": "semi",
           "scores": {
               "game1": {
                   "\<classA\>": string,  // 班級名稱
                   "\<classB\>": string   // 班級名稱
               },
               "game2": {
                   "\<classC\>": string,  // 班級名稱
                   "\<classD\>": string   // 班級名稱
               }
           }
       }

   * 決賽階段 (Final):

{
    "phase": "final",
    "scores": {
        "final": {
            "\<classA\>": string, // 班級名稱
            "\<classB\>": string  // 班級名稱
        }
    }
}
