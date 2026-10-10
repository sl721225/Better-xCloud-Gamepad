# CloudPad Studio

為 Xbox Cloud Gaming 設計的虛擬手把 Userscript，支援貼邊觸控佈局、賽車手勢、實體手把巨集錄製、時間軸編輯、按鍵自動化及完整備份。

本專案原名 Better xCloud Gamepad，自 v15.2.0 起採用獨立名稱 CloudPad Studio。程式使用瀏覽器的 Gamepad API，沒有 Better xCloud 專用介面或必要依賴。實際 Xbox 串流相容性請依裝置與遊戲測試；腳本本身不提供 VPN 或地區解鎖功能。

## 版本
- 正式版：v15.1.3（舊名稱），見 [Releases](https://github.com/sl721225/Better-xCloud-Gamepad/releases/latest)。
- 改名測試版：v15.2.0，位於 v15-development。

## 安裝／改名升級
1. 在 Tampermonkey 或 Violentmonkey 打開原有腳本的編輯器。
2. 用 CloudPad-Studio.user.js 或 CloudPad-Studio-v15.2.0.txt 的完整內容取代原有程式，儲存。
3. 重新整理 Xbox 頁面。
4. 確認只有一份 CloudPad Studio 啟用。若另裝成新腳本，先停用舊版，避免兩個手把輸出同時運作。

改名可能讓腳本管理器將其視為另一份腳本，因此首次遷移建議在原有編輯器取代程式。不要只依賴改名後的自動更新判斷。

## 設定與備份
保留既有瀏覽器設定儲存位置，原有六組巨集、標準／觸控／賽車佈局繼續可用。新匯出檔採 CloudPad Studio 名稱與格式識別；舊版 JSON 巨集、完整設定及佈局備份仍可匯入。新格式備份建議使用 v15.2.0 以上版本還原。

## 更新相容性
GitHub 倉庫網址暫留原址，避免舊連結失效。CloudPad-Studio.user.js 是新檔名；Better-xCloud-Gamepad.user.js 保留作為相容入口，內容相同。新版本正式發布時需同時附上這兩個安裝檔，舊更新連結才能繼續使用；目前 latest 仍是已發布的 v15.1.3。

## 驗證
已完成不載入 Better xCloud 的本機瀏覽器測試，包括虛擬按鍵輸出、觸控多指、賽車位置、重新注入、巨集錄製、右鍵鎖定、淡化及新舊備份相容性。這不等同於真實 Xbox 串流遊戲測試。
