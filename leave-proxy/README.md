# 個人版員工假表轉接

GitHub Pages 不能執行伺服器程式；來源假表使用 HTTP 且沒有 CORS，所以 HTTPS 網頁需透過 HTTPS 轉接讀取。
此資料夾可部署為獨立 Cloudflare Worker，不使用 Firebase、NAS、KV、D1 或其他資料庫。

## 設定

部署 `worker.mjs`，設定環境變數：

- `ALLOWED_ORIGIN`：CSR-Support 網站的 origin，GitHub Pages 為 `https://gb168168.github.io`。
- `LEAVE_SOURCE_BASE`：經授權的員工假表來源 origin。此值由部署環境設定，前端不接受任意來源 URL。

可使用 Cloudflare Workers 的部署介面，或已登入的 Wrangler 執行 `wrangler deploy --config leave-proxy/wrangler.jsonc`。
部署完成後，在首頁或休假表按「假表連線」，填寫新 Worker 的 HTTPS 網址。
前端預設沿用舊假表 Worker；若回傳 403，必須填入可用的新轉接網址。

## 行為與限制

僅 GET/OPTIONS；驗證月份，當次向來源讀取員工與假表資料，僅回傳宋佳臻、鄭晴心、郭澄希、熊茗雅的班別與假表。
不記錄來源內容、不儲存或快取資料、不將員工資料提交到 GitHub。
使用既有來源 API 合約：員工 `/api/employees?month=YYYY-MM`，假表 `/api/leave/YYYY-MM`，假表含 `data` 與可選 `stars`。
可休天數及補薪日期只有來源明確提供 `maxDays` / `payMakeupDays` 時才採用；缺少時顯示未知，彈性早退暫停。
首頁與休假表每五分鐘重新讀取。休假表唯讀，其他業務紀錄仍不提供儲存。

此 PR 不代表 Worker 已部署，來源正式讀取實測與部署需另外完成。

## 補薪公告與可休天數

轉接同時讀取 `/api/setting/YYYY-MM`，依來源的啟用公告 (`is_active: true`) 中含「補薪」的標題與內容解析日期，並讀取 `max_days`。公告缺失、讀取失敗或日期不明時，補薪日期保持未知，暫停早退安排；明確空公告才代表當月沒有補薪日。日期不是寫死的，每次讀取都重新計算。此變更仍需重新部署 Worker 才生效。
