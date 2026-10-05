# CSR-Support

個人客服支援系統，目前僅保留介面，不連接資料庫。

保留首頁、休假表、排程月曆、日誌、日誌 NEW、交接、提報、對接追蹤、告警、會議及知識庫等頁面。可以切換導覽、深淺色並預覽表單；紀錄、附件、個人通知及表格設計不會儲存。

Firebase SDK、專案設定、Cloud Functions、舊 Worker 推播後端及公司 API 已移除。員工假表可透過 HTTPS 轉接服務唯讀連動；遊戲排程試算表、收件匣連線、推播與 AI 服務暫不啟用。
此專案沒有 NAS；員工假表與首頁今日上班共用 `assets/leave-source.js`，不依賴 OMNIPLAY 資料庫。轉接部署方式見 `leave-proxy/README.md`。

## 本機預覽

在專案目錄執行 `python -m http.server 8000`，開啟 `http://localhost:8000/`。

## 後續接資料庫

待決定資料儲存方式後，再替換 `assets/interface-only.js` 的預覽設定，逐頁實作與驗證儲存、讀取、附件及權限。
本次只移除這個專案的整合程式，未操作或刪除雲端既有資料庫。
