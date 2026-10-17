// ==UserScript==
// @name         CloudPad Studio (Dev)
// @homepageURL https://github.com/sl721225/CloudPad-Studio
// @supportURL  https://github.com/sl721225/CloudPad-Studio/issues
// @namespace    http://tampermonkey.net/
// @version      15.4.4
// @updateURL    https://raw.githubusercontent.com/sl721225/CloudPad-Studio/v15-development/CloudPad-Studio.user.js
// @downloadURL  https://raw.githubusercontent.com/sl721225/CloudPad-Studio/v15-development/CloudPad-Studio.user.js
// @description  獨立輸入來源、類比巨集、六組佈局、賽車與極簡 HUD。安裝前請停用舊版。
// @author       You
// @match        *://*.xbox.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
 * v15.4.4 — 失焦後殘留手動事件防護與可見停止原因；保留 Dev 自動更新。
 * 沿用既有 namespace 與儲存 key，讓既有安裝與設定可以升級。
 * 設定：better_xcloud_gamepad_v14；首次讀入 v13/v12，舊資料不覆寫。
 * F2 / L3+R3 1.5秒：有鎖定/連發則解除，否則收合/展開。
 * 紅色「全停」：停止巨集、AFK、連發、鎖定與手動輸入。
 * 安全性：切模式、進入佈局編輯、失焦或切到背景時釋放輸入並停止自動操作。
 * 類比軸仲裁：手動 > 巨集 > AFK；按鍵取各來源最大值。
 * 實體手把只讀取監控，不複製進虛擬手把，避免雙重輸入。
 */
(function () {
    'use strict';
    const VERSION = '15.4.4';
    const APP_NAME = 'CloudPad Studio (Dev)';
    const UPDATE_CHANNEL='dev';
    const DEV_SCRIPT_URL='https://raw.githubusercontent.com/sl721225/CloudPad-Studio/v15-development/CloudPad-Studio.user.js';

    // UI strings are separate from user macro/layout names and serialized input data.
    const EN = {
    "最後停止原因：": "Last stop reason: ",
    "尚無停止紀錄": "No stop recorded",
    "背景播放：": "Background playback: ",
    "失焦（背景播放關閉）": "Focus lost (background playback off)",
    "失焦時沒有播放中的巨集": "Focus lost with no macro playing",
    "離線停止": "Stopped: offline",
    "離開頁面停止": "Stopped: page hidden/unloaded",
    "手動操作中斷": "Interrupted by manual input",
    "按下停止": "Stop button",
    "全停或切換功能": "Stop all / feature change",
    "播放時間上限": "Playback time limit",
    "單次播放完成": "Single playback completed",
    "腳本被替換或重新初始化": "Script replaced or reinitialized",
    "切換巨集槽位": "Macro slot changed",
    "開始錄製": "Start recording",
    "開始另一個巨集": "Start another macro",
    "清除巨集": "Clear macro",
    "其他停止指令": "Other stop command",
    "關閉背景播放": "Background playback disabled",
    "背景播放診斷": "Background playback diagnostics",
    "失焦後殘留操作已忽略：": "Ignored late input after focus loss: ",
    "檢查開發版更新": "Check Dev updates",
    "開啟開發版安裝檔": "Open Dev userscript",
    "追蹤 v15-development 開發分支，可能包含未完成的修改。自動更新依腳本管理器設定執行；遊戲中不強制重載。": "Tracks the v15-development branch, which may include unfinished changes. Automatic updates follow your userscript manager settings; gameplay is never forcibly reloaded.",
    "正在查詢開發版…": "Checking Dev build\u2026",
    "開發版更新資料無效。": "Invalid Dev update metadata.",
    "開發版最新版本：": "Latest Dev version: ",
    "目前為開發版測試版本。": "This is a Dev testing build.",
    "請透過腳本管理器檢查更新，或開啟開發版安裝檔。": "Check for updates in your userscript manager, or open the Dev userscript.",
    "背景播放中": "Playing in background",
    "背景播放會攔截頁面的視窗失焦通知，避免串流端立即停用控制器；頁內輸入框切換不受影響。": "Background playback intercepts window focus-loss notifications to keep the stream controller active. Focus changes between inputs inside the page are unaffected.",
    "背景繼續播放巨集": "Keep macros playing in background",
    "關閉（離開視窗即停止）": "Off (stop when leaving the window)",
    "開啟（保留巨集播放）": "On (keep macro playback)",
    "僅保留已啟動的巨集播放；錄製、手動輸入、連發、鎖定與 AFK 仍停止。背景計時可能被瀏覽器降頻；最小化、休眠或串流暫停時無法保證遊戲收到輸入。": "Keeps only existing macro playback. Recording, manual input, rapid fire, hold and AFK stop. Browsers may throttle background timers; input delivery is not guaranteed when minimized, suspended or the stream pauses.",
    "長按保護只限制手動觸控按鍵／油門，不限制刻意鎖定或連發。失焦或隱藏分頁時依「背景繼續播放巨集」設定處理；離線或離開頁面時全停。全螢幕切換會取消觸控操作。": "Hold protection applies only to manual touch buttons / throttle, not deliberate hold or rapid fire. Focus loss and hidden tabs follow the background macro setting. Going offline or leaving the page stops all input. Fullscreen changes cancel touch input.",
    "無法讀取設定，使用暫存設定。": "Cannot read settings; using temporary settings.",
    "設定來自較新版本，停止覆寫。": "Settings are from a newer version; saving is disabled.",
    "設定 ": "Setting ",
    " 無法解析；保留原始內容。": " could not be parsed; the original data was preserved.",
    "設定儲存失敗；目前操作仍可使用，請勿重新整理。": "Could not save settings. You can keep using the controls; do not refresh.",
    "不是支援的巨集備份，請選擇本程式匯出的 JSON（格式版本 1）。": "Unsupported macro backup. Choose a JSON exported by this app (format version 1).",
    "備份必須包含單一槽位或完整六組。": "Backup must contain one slot or all six slots.",
    "槽位編號無效或重複。": "Invalid or duplicate slot number.",
    "槽位 ": "Slot ",
    " 的名稱須為 60 字以內的文字。": " name must be text of at most 60 characters.",
    " 的時間或事件格式錯誤。": " has an invalid duration or event format.",
    "備份超過 200,000 筆事件上限，請分槽匯出。": "Backup exceeds 200,000 events. Export individual slots.",
    " 第 ": " event ",
    " 筆事件無效（按鍵、類比值或時間順序）。": " is invalid (button, analog value or time order).",
    "檔案超過 16 MB 上限。": "File exceeds the 16 MB limit.",
    "JSON 無法解析，請確認檔案完整且未被修改。": "Cannot parse JSON. Check that the file is complete and unmodified.",
    "備份超過 16 MB，請分槽匯出。": "Backup exceeds 16 MB. Export individual slots.",
    "只有完整六組備份才能全部還原。": "Only a complete six-slot backup can restore all slots.",
    "請選擇有效的來源與目的槽位。": "Choose valid source and destination slots.",
    "請先停止錄製或播放，再匯入。": "Stop recording or playback before importing.",
    "儲存失敗，已保留原本的巨集；請先匯出備份並檢查網站儲存空間。": "Could not save. Original macros were preserved. Export a backup and check site storage.",
    "不是支援的完整備份（格式版本 1）。": "Unsupported full backup (format version 1).",
    "備份超過 16 MB。": "Backup exceeds 16 MB.",
    "備份缺少 ": "Backup is missing ",
    "佈局資料不完整。": "Incomplete layout data.",
    "佈局 ": "Layout ",
    " 有無效位移。": " contains an invalid offset.",
    "觸控佈局資料不完整。": "Incomplete touch layout data.",
    "觸控佈局 ": "Touch layout ",
    "賽車佈局資料不完整。": "Incomplete racing layout data.",
    "賽車佈局 ": "Racing layout ",
    " 無效。": " is invalid.",
    "巨集快捷鍵重複，或與急停鍵衝突。": "Macro hotkeys are duplicated or conflict with the emergency key.",
    "巨集組合鍵重複。": "Duplicate macro button combinations.",
    "JSON 無法解析。": "Cannot parse JSON.",
    "請選擇還原項目。": "Choose items to restore.",
    "儲存失敗，已還原原資料。": "Could not save; original data was restored.",
    "儲存失敗，原巨集未更動。": "Could not save; the original macro was preserved.",
    "急停：已釋放所有虛擬輸入。": "Emergency stop: all virtual inputs released.",
    "巨集已達播放時間上限，已停止。": "Macro playback reached its time limit and stopped.",
    "長按已達保護上限；請放開後重新操作。": "Hold protection limit reached. Release the control before using it again.",
    "觸控手把操作區": "Touch gamepad controls",
    "虛擬手把控制面板": "Virtual gamepad control panel",
    " · 拖曳面板": " · Drag panel",
    "拖曳面板": "Drag panel",
    "收合": "Collapse",
    "設定 ⚙": "Settings ⚙",
    "巨集": "Macros",
    "面板": "Panel",
    "快速切換標準／觸控佈局": "Switch panel / touch layout",
    "顯示操作說明": "Show help",
    "■ 全停": "■ Stop all",
    "作用中狀態": "Active status",
    "設定": "Settings",
    "佈局": "Layout",
    "右鍵：連發 → 鎖定 → 解除　｜　F2：解除連發／鎖定，否則收合": "Right-click: rapid fire → hold → release | F2: release automation, otherwise collapse",
    "左區：轉向／下拉 A　右區：上滑 RT、下滑 LT／右甩：B 進檔、左甩：X 退檔": "Left: steer / swipe down for A. Right: up RT, down LT; right B upshift, left X downshift",
    "連發間隔": "Rapid-fire interval",
    " 秒": " s",
    "雙擊連發／三擊鎖定": "Double-tap rapid fire / triple-tap hold",
    "關閉（防誤觸）": "Off (safe taps)",
    "開啟": "On",
    "AFK 擺頭幅度": "AFK stick movement",
    "啟動 AFK 擺頭": "Start AFK movement",
    "控制面板大小": "Panel size",
    "控制面板背景": "Panel background",
    "半透明": "Translucent",
    "透明": "Transparent",
    "觸控操作時面板淡化": "Fade panel during touch input",
    "開啟（25%）": "On (25%)",
    "關閉": "Off",
    "賽車操作時淡化": "Fade during racing input",
    "極簡展示 HUD": "Minimal HUD",
    "隱藏（實體操作時自動顯示）": "Auto (gamepad)",
    "顯示": "Shown",
    "展示 HUD 大小": "HUD size",
    "自動按鍵": "Automated button",
    "連發": "Rapid fire",
    "鎖定": "Hold",
    "解除": "Release",
    "觸控裝置也可在這裡指定按鍵自動操作。": "Touch users can also configure button automation here.",
    "錄製來源": "Recording source",
    "虛擬操作": "Virtual controls",
    "實體手把": "Physical gamepad",
    "錄製來源儲存失敗，已恢復原設定。": "Could not save the recording source; the previous setting was restored.",
    "錄製": "Record",
    "停止": "Stop",
    "播放": "Play",
    "循環播放": "Loop",
    "清除": "Clear",
    "清除此巨集槽位？": "Clear this macro slot?",
    "巨集名稱": "Macro name",
    "名稱儲存失敗。": "Could not save the name.",
    "第一次操作才開始計時；按下停止前的等待也會保存。實體錄製只讀取開始時選定的手把，保留按鍵、搖桿與 LT／RT 深度；播放時套用目前映射與曲線。": "Timing starts with the first input; the wait before Stop is also saved. Physical recording uses the gamepad selected at the start, including buttons, sticks and LT/RT depth. Playback applies the current mapping and curves.",
    "匯出此組": "Export slot",
    "匯出六組": "Export all six",
    "匯入 JSON": "Import JSON",
    "備份包含巨集名稱、按鍵、類比深度與等待時間。匯入只更動所選巨集，不會改變佈局或其他設定。": "Backups include macro names, buttons, analog depth and timing. Import changes only the selected macros, leaving layouts and other settings intact.",
    "請先停止錄製，再匯出完整巨集。": "Stop recording before exporting macros.",
    "已產生 JSON 備份，請確認瀏覽器下載。": "JSON backup created. Check your browser downloads.",
    "檔案超過 16 MB，請改用單組備份。": "File exceeds 16 MB. Use a single-slot backup.",
    "資料檢查完成，尚未寫入。請選擇還原位置。": "Data validated; nothing has been saved yet. Choose where to restore it.",
    "匯入預覽": "Import preview",
    "未命名": "Unnamed",
    " 筆 · ": " events · ",
    "備份來源": "Backup source",
    "寫入槽位": "Destination slot",
    "還原全部六組（包含空槽）": "Restore all six (including empty slots)",
    "確認匯入": "Confirm import",
    " 筆）": " events)",
    "備份中的空槽也會覆蓋現有資料。\n": "Empty backup slots will also overwrite existing data.\n",
    "匯入將取代以下巨集：\n": "Import will replace these macros:\n",
    "確定繼續？": "Continue?",
    "已匯入 ": "Imported ",
    " 組巨集。": " macros.",
    "取消": "Cancel",
    "已取消，巨集沒有變更。": "Cancelled; macros are unchanged.",
    "操作佈局": "Control layout",
    "標準面板": "Standard panel",
    "觸控佈局": "Touch layout",
    "面板與觸控各自保存六組位置，切換不會覆蓋另一種佈局。賽車維持原本的操作區。": "Panel and touch modes each keep six independent layouts. Switching does not overwrite the other mode. Racing keeps its own control areas.",
    "開始編輯": "Edit layout",
    "賽車模式不支援佈局編輯，請先切回標準模式。": "Racing layout editing is unavailable. Switch to standard mode first.",
    "群組移動": "Move group",
    "磁吸 10px": "Snap 10px",
    "還原此組": "Reset slot",
    "還原目前槽位的佈局？其他槽位不受影響。": "Reset the current layout slot? Other slots are unaffected.",
    "編輯時拖曳按鍵／搖桿；拖曳只改位置，不送出遊戲輸入。舊版儲存的位移會沿用於新介面的對應控制元件。": "Drag buttons / sticks while editing. Moving controls changes only their positions, without sending game input. Saved offsets from older versions remain in use.",
    "：右鍵切換連發／鎖定": ": right-click to cycle rapid fire / hold",
    "左搖桿": "Left stick",
    "右搖桿": "Right stick",
    "錄製已準備 · 等待第一次操作…": "Recording armed · waiting for first input…",
    "錄製中 · ": "Recording · ",
    "播放中": "Playing",
    " · 槽位 ": " · Slot ",
    " 筆 / ": " events / ",
    "巨集 ": "Macro ",
    "停止 AFK 擺頭": "Stop AFK movement",
    "實體手把（來源已固定）": "Physical gamepad (source locked)",
    "已連接：": "Connected: ",
    "未連接實體手把 · 請連接並按一下手把按鍵": "No physical gamepad · connect one and press a button",
    "目前來源：畫面上的虛擬操作": "Current source: on-screen virtual controls",
    "隱藏操作說明": "Hide help",
    "觸控": "Touch",
    "賽車": "Racing",
    "標準": "Standard",
    "展開": "Expand",
    "完成編輯": "Finish editing",
    "單顆移動": "Move single",
    "自由移動": "Free movement",
    "展示 HUD": "Display HUD",
    "調整展示大小": "Adjust HUD size",
    "轉向 · 下拉 A": "Steer · swipe down A",
    "RT ↑ · LT ↓ · 左甩 X 退檔 · 右甩 B 進檔": "RT ↑ · LT ↓ · left X downshift · right B upshift",
    "輸入": "Input",
    "快捷／保護": "Keys / Safety",
    "備份": "Backup",
    "診斷": "Diagnostics",
    "巨集快捷列": "Macro quickbar",
    "巨集 ▸": "Macros ▸",
    "請先停止巨集並完成佈局編輯，再進行此操作。": "Stop macros and finish layout editing before continuing.",
    "已取消。": "Cancelled.",
    "已儲存。": "Saved.",
    "儲存失敗，已恢復原設定。": "Could not save; previous settings were restored.",
    "：請輸入 ": ": enter a valid value between ",
    " 的有效數值。": ".",
    "搖桿曲線與死區": "Stick curves and deadzone",
    "調整搖桿": "Adjust stick",
    "LS 左搖桿": "LS Left stick",
    "RS 右搖桿": "RS Right stick",
    "按鍵重新映射": "Button mapping",
    "實體手把也套用映射與曲線": "Apply mapping and curves to physical gamepads",
    "預設只改虛擬輸出。錄製保存原始動作，播放時才套用目前設定。實體映射直接修改回傳資料，不額外建立第二份手把輸入。": "By default, only virtual output is affected. Recording stores raw input; playback applies current settings. Physical mapping modifies returned data without creating a second gamepad input.",
    "還原按鍵映射": "Reset button mapping",
    "常用預設": "Presets",
    "手動調整": "Custom",
    "標準（相容舊版）": "Standard (legacy compatible)",
    "細膩瞄準": "Precise aim",
    "柔和轉向": "Smooth steering",
    "快速反應": "Fast response",
    "死區（0～0.45）": "Deadzone (0–0.45)",
    "靈敏度（0.2～3）": "Sensitivity (0.2–3)",
    "最大輸出（0.1～1）": "Maximum output (0.1–1)",
    "曲線": "Curve",
    "線性": "Linear",
    "柔和": "Soft",
    "快速": "Fast",
    "反轉 X 軸": "Invert X",
    "反轉 Y 軸": "Invert Y",
    "死區使用圓形計算，預設參數保留舊版操作感。修改輸入設定時會停止目前自動操作。": "Deadzone is radial. Defaults preserve the previous control feel. Changing input settings stops automation.",
    "巨集快捷啟動": "Macro shortcuts",
    "鍵盤巨集快捷鍵": "Keyboard macro hotkeys",
    "手把組合鍵巨集": "Gamepad macro combinations",
    "顯示側邊巨集快捷列": "Show side macro quickbar",
    "鍵盤與組合鍵預設關閉。組合鍵不會吃掉原遊戲輸入；有衝突時請關閉。按住只啟動一次，放開後才能再觸發；輸入文字時不啟動鍵盤巨集。": "Keyboard and gamepad shortcuts are off by default. Gamepad combinations still reach the game; disable them if they conflict. Holding triggers once until released. Keyboard macros do not trigger while typing.",
    " 鍵盤": " keyboard",
    "快捷鍵不能重複或與急停相同。": "Hotkeys must be unique and different from the emergency key.",
    " 組合鍵 ": " combination ",
    "組合键需選兩個不同按鍵。": "Choose two different buttons for a combination.",
    "組合鍵已用於其他巨集。": "This combination is already used by another macro.",
    "L3＋R3 保留給面板快捷操作。": "L3+R3 is reserved for the panel shortcut.",
    "急停與輸入保護": "Emergency stop and input protection",
    "啟用急停快捷鍵": "Enable emergency hotkey",
    "急停鍵": "Emergency key",
    "急停不可與巨集快捷鍵相同。": "Emergency key must differ from macro hotkeys.",
    "手動長按上限（秒，0＝關閉）": "Manual hold limit (seconds, 0 = off)",
    "巨集播放上限（秒，0＝關閉）": "Macro playback limit (seconds, 0 = off)",
    "長按保護只限制手動觸控按鍵／油門，不限制刻意鎖定或連發。失焦、隱藏分頁與離線時會全停；全螢幕切換會取消觸控操作。": "Hold protection applies only to manual touch buttons / throttle, not deliberate hold or rapid fire. Losing focus, hiding the tab or going offline stops all input; fullscreen changes cancel touch input.",
    "巨集時間軸編輯器": "Macro timeline editor",
    "開啟目前槽位草稿": "Open current slot draft",
    "捨棄目前草稿並重新載入？": "Discard the current draft and reload?",
    "正在編輯槽位 ": "Editing slot ",
    "，尚未取代原巨集。": "; the original macro has not been replaced.",
    "播放速度": "Playback speed",
    "草稿：槽位 ": "Draft: slot ",
    " 筆": " events",
    "草稿名稱": "Draft name",
    "總長度（秒，包含結尾等待）": "Total duration (seconds, including final wait)",
    "時間（秒）": "Time (seconds)",
    "動作": "Action",
    "按鍵／軸": "Button / axis",
    "數值": "Value",
    "步驟 ": "Step ",
    " 時間": " time",
    "時間需為有效的非負數。": "Time must be a valid non-negative number.",
    "按鍵": "Button",
    "搖桿": "Axis",
    " 類型": " type",
    " 按鍵": " button",
    " 數值": " value",
    "數值需在按鍵 0～1 或搖桿 -1～1 範圍內。": "Values must be 0–1 for buttons or -1–1 for sticks.",
    "刪": "Delete",
    "上一頁": "Previous",
    "下一頁": "Next",
    "＋ 插入動作": "＋ Add event",
    "已達事件上限。": "Event limit reached.",
    "依時間排序": "Sort by time",
    "整段平移秒數": "Shift all (seconds)",
    "整段平移": "Shift all",
    "平移後不可產生負時間。": "Shifting cannot produce negative times.",
    "0＝放開；按鍵／LT／RT 數值 0～1，搖桿 -1～1。保留同時動作的原順序。總長度不得早於最後一步；過長清單分頁顯示。": "0 = released. Button / LT / RT values: 0–1; sticks: -1–1. Simultaneous events keep their order. Duration cannot end before the last event. Long lists are paginated.",
    "儲存並取代原巨集": "Save and replace macro",
    "請先修正草稿的無效數值。": "Fix invalid draft values first.",
    "以草稿取代槽位 ": "Replace slot ",
    " 的巨集？": " macro with this draft?",
    "捨棄草稿": "Discard draft",
    "捨棄未儲存的草稿？": "Discard the unsaved draft?",
    "草稿已捨棄，原巨集不變。": "Draft discarded; the original macro is unchanged.",
    "佈局管理": "Layout manager",
    "佈局名稱": "Layout name",
    "目的佈局": "Destination layout",
    "複製到目的": "Copy to destination",
    "交換兩組": "Swap layouts",
    "還原單一元件": "Reset one control",
    "還原此元件": "Reset control",
    "還原目前模式的此元件位置？": "Reset this control position in the current mode?",
    "匯出六組佈局": "Export six layouts",
    "匯入佈局": "Import layouts",
    "請選擇不同目的佈局。": "Choose a different destination layout.",
    "複製覆蓋": "Overwrite",
    "交換": "Swap",
    " 與 ": " and ",
    "觸控尺寸與分區透明度": "Touch size and regional opacity",
    "觸控按鍵大小（倍率）": "Touch button scale",
    "觸控搖桿大小（倍率）": "Touch stick scale",
    "按鍵觸控外擴（像素）": "Extra button touch area (pixels)",
    "左操作區透明度（0.2～1）": "Left region opacity (0.2–1)",
    "右操作區透明度（0.2～1）": "Right region opacity (0.2–1)",
    "輔助按鍵透明度（0.2～1）": "Utility button opacity (0.2–1)",
    "只影響觸控佈局。空白處仍可操作遊戲頁面；預設排列會保留觸控範圍間距。佈局編輯時顯示按鍵實際範圍，並暫時恢復清楚顯示。自訂拖曳時請避免重疊。窄畫面改為上下排列；大小超過可用空間時會自動縮放。": "Affects touch layouts only. Empty areas still pass input to the game page. Defaults leave gaps between touch targets. Editing shows actual touch areas at full opacity. Avoid overlapping custom controls. Narrow screens stack controls; oversized layouts shrink to fit.",
    "不是支援的佈局備份。": "Unsupported layout backup.",
    "完整設定備份": "Full settings backup",
    "匯出完整備份": "Export full backup",
    "匯入完整備份": "Import full backup",
    "備份包含六組巨集、六組佈局、名稱、曲線、映射與介面設定。匯入只保存設定，不會自動啟動巨集／連發。": "Includes six macros, six layouts, names, curves, mapping and UI settings. Import saves settings only; it does not start macros or rapid fire.",
    "版本與更新": "Version and updates",
    "檢查正式版更新": "Check stable updates",
    "開啟正式版本下載頁": "Open stable download page",
    "只追蹤正式 Release，不使用 main 測試版本。自動更新依腳本管理器設定執行；遊戲中不強制重載。": "Checks official Releases only, not main test builds. Automatic updates follow your userscript manager settings. Gameplay is never forcibly reloaded.",
    "已產生備份，請確認瀏覽器下載。": "Backup created. Check your browser downloads.",
    "檔案超過 16 MB。": "File exceeds 16 MB.",
    "還原預覽（尚未寫入）": "Restore preview (not saved yet)",
    " 筆；佈局 ": " events; layout ",
    "，面板 ": ", panel ",
    "／觸控 ": " / touch ",
    " 個位移": " offsets",
    "六組巨集": "Six macros",
    "六組佈局與名稱": "Six layouts and names",
    "介面／曲線／映射／快捷設定": "UI / curves / mapping / shortcuts",
    "還原": "Restore ",
    "確認還原所選項目": "Confirm selected restore",
    "請至少選一項。": "Select at least one item.",
    "取代目前的 ": "Replace current ",
    "？空槽也會覆蓋原資料。": "? Empty slots will also overwrite existing data.",
    "已還原所選資料；自動操作維持停止。": "Selected data restored; automation remains stopped.",
    "取消還原": "Cancel restore",
    "已取消，資料沒有變更。": "Cancelled; data is unchanged.",
    "檔案驗證完成。": "File validated.",
    "正在查詢正式 Release…": "Checking stable Release…",
    "GitHub 回應 ": "GitHub returned ",
    "，請稍後重試或開啟下載頁。": ". Retry later or open the download page.",
    "未找到有效的正式版本。": "No valid stable release found.",
    "有新版本 ": "New version available: ",
    "\n請透過腳本管理器更新，或開啟正式版本下載頁。": "\nUpdate through your userscript manager or open the stable download page.",
    "已是最新版": "up to date",
    "比公開正式版新，尚在測試": "newer than the public stable release (testing)",
    "正式版為 ": "Stable version: ",
    "；目前 ": "; current: ",
    "查詢逾時，請稍後再試。": "Request timed out. Try again later.",
    "輸入測試中心": "Input test center",
    "RAW：虛擬原始輸入；OUT：套用曲線與映射後的虛擬輸出。實體原始與處理後數值分開列出，不宣稱可量測雲端遊戲延遲。": "RAW: original virtual input. OUT: virtual output after curves and mapping. Physical raw and processed values are listed separately. These values do not measure cloud-game latency.",
    "清除虛擬輸入／全停": "Release virtual input / stop all",
    "巨集 ▾": "Macros ▾",
    "全部放開": "All released",
    "\n按鍵：": "\nButtons: ",
    "\n軸：": "\nAxes: ",
    "（優先 ": " (priority ",
    "無": "None",
    "RAW 虛擬原始": "RAW virtual input",
    "OUT 虛擬最終": "OUT virtual output",
    "未連接": "Not connected",
    "實體原始": "Physical raw",
    "實體送出": "Physical output",
    "錄製中": "Recording",
    "\n\n實體：": "\n\nPhysical: ",
    "\n\n作用中來源\n": "\n\nActive sources\n",
    "\n\n巨集：": "\n\nMacro: ",
    "\n虛擬槽位：": "\nVirtual slot: ",
    "\n目前來源按鍵由最大值合併；軸依優先順序仲裁。": "\nButtons merge by maximum value; axes use source priority.",
    "無法掛接虛擬手把。請停用其他手把腳本後重新整理。": "Cannot install the virtual gamepad. Disable other gamepad scripts and refresh.",
    "網路已離線，已釋放所有虛擬輸入。": "Offline: all virtual inputs released.",
    "賽車使用自己的操作區，請切回標準模式再選擇佈局。": "Racing uses its own control areas. Switch to standard mode to choose a layout.",
    "佈局切換儲存失敗，已保留原模式。": "Could not save layout mode; the previous mode was preserved.",
    "請先停止錄製，再播放巨集。": "Stop recording before playing a macro.",
    " 沒有可播放的動作。": " has no playable events.",
    "請先完成佈局編輯，再錄製巨集。": "Finish layout editing before recording.",
    "未連接實體手把，無法開始錄製。": "Cannot start recording: no physical gamepad connected.",
    "錄製來源手把已斷線，已停止並保存本次錄製。": "Recording gamepad disconnected. Recording stopped and saved.",
    "[CloudPad Studio] 啟動失敗": "[CloudPad Studio] Startup failed",
    "CloudPad Studio 啟動失敗，請查看 Console 並確認舊版已停用。": "CloudPad Studio could not start. Check the Console and disable older versions."
};
    const EN_KEYS = new Map(Object.entries(EN).map(([zh,en])=>[en,zh]));
    let uiLanguage='zh-TW',activeI18n=null;
    const translateUI = text => {if(typeof text==='function')return translateUI(text());if(typeof text!=='string')return text;const key=EN_KEYS.get(text)||text;return uiLanguage==='en'?(EN[key]??key):key;};
    class I18n {
        constructor(language) {this.language=language;uiLanguage=language;this.bindings=new Map();activeI18n=this;}
        bind(node,attribute,read) {let fields=this.bindings.get(node);if(!fields)this.bindings.set(node,fields=new Map());fields.set(attribute,read);this.render(node,attribute,read);}
        render(node,attribute,read) {const value=String(read()??'');if(attribute==='textContent'){if(node.textContent!==value)node.textContent=value;}else if(node.getAttribute(attribute)!==value)node.setAttribute(attribute,value);}
        refresh() {uiLanguage=this.language;for(const [node,fields] of this.bindings){if(!node.isConnected){this.bindings.delete(node);continue;}for(const [attribute,read] of fields)this.render(node,attribute,read);}}
        prune() {for(const node of this.bindings.keys())if(!node.isConnected)this.bindings.delete(node);}
        destroy() {this.bindings.clear();if(activeI18n===this)activeI18n=null;}
    }
    const setText=(node,read)=>{if(activeI18n)activeI18n.bind(node,'textContent',read);else node.textContent=String(read()??'');};
    const setLabel=(node,attribute,read)=>{if(activeI18n)activeI18n.bind(node,attribute,read);else node.setAttribute(attribute,String(read()??''));};
    const ask = message => confirm(translateUI(message));

    const readDevVersion=text=>{
        const header=String(text).slice(0,12000).match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
        if(!header||!/^\s*\/\/\s*@name\s+CloudPad Studio \(Dev\)\s*$/m.test(header[1]))throw Error(translateUI('開發版更新資料無效。'));
        const version=header[1].match(/^\s*\/\/\s*@version\s+(\d+\.\d+\.\d+)\s*$/m)?.[1];
        if(!version)throw Error(translateUI('開發版更新資料無效。'));return version;
    };
    const STOP_LABELS={"focus-off": "失焦（背景播放關閉）", "focus-idle": "失焦時沒有播放中的巨集", "offline": "離線停止", "pagehide": "離開頁面停止", "manual": "手動操作中斷", "button": "按下停止", "stop-all": "全停或切換功能", "time-limit": "播放時間上限", "complete": "單次播放完成", "destroy": "腳本被替換或重新初始化", "slot": "切換巨集槽位", "record": "開始錄製", "play": "開始另一個巨集", "clear": "清除巨集", "stop-command": "其他停止指令", "disabled": "關閉背景播放"};
    const stopLabel=code=>translateUI(STOP_LABELS[code]||STOP_LABELS["stop-command"]);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : 0));
    const clone = value => JSON.parse(JSON.stringify(value));
    const slots = factory => Object.fromEntries(Array.from({length: 6}, (_, i) => [i + 1, factory()]));
    const blank = () => ({buttons: Array(17).fill(0), axes: Array(4).fill(0)});
    const LABELS = ['A','B','X','Y','LB','RB','LT','RT','View','Menu','L3','R3','▲','▼','◀','▶','Xbox'];
    const GROUPS = {'0':'face','1':'face','2':'face','3':'face','12':'dpad','13':'dpad','14':'dpad','15':'dpad',
        '8':'center','9':'center','4':'leftTop','6':'leftTop','5':'rightTop','7':'rightTop',
        stick_0:'leftStick','10':'leftStick',stick_2:'rightStick','11':'rightStick'};
    const DEFAULTS = () => ({backgroundMacro:false,language:'zh-TW',delay:3000, bgTrans:false, afkAmp:0.2, gameMode:'standard', comboTaps:false, racingAutoFade:true, showHelp:true,
        splitMode:false, uiScale:1, showViewer:false, viewerScale:0.8, viewerPos:{x:'20px',y:'20px'},
        panelPos:null, layoutSlot:1, layouts:slots(() => ({})), macros:slots(() => ({name:'',duration:0,events:[]})),
        layoutNames:slots(()=>''),axisTuning:[0,1].map(()=>({deadzone:0,sensitivity:1,max:1,curve:'linear',invertX:false,invertY:false})),
        buttonMap:Array.from({length:17},(_,i)=>i),physicalMapping:false,macroSpeed:1,macroRecordSource:'virtual',
        keyboardMacros:false,comboMacros:false,showQuickbar:true,quickbarCollapsed:true,
        macroKeys:['F3','F4','F5','F6','F7','F8'],macroCombos:[[4,0],[4,1],[4,2],[4,3],[5,0],[5,1]],
        emergencyKey:'F9',emergencyEnabled:true,holdTimeout:0,playbackLimit:0,
        touchAutoFade:true,controlStyle:'panel',touchPanelPos:{x:'15px',y:'15px'},touchLayouts:slots(()=>({})),racingLayouts:slots(()=>({})),
        touchButtonSize:1,touchStickSize:1,touchHitPadding:4,touchOpacityLeft:.75,touchOpacityRight:.75,touchOpacityUtility:.7});

    class ConfigStore {
        constructor(storage, warn = console.warn) {
            this.storage = storage; this.warn = warn; this.key = 'better_xcloud_gamepad_v14';
            this.prefs = DEFAULTS(); this.writable = true; this.load();
        }
        sanitize(data) {
            const p = DEFAULTS(); const d = data && typeof data === 'object' ? data : {};
            if(['zh-TW','en'].includes(d.language))p.language=d.language;
            ['backgroundMacro','touchAutoFade','bgTrans','comboTaps','splitMode','showViewer','racingAutoFade','showHelp','physicalMapping','keyboardMacros','comboMacros','showQuickbar','quickbarCollapsed','emergencyEnabled'].forEach(k => {if (typeof d[k] === 'boolean') p[k]=d[k];});
            p.macroSpeed=d.macroSpeed==null?1:clamp(d.macroSpeed,.25,3);
            if(['virtual','physical'].includes(d.macroRecordSource))p.macroRecordSource=d.macroRecordSource;
            if(['panel','touch'].includes(d.controlStyle))p.controlStyle=d.controlStyle;
            for(const key of ['touchButtonSize','touchStickSize'])p[key]=d[key]==null?1:clamp(d[key],.7,1.4);
            p.touchHitPadding=d.touchHitPadding==null?4:clamp(d.touchHitPadding,0,8);
            for(const key of ['touchOpacityLeft','touchOpacityRight','touchOpacityUtility'])p[key]=d[key]==null?p[key]:clamp(d[key],.2,1);
            p.holdTimeout=d.holdTimeout==null?0:clamp(d.holdTimeout,0,600);
            p.playbackLimit=d.playbackLimit==null?0:clamp(d.playbackLimit,0,3600);
            const validKey=v=>typeof v==='string'&&/^(F(?:[3-9]|1[0-2])|Key[A-Z]|Digit[0-9])$/.test(v);
            if(validKey(d.emergencyKey))p.emergencyKey=d.emergencyKey;
            for(let i=0;i<6;i++){
                if(validKey(d.macroKeys?.[i]))p.macroKeys[i]=d.macroKeys[i];
                const c=d.macroCombos?.[i];if(Array.isArray(c)&&c.length===2&&c.every(n=>Number.isInteger(n)&&n>=0&&n<17)&&c[0]!==c[1])p.macroCombos[i]=[...c];
            }
            for(let i=0;i<17;i++)if(Number.isInteger(d.buttonMap?.[i])&&d.buttonMap[i]>=0&&d.buttonMap[i]<17)p.buttonMap[i]=d.buttonMap[i];
            for(let i=0;i<2;i++){
                const t=d.axisTuning?.[i];if(!t||typeof t!=='object')continue;
                p.axisTuning[i]={deadzone:clamp(t.deadzone??0,0,.45),sensitivity:clamp(t.sensitivity??1,.2,3),max:clamp(t.max??1,.1,1),
                    curve:['linear','soft','fast'].includes(t.curve)?t.curve:'linear',invertX:t.invertX===true,invertY:t.invertY===true};
            }
            p.delay = d.delay == null ? p.delay : clamp(d.delay,100,10000);
            p.afkAmp = d.afkAmp == null ? p.afkAmp : clamp(d.afkAmp,0.1,0.5);
            p.gameMode = d.gameMode === 'racing' ? 'racing' : 'standard';
            p.uiScale = [0.8,1,1.2,1.5].includes(Number(d.uiScale)) ? Number(d.uiScale) : 1;
            p.viewerScale = [0.6,0.8,1,1.2].includes(Number(d.viewerScale)) ? Number(d.viewerScale) : 0.8;
            p.layoutSlot = Math.round(clamp(d.layoutSlot || 1,1,6));
            const point = v => v && Number.isFinite(parseFloat(v.x)) && Number.isFinite(parseFloat(v.y))
                ? {x:`${clamp(parseFloat(v.x),-20000,20000)}px`,y:`${clamp(parseFloat(v.y),-20000,20000)}px`} : null;
            p.viewerPos = point(d.viewerPos) || p.viewerPos; p.panelPos = point(d.panelPos);
            p.touchPanelPos=point(d.touchPanelPos)||p.touchPanelPos;
            for (let s=1;s<=6;s++) {
                if(typeof d.layoutNames?.[s]==='string')p.layoutNames[s]=d.layoutNames[s].trim().slice(0,60);
                const layout = d.layouts?.[s];
                for (const id of [...Object.keys(GROUPS),'16']) {
                    const pos = layout?.[id];
                    if (pos && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y)))
                        p.layouts[s][id]={x:clamp(pos.x,-10000,10000),y:clamp(pos.y,-10000,10000)};
                    const race=d.racingLayouts?.[s]?.[id];
                    if(race&&Number.isFinite(Number(race.x))&&Number.isFinite(Number(race.y)))p.racingLayouts[s][id]={x:clamp(race.x,-10000,10000),y:clamp(race.y,-10000,10000)};
                    const touch=d.touchLayouts?.[s]?.[id];
                    if(touch&&Number.isFinite(Number(touch.x))&&Number.isFinite(Number(touch.y)))p.touchLayouts[s][id]={x:clamp(touch.x,-10000,10000),y:clamp(touch.y,-10000,10000)};
                }
                const m = d.macros?.[s];
                if (m && Array.isArray(m.events)) {
                    const events = m.events.filter(e => e && ['btn','axis'].includes(e.type) && Number.isInteger(e.id)
                        && e.id>=0 && e.id<(e.type==='btn'?17:4) && Number.isFinite(e.t) && e.t>=0 && Number.isFinite(e.val))
                        .map(e=>({t:e.t,type:e.type,id:e.id,val:clamp(e.val,e.type==='btn'?0:-1,1)})).sort((a,b)=>a.t-b.t);
                    p.macros[s]={name:typeof m.name==='string'?m.name.trim().slice(0,60):'',events,duration:Math.max(0,Number.isFinite(m.duration)?m.duration:0,events.at(-1)?.t||0)};
                }
            }
            return p;
        }
        load() {
            for (const key of [this.key,'better_xcloud_gamepad','xcloud_gamepad_prefs_v12_4']) {
                let raw;
                try {raw=this.storage.getItem(key);} catch (e) {this.writable=false; this.warn(translateUI('無法讀取設定，使用暫存設定。'),e); return;}
                if (!raw) continue;
                try {
                    const doc = JSON.parse(raw);
                    if (key===this.key && doc.version>15) {this.writable=false; this.warn(translateUI('設定來自較新版本，停止覆寫。'));}
                    this.prefs=this.sanitize(doc.settings || doc); return;
                } catch (e) {this.warn((translateUI("設定 ")+String(key)+translateUI(" 無法解析；保留原始內容。")),e); if(key===this.key) this.writable=false;}
            }
            this.prefs.language = typeof navigator!=='undefined' && /^zh/i.test(navigator.language||'') ? 'zh-TW' : typeof navigator!=='undefined' ? 'en' : 'zh-TW';
        }
        save() {
            if(!this.writable) return false;
            try {this.storage.setItem(this.key,JSON.stringify({version:15,build:VERSION,settings:this.prefs})); return true;}
            catch(e) {this.warn(translateUI('設定儲存失敗；目前操作仍可使用，請勿重新整理。'),e); return false;}
        }
    }

    class InputManager {
        constructor(clock = () => performance.now()) {this.clock=clock; this.sources=new Map(); this.sequence=0; this.onChange=null;}
        source(key, priority=40) {
            if(!this.sources.has(key)) this.sources.set(key,{buttons:new Map(),axes:new Map(),priority,order:++this.sequence});
            return this.sources.get(key);
        }
        set(key,type,id,val,priority=40) {
            if(!Number.isInteger(id)||id<0||id>=(type==='btn'?17:4)) return;
            const s=this.source(key,priority); const map=type==='btn'?s.buttons:s.axes;
            const value=clamp(val,type==='btn'?0:-1,1);
            if(map.get(id)===value) return;
            map.set(id,value); s.order=++this.sequence; this.onChange?.();
        }
        clear(key) {if(this.sources.delete(key)) this.onChange?.();}
        clearAll() {this.sources.clear(); this.onChange?.();}
        snapshot(filter = () => true) {
            const out=blank(); const winners=Array(4).fill(null);
            for(const [key,s] of this.sources) {
                if(!filter(key)) continue;
                for(const [id,v] of s.buttons) out.buttons[id]=Math.max(out.buttons[id],v);
                for(const [id,v] of s.axes) {
                    const old=winners[id];
                    if(!old||s.priority>old.priority||(s.priority===old.priority&&s.order>old.order)) {out.axes[id]=v; winners[id]=s;}
                }
            }
            return out;
        }
        recordingState() {return this.snapshot(key=>key!=='macro'&&key!=='afk');}
    }

    class VirtualGamepad {
        constructor(input, nav, target) {
            this.input=input; this.nav=nav; this.target=target; this.original=nav.getGamepads;
            this.descriptor=Object.getOwnPropertyDescriptor(nav,'getGamepads'); this.slot=null;
            this.pad={id:'Xbox 360 Controller',index:0,mapping:'standard',connected:false,timestamp:0,
                buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false})),axes:[0,0,0,0]};
        }
        readPhysical() {try {return this.original ? Array.from(this.original.call(this.nav)) : [];} catch {return [];}}
        event(type) {
            // GamepadEvent 的 constructor 不接受純 JS gamepad；使用帶有 gamepad 欄位的 Event。
            const e=new Event(type); Object.defineProperty(e,'gamepad',{value:this.pad}); this.target.dispatchEvent(e);
        }
        sync(pads) {
            if(this.slot===null||pads[this.slot]) {
                if(this.pad.connected) {this.pad.connected=false; this.event('gamepaddisconnected');}
                let free=Array.from({length:Math.max(4,pads.length+1)},(_,i)=>i).find(i=>!pads[i]);
                this.slot=free; this.pad.index=free; this.pad.connected=true;
                this.event('gamepadconnected');
            }
            const state=this.input.snapshot(); let changed=false;
            state.buttons.forEach((v,i)=>{const b=this.pad.buttons[i]; if(b.value!==v) changed=true;
                b.value=v; b.touched=v>0; b.pressed=v>0.05;});
            state.axes.forEach((v,i)=>{if(this.pad.axes[i]!==v) changed=true; this.pad.axes[i]=v;});
            if(changed||!this.pad.timestamp) this.pad.timestamp=this.input.clock();
        }
        install() {
            this.hook=()=>{const pads=this.readPhysical(); this.sync(pads);const out=pads.map(p=>this.pipeline?.physical(p)||p);out[this.slot]=this.pad;return out;};
            Object.defineProperty(this.nav,'getGamepads',{value:this.hook,configurable:true,writable:true});
            this.sync(this.readPhysical());
        }
        destroy() {
            if(this.nav.getGamepads===this.hook) {
                if(this.descriptor) Object.defineProperty(this.nav,'getGamepads',this.descriptor);
                else delete this.nav.getGamepads;
            }
            if(this.pad.connected) {this.pad.connected=false; this.event('gamepaddisconnected');}
        }
    }

    class PhysicalGamepadMonitor {
        constructor(virtual) {this.virtual=virtual; this.state=blank(); this.lastActivity=-Infinity; this.active=false; this.connected=false; this.id=''; this.lastIndex=null;}
        poll(now,pinnedIndex=null) {
            const pads=this.virtual.readPhysical().filter(p=>p?.connected);
            const active=p=>p.buttons.some(b=>b.pressed||b.value>0.05)||p.axes.some(a=>Math.abs(a)>0.15);
            const p=pinnedIndex!==null?pads.find(p=>p.index===pinnedIndex):pads.find(active)||pads.find(p=>p.index===this.lastIndex)||pads[0];
            this.connected=!!p; this.active=!!p&&active(p); this.state=blank(); this.id=p?.id||'';
            if(p) {this.lastIndex=p.index; this.state.buttons=this.state.buttons.map((_,i)=>clamp(p.buttons[i]?.value??(p.buttons[i]?.pressed?1:0),0,1));
                this.state.axes=this.state.axes.map((_,i)=>clamp(p.axes[i]||0,-1,1));}
            if(this.active) this.lastActivity=now;
            if(!p) this.lastActivity=-Infinity;
        }
    }

    class ButtonAutomation {
        constructor(input,config,clock) {this.input=input; this.config=config; this.clock=clock; this.modes=new Map(); this.pulses=new Map();}
        mode(id) {return this.modes.get(Number(id))?.mode||'none';}
        set(id,mode) {
            id=Number(id);const previous=this.mode(id),now=this.clock(); this.input.clear(`auto:${id}`); this.modes.delete(id);
            // 連發可能正處於按下階段；同步清除再按下不會被遊戲輪詢看到。
            // 切成鎖定前輸出短暫放開，再持續按下，讓遊戲收到新的按下邊緣。
            if(mode==='hold'||mode==='interval') this.modes.set(id,{mode,start:now,activateAt:now+(previous==='interval'&&mode==='hold'?80:0)});
            this.tick(this.clock());
        }
        cycle(id) {this.set(id,{none:'interval',interval:'hold',hold:'none'}[this.mode(id)]);}
        pulse(key,id,ms=80) {this.pulses.set(key,{id,end:this.clock()+ms}); this.input.set(key,'btn',id,1);}
        restart() {for(const m of this.modes.values()) m.start=this.clock(); this.tick(this.clock());}
        tick(now) {
            for(const [id,m] of this.modes) {
                const delay=this.config.prefs.delay;
                const on=now>=(m.activateAt??m.start)&&(m.mode==='hold'||(now-m.start)%delay<Math.min(100,delay*0.4));
                this.input.set(`auto:${id}`,'btn',id,on?1:0,20);
            }
            for(const [key,p] of this.pulses) if(now>=p.end) {this.pulses.delete(key);this.input.clear(key);}
        }
        stopModes() {for(const id of [...this.modes.keys()]) this.set(id,'none');}
        stop() {this.stopModes(); for(const key of this.pulses.keys()) this.input.clear(key); this.pulses.clear();}
    }

    class MacroEngine {
        constructor(input,config,clock) {
            this.input=input; this.config=config; this.clock=clock; this.slot=1; this.recording=false; this.playing=false;
            this.loop=false; this.started=null; this.events=[]; this.last=blank(); this.index=0;
            input.onChange=()=>this.capture();
        }
        select(slot) {this.stop('slot'); this.slot=slot;}
        record(getState=null,{source='virtual',physicalIndex=null}={}) {
            this.stop('record');this.recordState=getState||(()=>this.input.recordingState());this.recordSource=source;this.physicalIndex=physicalIndex;
            this.recording=true; this.started=null; this.events=[]; this.last=blank(); this.capture();
        }
        capture(force=false) {
            if(!this.recording) return;
            const state=this.recordState(); const now=this.clock();
            for(const [type,field] of [['btn','buttons'],['axis','axes']]) state[field].forEach((raw,id)=>{
                const val=Math.round(raw*100)/100; const old=this.last[field][id];
                const endpoint=val===0||Math.abs(val)===1;
                if(val===old||(!force&&!endpoint&&Math.abs(val-old)<(type==='axis'?0.02:0.01)-1e-8)) return;
                if(this.started===null) this.started=now;
                this.events.push({t:now-this.started,type,id,val}); this.last[field][id]=val;
            });
        }
        stopRecording() {
            if(!this.recording) return;
            this.capture(true); this.recording=false;
            if(this.started!==null) {
                const duration=Math.max(1,this.clock()-this.started);
                this.config.prefs.macros[this.slot]={name:this.config.prefs.macros[this.slot].name||'',duration,events:clone(this.events)}; this.config.save();
            }
        }
        stopPlayback(reason='stop-command') {
            if(this.playing)this.lastStop={reason,at:Date.now(),slot:this.slot,
                callers:(new Error().stack||'').split('\n').slice(2,7).map(line=>line.trim().split(' (')[0].replace(/https?:\/\/\S+/g,'[script]'))};
            this.playing=false;this.loop=false;this.input.clear('macro');
        }
        stop(reason='stop-command') {this.stopRecording();this.stopPlayback(reason);}
        clear() {this.stop('clear'); this.config.prefs.macros[this.slot]={name:'',duration:0,events:[]}; this.config.save();}
        play(loop=false) {
            this.stop('play'); const m=this.config.prefs.macros[this.slot]; if(!m.events.length) return false;
            this.data=clone(m); this.data.duration=Math.max(1,this.data.duration,this.data.events.at(-1).t);
            this.speed=this.config.prefs.macroSpeed||1;this.playing=true;this.loop=loop;this.index=0;this.playStart=this.clock();this.runStart=this.playStart;this.tick(this.playStart);return true;
        }
        tick(now) {
            if(!this.playing) return;
            let elapsed=(now-this.playStart)*(this.speed||1);
            if(elapsed>=this.data.duration&&this.loop) {
                this.playStart+=Math.floor(elapsed/this.data.duration)*this.data.duration/(this.speed||1);
                elapsed=(now-this.playStart)*(this.speed||1);this.index=0;this.input.clear('macro');
            }
            while(this.index<this.data.events.length&&this.data.events[this.index].t<=elapsed) {
                const e=this.data.events[this.index++]; this.input.set('macro',e.type,e.id,e.val,30);
            }
            if(elapsed>=this.data.duration&&!this.loop) this.stopPlayback('complete');
        }
    }

    // 備份驗證比設定遷移嚴格：任一事件有錯，整份拒收，不悄悄丟掉部分動作。
    class MacroBackup {
        static MAX_BYTES=16*1024*1024;
        static MAX_EVENTS=200000;
        static validate(doc) {
            if(!doc||!['cloudpad-studio-macros','better-xcloud-macros'].includes(doc.format)||doc.version!==1)throw Error(translateUI('不是支援的巨集備份，請選擇本程式匯出的 JSON（格式版本 1）。'));
            if(!Array.isArray(doc.macros)||![1,6].includes(doc.macros.length))throw Error(translateUI('備份必須包含單一槽位或完整六組。'));
            const seen=new Set();let total=0;
            const macros=doc.macros.map(m=>{
                if(!m||!Number.isInteger(m.slot)||m.slot<1||m.slot>6||seen.has(m.slot))throw Error(translateUI('槽位編號無效或重複。'));
                seen.add(m.slot);
                if(typeof m.name!=='string'||m.name.length>60)throw Error((translateUI("槽位 ")+String(m.slot)+translateUI(" 的名稱須為 60 字以內的文字。")));
                if(!Number.isFinite(m.duration)||m.duration<0||!Array.isArray(m.events))throw Error((translateUI("槽位 ")+String(m.slot)+translateUI(" 的時間或事件格式錯誤。")));
                total+=m.events.length;if(total>this.MAX_EVENTS)throw Error(translateUI('備份超過 200,000 筆事件上限，請分槽匯出。'));
                let previous=0;
                const events=m.events.map((e,i)=>{
                    if(!e||!['btn','axis'].includes(e.type)||!Number.isInteger(e.id)||e.id<0||e.id>=(e.type==='btn'?17:4)
                        ||!Number.isFinite(e.val)||e.val<(e.type==='btn'?0:-1)||e.val>1
                        ||!Number.isFinite(e.t)||e.t<previous||e.t>m.duration)
                        throw Error((translateUI("槽位 ")+String(m.slot)+translateUI(" 第 ")+String(i+1)+translateUI(" 筆事件無效（按鍵、類比值或時間順序）。")));
                    previous=e.t;return {t:e.t,type:e.type,id:e.id,val:e.val};
                });
                return {slot:m.slot,name:m.name.trim(),duration:m.duration,events};
            });
            return {format:doc.format,version:1,macros};
        }
        static parse(text) {
            if(new TextEncoder().encode(text).length>this.MAX_BYTES)throw Error(translateUI('檔案超過 16 MB 上限。'));
            let doc;try{doc=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error(translateUI('JSON 無法解析，請確認檔案完整且未被修改。'));}
            return this.validate(doc);
        }
        static encode(config,slot=null) {
            const ids=slot===null?[1,2,3,4,5,6]:[slot];
            const doc={format:'cloudpad-studio-macros',version:1,appVersion:VERSION,exportedAt:new Date().toISOString(),
                macros:ids.map(s=>({slot:s,name:config.prefs.macros[s].name||'',duration:config.prefs.macros[s].duration,events:clone(config.prefs.macros[s].events)}))};
            this.validate(doc);const text=JSON.stringify(doc,null,2);
            if(new TextEncoder().encode(text).length>this.MAX_BYTES)throw Error(translateUI('備份超過 16 MB，請分槽匯出。'));
            return text;
        }
        static plan(doc,source,target) {
            const valid=this.validate(doc);
            if(source==='all') {
                if(valid.macros.length!==6)throw Error(translateUI('只有完整六組備份才能全部還原。'));
                return valid.macros.map(m=>({slot:m.slot,value:{name:m.name,duration:m.duration,events:m.events}}));
            }
            const selected=valid.macros.find(m=>m.slot===Number(source));
            if(!selected||!Number.isInteger(target)||target<1||target>6)throw Error(translateUI('請選擇有效的來源與目的槽位。'));
            return [{slot:target,value:{name:selected.name,duration:selected.duration,events:selected.events}}];
        }
        static commit(config,doc,source,target,isBusy) {
            if(isBusy())throw Error(translateUI('請先停止錄製或播放，再匯入。'));
            const plan=this.plan(doc,source,target);const previous=config.prefs.macros;
            config.prefs.macros={...previous};for(const item of plan)config.prefs.macros[item.slot]=clone(item.value);
            if(!config.save()){config.prefs.macros=previous;throw Error(translateUI('儲存失敗，已保留原本的巨集；請先匯出備份並檢查網站儲存空間。'));}
            return plan.length;
        }
    }

    class InputPipeline {
        constructor(config) {this.config=config;}
        process(raw) {
            const out=blank(),p=this.config.prefs;
            raw.buttons.forEach((v,i)=>{const target=p.buttonMap[i];out.buttons[target]=Math.max(out.buttons[target],v);});
            for(let side=0;side<2;side++){
                const t=p.axisTuning[side],x=raw.axes[side*2],y=raw.axes[side*2+1],r=Math.hypot(x,y);
                if(t.deadzone===0&&t.sensitivity===1&&t.max===1&&t.curve==='linear') {
                    out.axes[side*2]=x*(t.invertX?-1:1);out.axes[side*2+1]=y*(t.invertY?-1:1);continue;
                }
                if(r<=t.deadzone)continue;
                let magnitude=clamp((Math.min(1,r)-t.deadzone)/(1-t.deadzone),0,1);
                if(t.curve==='soft')magnitude=magnitude*magnitude;
                if(t.curve==='fast')magnitude=Math.sqrt(magnitude);
                magnitude=Math.min(t.max,magnitude*t.sensitivity);
                out.axes[side*2]=x/r*magnitude*(t.invertX?-1:1);out.axes[side*2+1]=y/r*magnitude*(t.invertY?-1:1);
            }
            return out;
        }
        physical(pad) {
            if(!this.config.prefs.physicalMapping||!pad)return pad;
            const buttons=Array.from({length:17},(_,i)=>clamp(pad.buttons[i]?.value??(pad.buttons[i]?.pressed?1:0),0,1));
            const out=this.process({buttons,axes:Array.from({length:4},(_,i)=>pad.axes[i]||0)});
            // 不覆寫原生 Gamepad；回傳保留 index、id 等資料的代理。
            return new Proxy(pad,{get:(target,key)=>key==='buttons'?out.buttons.map(value=>({value,pressed:value>.05,touched:value>0})):key==='axes'?out.axes:Reflect.get(target,key,target)});
        }
    }

    class ConfigurationBackup {
        static groups=['macros','layouts','settings'];
        static settingKeys=Object.keys(DEFAULTS()).filter(k=>!['macros','layouts','touchLayouts','racingLayouts','layoutNames'].includes(k));
        static encode(config) {const doc={format:'cloudpad-studio-config',version:1,appVersion:VERSION,exportedAt:new Date().toISOString(),settings:clone(config.prefs)};this.validate(doc);return JSON.stringify(doc,null,2);}
        static validate(doc) {
            if(!doc||!['cloudpad-studio-config','better-xcloud-config'].includes(doc.format)||doc.version!==1||!doc.settings||Array.isArray(doc.settings))throw Error(translateUI('不是支援的完整備份（格式版本 1）。'));
            if(new TextEncoder().encode(JSON.stringify(doc)).length>MacroBackup.MAX_BYTES)throw Error(translateUI('備份超過 16 MB。'));
            const d=clone(doc.settings),defaults=DEFAULTS();
            // v15.0.0～15.0.2 完整備份沒有來源設定，仍可還原為虛擬錄製。
            if(!('macroRecordSource' in d))d.macroRecordSource='virtual';
            for(const key of ['backgroundMacro','language','touchAutoFade','racingLayouts','controlStyle','touchPanelPos','touchLayouts','touchButtonSize','touchStickSize','touchHitPadding','touchOpacityLeft','touchOpacityRight','touchOpacityUtility'])if(!(key in d))d[key]=clone(defaults[key]);
            for(const key of Object.keys(defaults))if(!(key in d))throw Error((translateUI("備份缺少 ")+String(key)+"。"));
            MacroBackup.validate({format:'better-xcloud-macros',version:1,macros:[1,2,3,4,5,6].map(slot=>({slot,...d.macros?.[slot]}))});
            for(let s=1;s<=6;s++){
                if(!d.layouts?.[s]||Array.isArray(d.layouts[s])||typeof d.layoutNames?.[s]!=='string'||d.layoutNames[s].length>60)throw Error(translateUI('佈局資料不完整。'));
                for(const [id,v] of Object.entries(d.layouts[s]))if(![...Object.keys(GROUPS),'16'].includes(id)||!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||Math.abs(v.x)>10000||Math.abs(v.y)>10000)throw Error((translateUI("佈局 ")+String(s)+translateUI(" 有無效位移。")));
                if(!d.touchLayouts?.[s]||Array.isArray(d.touchLayouts[s])||typeof d.touchLayouts[s]!=='object')throw Error(translateUI('觸控佈局資料不完整。'));
                for(const [id,v] of Object.entries(d.touchLayouts[s]))if(![...Object.keys(GROUPS),'16'].includes(id)||!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||Math.abs(v.x)>10000||Math.abs(v.y)>10000)throw Error((translateUI("觸控佈局 ")+String(s)+translateUI(" 有無效位移。")));
                if(!d.racingLayouts?.[s]||Array.isArray(d.racingLayouts[s])||typeof d.racingLayouts[s]!=='object')throw Error(translateUI('賽車佈局資料不完整。'));
                for(const [id,v] of Object.entries(d.racingLayouts[s]))if(![...Object.keys(GROUPS),'16'].includes(id)||!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||Math.abs(v.x)>10000||Math.abs(v.y)>10000)throw Error((translateUI("賽車佈局 ")+String(s)+translateUI(" 有無效位移。")));
            }
            const checked=new ConfigStore({getItem:()=>null,setItem:()=>{}},()=>{}).sanitize(d);
            // 備份用嚴格驗證：不容許無效數值被靜默修正。
            const equal=(a,b)=>a===b||(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])));
            for(const key of this.settingKeys)if(!equal(d[key],checked[key]))throw Error((translateUI("設定 ")+String(key)+translateUI(" 無效。")));
            if(new Set(d.macroKeys).size!==6||d.macroKeys.includes(d.emergencyKey))throw Error(translateUI('巨集快捷鍵重複，或與急停鍵衝突。'));
            if(new Set(d.macroCombos.map(c=>[...c].sort((a,b)=>a-b).join(','))).size!==6)throw Error(translateUI('巨集組合鍵重複。'));
            return checked;
        }
        static parse(text) {if(new TextEncoder().encode(text).length>MacroBackup.MAX_BYTES)throw Error(translateUI('備份超過 16 MB。'));let d;try{d=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error(translateUI('JSON 無法解析。'));}return this.validate(d);}
        static commit(config,data,groups) {
            if(!groups.length||groups.some(g=>!this.groups.includes(g)))throw Error(translateUI('請選擇還原項目。'));
            const valid=this.validate({format:'better-xcloud-config',version:1,settings:data}),old=clone(config.prefs),next=clone(old);
            if(groups.includes('macros'))next.macros=valid.macros;
            if(groups.includes('layouts')){next.layouts=valid.layouts;next.touchLayouts=valid.touchLayouts;next.racingLayouts=valid.racingLayouts;next.layoutNames=valid.layoutNames;}
            if(groups.includes('settings'))for(const key of this.settingKeys)next[key]=valid[key];
            Object.assign(config.prefs,next);if(!config.save()){Object.assign(config.prefs,old);throw Error(translateUI('儲存失敗，已還原原資料。'));}
        }
    }

    class MacroTimeline {
        static normalize(value) {
            const copy=clone(value);copy.events.sort((a,b)=>a.t-b.t);
            return MacroBackup.validate({format:'better-xcloud-macros',version:1,macros:[{slot:1,...copy}]}).macros[0];
        }
        static save(config,slot,draft) {
            const valid=this.normalize(draft),old=config.prefs.macros[slot];
            config.prefs.macros[slot]={name:valid.name,duration:valid.duration,events:valid.events};
            if(!config.save()){config.prefs.macros[slot]=old;throw Error(translateUI('儲存失敗，原巨集未更動。'));}
        }
    }

    class ShortcutManager {
        constructor(app) {
            this.app=app;this.comboHeld=new Set();this.keyHeld=new Set();this.blocked=new Set();this.holdSince=new Map();
            window.addEventListener('keydown',e=>{
                const p=app.config.prefs;
                if(p.emergencyEnabled&&e.code===p.emergencyKey&&!e.repeat){e.preventDefault();app.stopAll();app.notice(translateUI('急停：已釋放所有虛擬輸入。'));return;}
                const editing=e.composedPath().some(n=>n?.matches?.('input,select,textarea,[contenteditable=true]'));
                if(e.repeat||editing||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||!p.keyboardMacros||this.keyHeld.has(e.code))return;
                const slot=p.macroKeys.indexOf(e.code)+1;if(!slot)return;
                if(app.macro.recording||app.layout.editing)return;e.preventDefault();this.keyHeld.add(e.code);app.playMacro(false,slot);
            },{signal:app.signal,capture:true});
            window.addEventListener('keyup',e=>this.keyHeld.delete(e.code),{signal:app.signal});
            window.addEventListener('blur',()=>{this.keyHeld.clear();this.comboHeld.clear();},{signal:app.signal});
        }
        tick(now) {
            const a=this.app,p=a.config.prefs;
            if(p.playbackLimit&&a.macro.playing&&now-a.macro.runStart>=p.playbackLimit*1000){a.macro.stop('time-limit');a.notice(translateUI('巨集已達播放時間上限，已停止。'));}
            const present=new Set();
            for(const [key,state] of a.input.sources){
                if(!/^(manual:|race:)/.test(key))continue;present.add(key);
                const held=[...state.buttons.values()].some(v=>v>.05);
                if(!held){this.holdSince.delete(key);continue;}
                if(!this.holdSince.has(key))this.holdSince.set(key,now);
                if(p.holdTimeout&&now-this.holdSince.get(key)>=p.holdTimeout*1000){a.input.clear(key);this.blocked.add(key);this.holdSince.delete(key);a.notice(translateUI('長按已達保護上限；請放開後重新操作。'));}
            }
            for(const key of this.holdSince.keys())if(!present.has(key))this.holdSince.delete(key);
            if(!p.comboMacros){this.comboHeld.clear();return;}
            const raw=a.rawSnapshot(key=>key!=='macro'&&key!=='afk'&&!key.startsWith('auto:'));
            raw.buttons=raw.buttons.map((v,i)=>Math.max(v,a.physical.state.buttons[i]));
            // 先鎖存整組，播放造成的輸入清除不會在同一幀重複觸發。
            const active=p.macroCombos.map(c=>c.every(id=>raw.buttons[id]>.5));let trigger=0;
            active.forEach((on,i)=>{if(on&&!this.comboHeld.has(i)&&!trigger)trigger=i+1;if(on)this.comboHeld.add(i);else this.comboHeld.delete(i);});
            if(trigger&&!a.macro.recording&&!a.layout.editing)a.playMacro(false,trigger);
        }
    }

    // 唯一的全域拖曳事件組。每根手指各自拥有工作階段，取消只影響自己。
    class PointerManager {
        constructor(target,signal) {
            this.sessions=new Map();this.bindings=new WeakMap();
            target.addEventListener('pointermove',e=>{const s=this.sessions.get(e.pointerId);if(s){e.preventDefault();s.move?.(e);}},{signal,passive:false});
            for(const type of ['pointerup','pointercancel','lostpointercapture'])
                target.addEventListener(type,e=>this.finish(e.pointerId,e,type!=='pointerup'),{signal,capture:true});
            this.signal=signal;
        }
        bind(el,start) {
            el.style.touchAction='none';
            el.addEventListener('pointerdown',e=>{
                if(e.button!==0){if(e.button===2){e.preventDefault();e.stopPropagation();}return;}
                if(this.sessions.has(e.pointerId)) return;
                const session=start(e); if(!session) return;
                e.preventDefault();e.stopPropagation(); session.el=el;this.sessions.set(e.pointerId,session);
                try{el.setPointerCapture(e.pointerId);}catch{/* Detached test elements do not support capture. */}
            },{signal:this.signal});
        }
        finish(id,e,cancelled) {
            const s=this.sessions.get(id);if(!s)return;this.sessions.delete(id);
            s.end?.(e,cancelled);try{if(s.el.hasPointerCapture(id)) s.el.releasePointerCapture(id);}catch{}
        }
        cancelAll() {for(const [id] of [...this.sessions]) this.finish(id,null,true);}
        get busy() {return this.sessions.size>0;}
    }

    class LayoutManager {
        constructor(config) {this.config=config;this.items=new Map();this.editing=false;this.group=true;this.snap=true;this.dragging=false;}
        register(id,el) {this.items.set(String(id),el);this.apply();}
        collection() {const p=this.config.prefs;return p.gameMode==='racing'?p.racingLayouts:p.controlStyle==='touch'?p.touchLayouts:p.layouts;}
        offsets() {return this.collection()[this.config.prefs.layoutSlot];}
        apply() {for(const [id,el] of this.items) {const p=this.offsets()[id]||{x:0,y:0};el.style.transform=`translate(${p.x}px,${p.y}px)`;}}
        drag(id,e,scale) {
            if(this.dragging) return null;this.dragging=true;
            const group=this.group?GROUPS[id]:null;
            const ids=group?[...this.items.keys()].filter(i=>GROUPS[i]===group):[String(id)];
            const starts=Object.fromEntries(ids.map(i=>[i,{...(this.offsets()[i]||{x:0,y:0})}]));
            const x=e.clientX,y=e.clientY;
            return {move:ev=>{
                let dx=(ev.clientX-x)/scale,dy=(ev.clientY-y)/scale;
                if(this.snap){dx=Math.round(dx/10)*10;dy=Math.round(dy/10)*10;}
                ids.forEach(i=>this.offsets()[i]={x:starts[i].x+dx,y:starts[i].y+dy});this.apply();
            },end:(_,cancel)=>{this.dragging=false;if(cancel){ids.forEach(i=>this.offsets()[i]=starts[i]);this.apply();}else this.config.save();}};
        }
        reset() {this.collection()[this.config.prefs.layoutSlot]={};this.apply();this.config.save();}
    }

    class RacingController {
        constructor(app) {this.app=app;this.afk=false;this.left=null;this.right=null;}
        start(side,e) {
            if(this[side])return null;if(this.app.manualStart()===false)return null;
            const key=`race:${e.pointerId}`;const s={x:e.clientX,y:e.clientY,dx:0,dy:0,ratio:0,pressed:false,flick:false};this[side]=s;
            if(side==='left')this.app.input.set(key,'axis',0,0);
            return {move:ev=>{
                if(this.app.manualStart()===false)return null;const dx=ev.clientX-s.x,dy=ev.clientY-s.y;
                if(side==='left') {
                    s.dx=clamp(dx,-55,55);this.app.input.set(key,'axis',0,s.dx/55);
                    const down=dy>40;if(down&&!s.pressed)this.app.vibrate(30);s.pressed=down;
                    this.app.input.set(key,'btn',0,down?1:0);
                }else{
                    if(!s.flick&&Math.abs(dx)>35){s.flick=true;this.app.auto.pulse(`flick:${e.pointerId}`,dx>0?1:2);this.app.vibrate([40,30]);}
                    s.dy=clamp(dy,-70,70);s.ratio=Math.abs(s.dy)/70;
                    this.app.input.set(key,'btn',7,s.dy<0&&s.ratio>0.05?s.ratio:0);
                    this.app.input.set(key,'btn',6,s.dy>=0&&s.ratio>0.05?s.ratio:0);
                }
            },end:()=>{this[side]=null;this.app.input.clear(key);}};
        }
        tick(now) {
            if(!this.afk){this.app.input.clear('afk');return;}
            const axis=(Math.sin(now/800)+Math.sin(now/1700)*0.4+(Math.random()-0.5)*0.04)*this.app.config.prefs.afkAmp;
            this.app.input.set('afk','axis',0,axis,10);
        }
        stop() {this.afk=false;this.app.input.clear('afk');}
    }

    // DOM / CSS 與核心引擎分離。Shadow DOM 隔離 Xbox 網頁樣式。
    const el = (tag,cls='',text='') => {const n=document.createElement(tag);n.className=cls;if(text&&(typeof text!=='function'||text()!==''))setText(n,typeof text==='function'?text:()=>translateUI(text));return n;};
    const button = (text,fn,cls='') => {const b=el('button',cls,typeof text==='function'?text:()=>translateUI(text));b.type='button';b.onclick=e=>{e.stopPropagation();fn(e);};return b;};
    const styleValue = (node,key,value) => {if(node.style[key]!==value) node.style[key]=value;};
    const CSS = `
    :host{all:initial;font-family:system-ui,"Microsoft JhengHei",sans-serif;color:#edf4fa;--line:#ffffff26;--green:#74efb4;--muted:#93a4b6}
    *{box-sizing:border-box} [hidden]{display:none!important} button,select,input{font:inherit;color:inherit}
    button,select{border:1px solid var(--line);background:#1c2937;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:11px;line-height:1.3}
    button:hover{border-color:#74efb4aa} button:focus-visible,select:focus-visible{outline:2px solid #74efb4}
    button.on{background:#235341;color:#baffdc;border-color:#74efb4} button.danger{color:#ffaba9;border-color:#ff777766;background:#482c34}
    .panel,.viewer,.popup{position:fixed;pointer-events:auto;user-select:none;border:1px solid var(--line);border-radius:16px;background:#111c29ed;box-shadow:0 8px 30px #0005;transform-origin:top left}
    .panel{padding:10px;width:550px;z-index:5}.panel.transparent{background:transparent;box-shadow:none}.panel.transparent .controls{background:transparent}
    .header,.row,.tabs,.status{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.header{display:grid;grid-template-columns:auto auto 1fr auto;gap:8px;min-height:28px}
    .toolbar-group{display:flex;align-items:center;gap:5px;white-space:nowrap}.toolbar-functions{border-left:1px solid var(--line);padding-left:8px}.toolbar-actions{border-left:1px solid var(--line);padding-left:8px;justify-self:end}
    .compact-toolbar .header{grid-template-columns:auto 1fr auto;row-gap:6px}.compact-toolbar .toolbar-modes{grid-column:2 / 4}.compact-toolbar .toolbar-functions{grid-column:1 / 3;border-left:0;padding-left:0}.compact-toolbar .toolbar-actions{grid-column:3}
    .brand{font-size:11px;letter-spacing:.8px;color:var(--green);cursor:grab;touch-action:none;padding:7px 4px}
    .meta,.hint{font-size:10px;color:var(--muted);line-height:1.6}.hint{margin-top:8px}.status{margin-top:7px}.status:empty{display:none}
    .status button{font-size:10px;padding:4px 7px}.tabs{margin:10px 0;border-top:1px solid var(--line);padding-top:8px}
    .tools{padding:10px;background:#0a131cbb;border:1px solid var(--line);border-radius:10px;max-height:40vh;overflow:auto;overscroll-behavior:contain}
    .setting{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:6px 0;font-size:11px}.setting select{max-width:170px}
    .slots{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:9px}
    .slots button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.help-off .hint,.help-off .racing-hint,.help-off .racezone>span{display:none}
    input[type=text]{min-width:0;width:70%;background:#1c2937;border:1px solid var(--line);border-radius:6px;padding:6px;user-select:text}button:disabled,select:disabled,input:disabled{opacity:.45;cursor:default}
    .backup{border-top:1px solid var(--line);margin-top:10px;padding-top:10px}.import-preview{margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px}.import-preview .meta{overflow-wrap:anywhere}.backup-message{margin-top:7px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}
    .controls{position:relative;margin-top:10px;display:flex;flex-direction:column;gap:12px}
    .topkeys{display:flex;justify-content:space-between;gap:10px}.cluster{display:flex;gap:7px;align-items:center}
    .playrow{display:flex;align-items:flex-end;justify-content:center;gap:44px;padding:0 8px}.zone{display:flex;align-items:flex-end;gap:22px}
    .padkey{position:relative;z-index:1;touch-action:none;height:32px;min-width:44px;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:9px;background:#1b2938cc;color:#e2eaf3;padding:0;flex-shrink:0}
    .padkey[data-id="0"]{color:#74efb4}.padkey[data-id="1"]{color:#ff8585}.padkey[data-id="2"]{color:#82bfff}.padkey[data-id="3"]{color:#ffe088}
    .padkey[data-mode="hold"]{border-color:#ff7777;box-shadow:inset 0 0 0 1px #ff7777}.padkey[data-mode="interval"]{border-color:#ffd26e;box-shadow:inset 0 0 0 1px #ffd26e}
    .padkey.active{background:#39725d;color:#fff;box-shadow:0 0 10px #74efb455}.padkey.trigger{background:linear-gradient(to top,#3b8267 var(--depth,0%),#1b2938cc var(--depth,0%))}
    .cross{display:grid;grid-template-columns:repeat(3,32px);grid-template-rows:repeat(3,32px);gap:4px}.cross .padkey{width:32px;height:32px;min-width:0}
    .face .padkey{border-radius:50%}.stickwrap{position:relative}.stick{width:86px;height:86px;border-radius:50%;border:1px solid #ffffff40;background:#0a1420c9;position:relative;touch-action:none;display:flex;align-items:center;justify-content:center}
    .stick.active{border-color:var(--green)}.knob{width:38px;height:38px;border-radius:50%;background:#728599;border:2px solid #a5b9cd;pointer-events:none;display:grid;place-items:center;font-size:9px;color:#172432}
    .stickwrap>.padkey{position:absolute;bottom:-2px;left:-4px;width:25px;height:25px;min-width:0;border-radius:50%;font-size:9px}
    .stickwrap.left{left:-8px}.stickwrap.right{left:8px}.stickwrap.right>.padkey{left:auto;right:-4px}
    .editing .padkey,.editing .stick{outline:1px dashed #ffda75;cursor:move}.editing .controls{background-image:radial-gradient(#ffe19944 1px,transparent 1px);background-size:10px 10px}
    .compact .playrow{gap:18px}.compact .zone{gap:12px}.compact .stick{width:50px;height:50px}.compact .knob{width:24px;height:24px}.compact .cross{grid-template-columns:repeat(3,24px);grid-template-rows:repeat(3,24px);gap:2px}.compact .cross .padkey{width:24px;height:24px;font-size:9px}
    .racing-hint{margin-top:5px;color:var(--muted);font-size:10px}
    .racearea{position:fixed;left:0;bottom:0;width:100vw;height:62vh;display:flex;pointer-events:none;z-index:1}.racezone{width:50%;height:100%;pointer-events:auto;touch-action:none;position:relative}.racezone>span{position:absolute;bottom:12px;left:20px;font-size:10px;color:#ffffff55;pointer-events:none}
    canvas{position:fixed;inset:0;pointer-events:none;z-index:2}
    .viewer{width:300px;padding:12px;z-index:4;cursor:grab;touch-action:none}.viewer .head{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:10px}
    .triggers{display:flex;gap:14px}.meter{flex:1;font-size:10px;color:var(--muted)}.meterlabel{display:flex;justify-content:space-between;margin-bottom:4px}.track{height:7px;border-radius:5px;background:#ffffff15;overflow:hidden}.fill{width:100%;height:100%;background:var(--green);transform:scaleX(0);transform-origin:left}.mirror .fill{transform-origin:right}
    .viewerkeys{display:flex;justify-content:space-between;margin:11px 0 12px}.vkey{border:1px solid var(--line);border-radius:5px;font-size:9px;min-width:28px;height:21px;display:flex;align-items:center;justify-content:center;color:#9db0c2}.vkey.active{color:#142b20;background:var(--green);border-color:var(--green)}
    .vbottom{display:flex;align-items:center;justify-content:space-between;gap:7px}.vstick{width:46px;height:46px;border-radius:50%;border:1px solid #ffffff33;display:grid;place-items:center;position:relative;background:#0a1420}.vdot{width:20px;height:20px;background:#7890a6;border:1px solid #b3c5d7;border-radius:50%;display:grid;place-items:center;font-size:7px;color:#081727}.vdot.active{background:var(--green)}
    .vcross{display:grid;grid-template-columns:repeat(3,18px);grid-template-rows:repeat(3,18px);gap:2px}.vcross .vkey{min-width:0;height:18px;font-size:8px}.vface .vkey{border-radius:50%}
    .viewerfoot{display:flex;justify-content:flex-end;margin-top:7px}.viewerfoot button{padding:3px 7px;font-size:10px}.popup{z-index:10;padding:8px;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 16px)}

    /* Collapsed controls keep macros, settings, expand and emergency stop directly available. */
    .panel.collapsed{padding:6px 8px;border-radius:12px;background:#111c29b8;box-shadow:0 3px 12px #0003}
    .panel.collapsed .header{display:flex;flex-wrap:nowrap;gap:5px;min-height:30px}
    .panel.collapsed .toolbar-modes,.panel.collapsed .help-toggle{display:none}
    .panel.collapsed .toolbar-functions{border:0;padding:0;gap:4px}
    .panel.collapsed .toolbar-actions{margin-left:auto;padding-left:5px;gap:4px}
    .panel.collapsed .header button{padding:6px 5px;min-height:30px}
    .panel.collapsed .brand{padding:6px 2px}
    /* Only touch/racing controls use the outline treatment; hit areas and positions stay intact. */
    .touchdock .padkey,.touch-utility .padkey{background:#10182012;border:1.5px solid #ffffffa6;text-shadow:0 1px 3px #000;box-shadow:0 1px 4px #0005;transition:background .1s,border-color .1s}
    .touchdock .padkey[data-id="0"],.touchdock .padkey[data-id="1"],.touchdock .padkey[data-id="2"],.touchdock .padkey[data-id="3"]{border-color:currentColor}
    .touchdock .stick{background:#1018200d;border:1.5px solid #ffffffa6;box-shadow:0 1px 4px #0004}
    .touchdock .knob{background:#ffffff0d;color:#edf4fa;border:1.5px solid #ffffffb3;text-shadow:0 1px 3px #000}
    .touchdock .stick.active{border-color:var(--green)}.touchdock .stick.active .knob{background:#39725d99;border-color:var(--green)}
    .touchdock .padkey.active,.touch-utility .padkey.active{background:#39725db3;color:#fff;box-shadow:0 0 8px #74efb466}
    .touchdock .padkey.trigger,.touch-utility .padkey.trigger{background:linear-gradient(to top,#3b8267b3 var(--depth,0%),#10182012 var(--depth,0%))}
    .touchdock .padkey[data-mode="hold"],.touch-utility .padkey[data-mode="hold"]{border-color:#ff8585;box-shadow:0 0 0 1px #ff8585,inset 0 0 0 1px #ff8585}
    .touchdock .padkey[data-mode="interval"],.touch-utility .padkey[data-mode="interval"]{border-color:#ffd26e;box-shadow:0 0 0 1px #ffd26e,inset 0 0 0 1px #ffd26e}
    .touchdock .padkey[data-mode="hold"]::after,.touch-utility .padkey[data-mode="hold"]::after{content:'●';color:#ff8585}
    .touchdock .padkey[data-mode="interval"]::after,.touch-utility .padkey[data-mode="interval"]::after{content:'∞';color:#ffd26e}
    .touchdock .padkey[data-mode]::after,.touch-utility .padkey[data-mode]::after{position:absolute;right:-4px;top:-6px;font-size:11px;line-height:15px;text-shadow:0 1px 3px #000;pointer-events:none}
    .touchdock.editing .padkey,.panel.editing .touch-utility .padkey{background:#1b2938ee;transition:none}
    .touchdock.editing .stick{background:#0a1420e6}.touchdock.editing .knob{background:#728599;color:#172432}
    .notice{position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:90vw;background:#512b31;color:#ffdedc;padding:10px 16px;border-radius:10px;z-index:20;pointer-events:auto;font-size:12px}
    `;

    class TouchLayout {
        constructor(app) {
            this.app=app;this.panel=app.panel;this.p=app.config.prefs;this.active=false;this.scale=1;
            const controls=this.panel.controls,top=controls.querySelector('.topkeys'),zones=controls.querySelectorAll('.playrow>.zone');
            this.nodes={leftTop:top.children[0],utility:top.children[1],rightTop:top.children[2],
                leftStick:zones[0].children[0],leftCross:zones[0].children[1],rightCross:zones[1].children[0],rightStick:zones[1].children[1]};
            this.anchors=new Map();for(const node of Object.values(this.nodes)){const anchor=document.createComment('control home');node.before(anchor);this.anchors.set(node,anchor);}
            this.root=el('div','touchdock');setLabel(this.root,"aria-label",()=>translateUI('觸控手把操作區'));this.root.hidden=true;
            this.left=el('div','touch-region touch-left');this.right=el('div','touch-region touch-right');this.root.append(this.left,this.right);app.shadow.append(this.root);
            this.utility=el('div','touch-utility');this.utility.hidden=true;this.panel.status.before(this.utility);
            const style=el('style');style.textContent=`
                .touchdock{position:fixed;inset:0;z-index:3;pointer-events:none;user-select:none}
                .touch-region{position:absolute;bottom:calc(14px + env(safe-area-inset-bottom,0px));width:var(--region-w);height:var(--region-h);pointer-events:none}
                .touch-left{left:calc(14px + env(safe-area-inset-left,0px));transform-origin:bottom left}
                .touch-right{right:calc(14px + env(safe-area-inset-right,0px));transform-origin:bottom right}
                .touchdock .padkey,.touchdock .stick{pointer-events:auto}
                .touchdock .padkey{width:var(--button)!important;height:var(--button)!important;min-width:0;font-size:14px;border-radius:11px;overflow:visible}
                .touchdock .padkey::before{content:'';position:absolute;inset:calc(-1 * var(--hit));border-radius:inherit}
                .touchdock .cross{position:absolute;bottom:var(--cross-y);width:var(--cross);height:var(--cross);grid-template-columns:repeat(3,var(--cell));grid-template-rows:repeat(3,var(--cell));gap:4px;place-items:center}
                .touch-left>.cross{right:0}.touch-right>.cross{left:0}
                .touchdock .face .padkey{border-radius:50%}
                .touchdock .stickwrap{position:absolute;bottom:0;width:var(--stick);height:var(--stick)}
                .touch-left>.stickwrap{left:0!important;right:auto}.touch-right>.stickwrap{right:0;left:auto!important}
                .touchdock .stick{width:var(--stick);height:var(--stick)}
                .touchdock .knob{width:calc(var(--stick) * .44);height:calc(var(--stick) * .44);font-size:12px}
                .touchdock .stickwrap>.padkey{width:28px!important;height:28px!important;font-size:10px}
                .touchdock .stickwrap>.padkey::before{inset:0}
                .touchdock .touch-top{position:absolute;bottom:var(--top-y);gap:calc(var(--hit) * 2 + 8px)}
                .touch-left>.touch-top{left:0}.touch-right>.touch-top{right:0}
                .touchdock .touch-top .padkey{width:calc(var(--button) + 8px)!important;height:36px!important;font-size:12px}
                .touch-utility{margin-top:7px}.utility-floating{position:fixed;top:15px;left:50%;margin:0;z-index:5;pointer-events:none;transform-origin:top center}.utility-floating .padkey{pointer-events:auto}.touch-utility>.cluster{gap:8px;justify-content:center}
                .touch-utility .padkey{height:30px!important;min-width:34px;font-size:10px}
                .race-dock .touch-region{top:var(--race-top);bottom:auto;transform-origin:top left}.race-dock .touch-right{transform-origin:top right}
                .race-dock .touch-left>.stickwrap{bottom:var(--race-stick-y)}.race-dock .touch-left>.cross{bottom:0;left:0;right:auto}
                .race-dock .touch-right>.cross{left:auto;right:0}
                .race-dock .touch-top{position:fixed!important;top:calc(14px + env(safe-area-inset-top,0px));bottom:auto!important}
                .touchdock.editing .padkey::before{outline:1px dashed #ffdb75;background:#ffdb7510}
                .touchdock.editing .stick{outline:1px dashed #ffdb75;cursor:move}
                .touchdock.editing .touch-region{background-image:radial-gradient(#ffe19933 1px,transparent 1px);background-size:10px 10px}
                .panel.touch-mode.editing .touch-utility,.panel.touch-mode.editing .hint,.panel.touch-mode.editing .v15-card,
                .panel.touch-mode.editing .tools .slots,.panel.touch-mode.editing [data-setting="controlStyle"]{display:none}
            `;app.shadow.append(style);
        }
        positionPanel() {
            const p=this.p,r=this.panel.root;
            const point=this.active?p.touchPanelPos:p.panelPos;
            r.style.left=p.gameMode==='racing'?'15px':point?.x||'15px';
            r.style.top=p.gameMode==='racing'?'15px':point?.y||(this.active?'15px':`${Math.max(15,window.innerHeight-280*p.uiScale)}px`);
        }
        sync() {
            const racing=this.p.gameMode==='racing',active=racing||this.p.controlStyle==='touch',modeChanged=this.racing!==racing;this.racing=racing;
            if(active!==this.active){
                this.app.pointers.cancelAll();this.active=active;
                if(active){
                    const n=this.nodes;n.leftTop.classList.add('touch-top');n.rightTop.classList.add('touch-top');
                    this.left.append(n.leftTop,n.leftStick,n.leftCross);this.right.append(n.rightTop,n.rightStick,n.rightCross);this.utility.append(n.utility);
                }else for(const [node,anchor] of this.anchors){anchor.after(node);node.classList.remove('touch-top');}
                this.positionPanel();this.app.layout.apply();
            }
            if(active){const n=this.nodes;if(racing){this.root.append(n.leftTop,n.rightTop);n.leftTop.style.left='14px';n.rightTop.style.right='14px';}else{this.left.prepend(n.leftTop);this.right.prepend(n.rightTop);n.leftTop.style.left='';n.rightTop.style.right='';}}
            if(active&&!racing){this.app.shadow.append(this.utility);this.utility.classList.add('utility-floating');}else{this.panel.status.before(this.utility);this.utility.classList.remove('utility-floating');this.utility.style.cssText='';}
            this.root.classList.toggle('race-dock',racing);this.utility.hidden=!active||this.panel.collapsed;this.root.classList.toggle('editing',this.app.layout.editing);
            if(modeChanged){this.positionPanel();this.app.layout.apply();this.root.style.opacity='1';}
            if(active){
                const p=this.p,button=36*p.touchButtonSize,hit=p.touchHitPadding,cell=button+hit*2+4,cross=cell*3+8,stick=100*p.touchStickSize;
                const stacked=window.innerWidth<760,topY=stacked?stick+cross+24:stick+16,crossY=stacked?stick+12:42;
                const sideWidth=Math.max(stick,2*(button+8)+hit*2+8);
                const width=stacked?Math.max(cross,sideWidth):sideWidth+24+cross;
                const height=Math.max(topY+36,crossY+cross,stick);
                this.scale=Math.min(1,Math.max(.1,(window.innerWidth-44)/(2*width)),Math.max(.1,(window.innerHeight*.65-28)/height));
                this.renderedHeight=height*this.scale;
                for(const [key,value] of Object.entries({'--button':button,'--hit':hit,'--cell':cell,'--cross':cross,'--stick':stick,'--region-w':width,'--region-h':height,'--cross-y':crossY,'--top-y':topY}))this.root.style.setProperty(key,`${value}px`);
                this.left.style.transform=this.right.style.transform=`scale(${this.scale})`;
                this.left.style.opacity=this.app.layout.editing?'1':String(p.touchOpacityLeft);this.right.style.opacity=this.app.layout.editing?'1':String(p.touchOpacityRight);
                this.utility.style.opacity=this.app.layout.editing?'1':String(p.touchOpacityUtility);
                if(racing){
                    const raceWidth=Math.max(cross,stick,sideWidth),raceHeight=cross+stick+18;
                    this.scale=Math.min(1,(window.innerWidth-44)/(2*raceWidth),(window.innerHeight*.48)/raceHeight);
                    this.root.style.setProperty('--region-w',`${raceWidth}px`);this.root.style.setProperty('--region-h',`${raceHeight}px`);
                    this.root.style.setProperty('--race-stick-y',`${cross+18}px`);this.root.style.setProperty('--cross-y',`${stick+18}px`);
                    this.left.style.transform=this.right.style.transform=`scale(${this.scale})`;
                    this.root.style.setProperty('--race-top',`${Math.max(76,window.innerHeight*.42-raceHeight*this.scale/2)}px`);
                    this.renderedHeight=0;
                }
            }
            this.updateVisibility();
        }
        positionUtility() {
            if(!this.utility.classList.contains('utility-floating'))return;
            const scale=Math.min(this.p.uiScale,(window.innerWidth-24)/180);this.utility.style.transform=`translateX(-50%) scale(${scale})`;this.utility.style.top='15px';
            const u=this.utility.getBoundingClientRect(),p=this.panel.root.getBoundingClientRect();
            if(!this.panel.root.hidden&&u.left<p.right+8&&u.right>p.left-8&&u.top<p.bottom+8)this.utility.style.top=`${p.bottom+8}px`;
        }
        updateVisibility() {this.root.hidden=!this.active||this.panel.collapsed||this.app.override;this.utility.hidden=!this.active||this.panel.collapsed||this.app.override||(this.app.layout.editing&&this.utility.classList.contains('utility-floating'));}

    }

    class ControlPanel {
        constructor(app) {
            this.app=app;this.config=app.config;this.p=this.config.prefs;this.root=el('section','panel');
            setLabel(this.root,"aria-label",()=>translateUI('虛擬手把控制面板'));this.collapsed=false;this.tab=null;this.dirty=true;
            this.buttons=[];this.sticks=[];this.tapStates=new Map();
            this.header=el('div','header');this.drag=el('span','brand',()=>'⠿');setLabel(this.drag,'title',()=>(String(APP_NAME)+" · v"+String(VERSION)+translateUI(" · 拖曳面板")));setLabel(this.drag,"aria-label",()=>translateUI('拖曳面板'));
            this.collapseBtn=button(()=>translateUI('收合'),()=>{app.pointers.cancelAll();this.collapsed=!this.collapsed;this.refresh();});
            this.modeBtn=button(()=>'',()=>app.changeMode());this.toolBtn=button(()=>translateUI('設定 ⚙'),()=>this.openTab(this.tab==='settings'&&!this.collapsed?null:'settings'));
            this.macroQuick=button(()=>translateUI('巨集'),()=>this.openTab(this.tab==='macro'&&!this.collapsed?null:'macro'));
            this.styleQuick=button(()=>translateUI('面板'),()=>app.changeControlStyle());setLabel(this.styleQuick,"aria-label",()=>translateUI('快速切換標準／觸控佈局'));
            this.helpBtn=button(()=>'?',()=>{this.p.showHelp=!this.p.showHelp;this.config.save();this.refresh();});setLabel(this.helpBtn,"aria-label",()=>translateUI('顯示操作說明'));
            this.stopBtn=button(()=>translateUI('■ 全停'),()=>app.stopAll(),'danger');
            const modes=el('div','toolbar-group toolbar-modes'),functions=el('div','toolbar-group toolbar-functions'),actions=el('div','toolbar-group toolbar-actions');
            modes.append(this.modeBtn,this.styleQuick);functions.append(this.macroQuick,this.toolBtn,this.helpBtn);actions.append(this.collapseBtn,this.stopBtn);
            this.header.append(this.drag,modes,functions,actions);
            this.status=el('div','status');setLabel(this.status,"aria-label",()=>translateUI('作用中狀態'));
            this.tabs=el('div','tabs');this.tabButtons={};
            for(const [key,title] of [['settings',()=>translateUI('設定')],['macro',()=>translateUI('巨集')],['layout',()=>translateUI('佈局')]]) {
                const b=button(()=>translateUI(title),()=>this.openTab(key));this.tabButtons[key]=b;this.tabs.append(b);
            }
            this.tools=el('div','tools');this.pages={settings:this.settingsPage(),macro:this.macroPage(),layout:this.layoutPage()};
            this.tools.append(...Object.values(this.pages));
            this.controls=el('div','controls');this.buildControls();
            this.help=el('div','hint',()=>translateUI('右鍵：連發 → 鎖定 → 解除　｜　F2：解除連發／鎖定，否則收合'));
            this.raceHint=el('div','racing-hint',()=>translateUI('左區：轉向／下拉 A　右區：上滑 RT、下滑 LT／右甩：B 進檔、左甩：X 退檔'));
            this.root.append(this.header,this.status,this.tabs,this.tools,this.controls,this.help,this.raceHint);app.shadow.append(this.root);
            app.dragElement(this.drag,this.root,()=>{this.p[this.app.touch?.active?'touchPanelPos':'panelPos']={x:this.root.style.left,y:this.root.style.top};this.config.save();},()=>!(this.p.gameMode==='racing'&&!this.collapsed));
            this.root.style.left=this.p.panelPos?.x||'15px';this.root.style.top=this.p.panelPos?.y||`${Math.max(15,window.innerHeight-280*this.p.uiScale)}px`;
            this.refresh();
        }
        selectSetting(parent,label,key,options,after=()=>{}) {
            const row=el('label','setting');row.append(el('span','',()=>translateUI(label)));const select=el('select');select.dataset.setting=key;
            for(const [value,title] of options) {const o=el('option','',()=>translateUI(title));o.value=String(value);select.append(o);}
            select.value=String(this.p[key]);select.onchange=()=>{
                this.app.pointers.cancelAll();const raw=select.value;
                this.p[key]=typeof this.p[key]==='boolean'?raw==='true':typeof this.p[key]==='number'?Number(raw):raw;
                after();this.config.save();this.refresh();
            };row.append(select);parent.append(row);return select;
        }
        settingsPage() {
            const page=el('div');
            this.languageSelect=this.selectSetting(page,'語言 / Language','language',[['zh-TW','繁體中文'],['en','English']]);
            this.languageSelect.onchange=()=>{const old=this.p.language;this.p.language=this.languageSelect.value;
                if(!this.config.save()){this.p.language=old;this.languageSelect.value=old;return;}
                this.app.setLanguage(this.p.language);};
            this.backgroundSelect=this.selectSetting(page,()=>translateUI('背景繼續播放巨集'),'backgroundMacro',[[false,()=>translateUI('關閉（離開視窗即停止）')],[true,()=>translateUI('開啟（保留巨集播放）')]]);
            this.backgroundSelect.onchange=()=>{const previous=this.p.backgroundMacro;this.p.backgroundMacro=this.backgroundSelect.value==='true';
                if(!this.config.save()){this.p.backgroundMacro=previous;this.backgroundSelect.value=String(previous);return;}
                if(this.app.backgrounded&&!this.p.backgroundMacro)this.app.suspend('disabled');};
            page.append(el('div','hint',()=>translateUI('僅保留已啟動的巨集播放；錄製、手動輸入、連發、鎖定與 AFK 仍停止。背景計時可能被瀏覽器降頻；最小化、休眠或串流暫停時無法保證遊戲收到輸入。')));
            page.append(el('div','hint',()=>translateUI('背景播放會攔截頁面的視窗失焦通知，避免串流端立即停用控制器；頁內輸入框切換不受影響。')));
            this.selectSetting(page,()=>translateUI('連發間隔'),'delay',[100,200,500,1000,2000,3000,5000,10000].map(v=>[v,()=>(String(v/1000)+translateUI(" 秒"))]),()=>this.app.auto.restart());
            this.selectSetting(page,()=>translateUI('雙擊連發／三擊鎖定'),'comboTaps',[[false,()=>translateUI('關閉（防誤觸）')],[true,()=>translateUI('開啟')]]);
            this.selectSetting(page,()=>translateUI('AFK 擺頭幅度'),'afkAmp',[.1,.15,.2,.25,.3,.4,.5].map(v=>[v,`${Math.round(v*100)}%`]));
            this.afkBtn=button(()=>translateUI('啟動 AFK 擺頭'),()=>{if(this.app.manualStart()===false)return null;this.app.racing.afk=!this.app.racing.afk;this.app.racing.tick(this.app.clock());this.refresh();});page.append(this.afkBtn);
            this.selectSetting(page,()=>translateUI('控制面板大小'),'uiScale',[.8,1,1.2,1.5].map(v=>[v,`${Math.round(v*100)}%`]));
            this.selectSetting(page,()=>translateUI('控制面板背景'),'bgTrans',[[false,()=>translateUI('半透明')],[true,()=>translateUI('透明')]]);
            this.selectSetting(page,()=>translateUI('觸控操作時面板淡化'),'touchAutoFade',[[true,()=>translateUI('開啟（25%）')],[false,()=>translateUI('關閉')]]);
            this.selectSetting(page,()=>translateUI('賽車操作時淡化'),'racingAutoFade',[[true,()=>translateUI('開啟（25%）')],[false,()=>translateUI('關閉')]]);
            // 舊 splitMode 欄位保留以讀取備份，介面與渲染已停用。
            this.selectSetting(page,()=>translateUI('極簡展示 HUD'),'showViewer',[[false,()=>translateUI('隱藏（實體操作時自動顯示）')],[true,()=>translateUI('顯示')]]);
            this.selectSetting(page,()=>translateUI('展示 HUD 大小'),'viewerScale',[.6,.8,1,1.2].map(v=>[v,`${Math.round(v*100)}%`]),()=>this.app.viewer?.resize());
            const row=el('div','row');const key=el('select');setLabel(key,"aria-label",()=>translateUI('自動按鍵'));
            LABELS.forEach((label,i)=>{const o=el('option','',()=>translateUI(label));o.value=i;key.append(o);});
            row.append(key,button(()=>translateUI('連發'),()=>this.setMode(Number(key.value),'interval')),button(()=>translateUI('鎖定'),()=>this.setMode(Number(key.value),'hold')),button(()=>translateUI('解除'),()=>this.setMode(Number(key.value),'none')));
            page.append(el('div','hint',()=>translateUI('觸控裝置也可在這裡指定按鍵自動操作。')),row);
            return page;
        }
        macroPage() {
            const page=el('div');const slotsRow=el('div','slots');this.macroSlots=[];
            for(let s=1;s<=6;s++){const b=button(()=>String(s),()=>{this.app.macro.select(s);this.refresh();});this.macroSlots.push(b);slotsRow.append(b);}
            const style=el('style');style.textContent=`
                .macro-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}
                .macro-action{display:flex;align-items:center;justify-content:center;gap:9px;min-height:46px;font-size:13px;padding:8px}
                .macro-action svg{width:24px;height:24px;flex:none;pointer-events:none}
                .macro-action.record svg{color:#ff6868}.macro-action.play svg{color:#57e5a1}.macro-action.loop svg{color:#71baff}.macro-action.stop svg{color:#f4c571}
                .record-source{display:flex;gap:7px;flex-wrap:wrap;margin:6px 0}.record-source button{min-height:38px;flex:1;font-size:12px}
                .record-source-state{overflow-wrap:anywhere;margin-bottom:8px}
            `;page.append(style);
            const sourceRow=el('div','record-source');sourceRow.setAttribute('role','group');setLabel(sourceRow,"aria-label",()=>translateUI('錄製來源'));this.recordSourceButtons={};
            for(const [source,label] of [['virtual',()=>translateUI('虛擬操作')],['physical',()=>translateUI('實體手把')]]){
                const b=button(()=>translateUI(label),()=>{if(this.app.macro.recording)return;const old=this.p.macroRecordSource;this.p.macroRecordSource=source;
                    if(!this.config.save()){this.p.macroRecordSource=old;this.app.notice(translateUI('錄製來源儲存失敗，已恢復原設定。'));}this.refreshStatus();});
                this.recordSourceButtons[source]=b;sourceRow.append(b);
            }
            this.recordSourceState=el('div','meta record-source-state');this.recordSourceState.setAttribute('role','status');
            const action=(kind,label,fn)=>{
                const b=button(()=>'',fn,`macro-action ${kind}`),icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
                icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
                const shapes={record:'<circle cx="12" cy="12" r="8" fill="currentColor"/>',play:'<path d="M6 3L21 12L6 21Z" fill="currentColor"/>',
                    loop:'<path d="M20 10A8 8 0 0 0 6 5M4 14A8 8 0 0 0 18 19M6 1v5h5M18 23v-5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
                    stop:'<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/>'};
                icon.innerHTML=shapes[kind];b.append(icon,el('span','',()=>translateUI(label)));return b;
            };
            const row=el('div','macro-actions');this.recordButton=action('record',translateUI('錄製'),()=>this.app.startRecording());
            this.stopButton=action('stop',translateUI('停止'),()=>{this.app.macro.stop('button');this.refresh();});
            this.playButton=action('play',translateUI('播放'),()=>this.app.playMacro(false));this.loopButton=action('loop',translateUI('循環播放'),()=>this.app.playMacro(true));
            row.append(this.recordButton,this.playButton,this.loopButton,this.stopButton);
            const clearRow=el('div','row');clearRow.append(button(()=>translateUI('清除'),()=>{if(ask(translateUI('清除此巨集槽位？'))){this.app.macro.clear();this.refresh();}},'danger'));
            const nameRow=el('label','setting');nameRow.append(el('span','',()=>translateUI('巨集名稱')));this.macroName=el('input');this.macroName.type='text';this.macroName.maxLength=60;
            this.macroName.onchange=()=>{if(this.macroBusy())return;const macro=this.p.macros[this.app.macro.slot],old=macro.name;macro.name=this.macroName.value.trim();if(!this.config.save()){macro.name=old;setText(this.backupMessage,()=>translateUI('名稱儲存失敗。'));}this.refreshStatus();};nameRow.append(this.macroName);
            this.macroStatus=el('div','meta');this.macroStopReason=el('div','meta');
            this.macroDebug=el('details');this.macroDebug.append(el('summary','meta',()=>translateUI('背景播放診斷')));
            this.macroDebugText=el('pre','backup-message');this.macroDebug.append(this.macroDebugText);
            page.append(slotsRow,nameRow,el('div','meta',()=>translateUI('錄製來源')),sourceRow,this.recordSourceState,row,clearRow,this.macroStatus,this.macroStopReason,this.macroDebug,
                el('div','hint',()=>translateUI('第一次操作才開始計時；按下停止前的等待也會保存。實體錄製只讀取開始時選定的手把，保留按鍵、搖桿與 LT／RT 深度；播放時套用目前映射與曲線。')),this.backupPage());
            return page;
        }
        macroBusy() {return this.app.macro.playing||this.app.macro.recording;}
        backupPage() {
            const box=el('div','backup'),row=el('div','row');
            this.exportOne=button(()=>translateUI('匯出此組'),()=>this.exportMacros(this.app.macro.slot));this.exportAll=button(()=>translateUI('匯出六組'),()=>this.exportMacros());
            this.importBtn=button(()=>translateUI('匯入 JSON'),()=>{if(this.macroBusy())return;this.importFile.value='';this.importFile.click();});
            this.importFile=el('input');this.importFile.type='file';this.importFile.accept='.json,application/json';this.importFile.hidden=true;
            this.importFile.onchange=()=>this.readBackup(this.importFile.files[0]);
            this.backupMessage=el('div','backup-message');this.backupMessage.setAttribute('role','status');
            this.importPreview=el('div','import-preview');this.importPreview.hidden=true;this.importToken=0;
            row.append(this.exportOne,this.exportAll,this.importBtn);box.append(row,this.importFile,this.backupMessage,this.importPreview,el('div','hint',()=>translateUI('備份包含巨集名稱、按鍵、類比深度與等待時間。匯入只更動所選巨集，不會改變佈局或其他設定。')));return box;
        }
        exportMacros(slot=null) {
            try {
                if(this.app.macro.recording)throw Error(translateUI('請先停止錄製，再匯出完整巨集。'));
                const json=MacroBackup.encode(this.config,slot),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
                const a=el('a');a.href=url;a.download=`cloudpad-studio-macros-${slot===null?'all':`slot-${slot}`}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
                this.app.shadow.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
                setText(this.backupMessage,()=>translateUI('已產生 JSON 備份，請確認瀏覽器下載。'));
            }catch(e){setText(this.backupMessage,()=>translateUI(e.message));}
        }
        async readBackup(file) {
            if(!file)return;const token=++this.importToken;this.importPreview.hidden=true;
            try {
                if(this.macroBusy())throw Error(translateUI('請先停止錄製或播放，再匯入。'));
                if(file.size>MacroBackup.MAX_BYTES)throw Error(translateUI('檔案超過 16 MB，請改用單組備份。'));
                const text=await file.text();if(token!==this.importToken||this.app.destroyed)return;
                if(this.macroBusy())throw Error(translateUI('請先停止錄製或播放，再匯入。'));
                this.showImport(MacroBackup.parse(text));setText(this.backupMessage,()=>translateUI('資料檢查完成，尚未寫入。請選擇還原位置。'));
            }catch(e){if(token===this.importToken&&!this.app.destroyed)setText(this.backupMessage,()=>translateUI(e.message));}
        }
        showImport(doc) {
            const preview=this.importPreview;preview.replaceChildren();preview.hidden=false;
            preview.append(el('strong','',()=>translateUI('匯入預覽')));
            for(const m of doc.macros)preview.append(el('div','meta',()=>(String(m.slot)+" · "+String(m.name||translateUI('未命名'))+" · "+String(m.events.length)+translateUI(" 筆 · ")+String((m.duration/1000).toFixed(1))+translateUI(" 秒"))));
            const sourceRow=el('label','setting'),targetRow=el('label','setting');sourceRow.append(el('span','',()=>translateUI('備份來源')));targetRow.append(el('span','',()=>translateUI('寫入槽位')));
            this.importSource=el('select');this.importTarget=el('select');
            setLabel(this.importSource,"aria-label",()=>translateUI('備份來源'));setLabel(this.importTarget,"aria-label",()=>translateUI('寫入槽位'));
            const option=(select,value,label)=>{const o=el('option','',()=>translateUI(label));o.value=value;select.append(o);};
            for(const m of doc.macros)option(this.importSource,m.slot,`${m.slot} · ${m.name||translateUI('未命名')}`);
            if(doc.macros.length===6)option(this.importSource,'all',translateUI('還原全部六組（包含空槽）'));
            for(let s=1;s<=6;s++)option(this.importTarget,s,(translateUI("槽位 ")+String(s)));this.importTarget.value=String(this.app.macro.slot);
            this.importSource.onchange=()=>this.refreshStatus();sourceRow.append(this.importSource);targetRow.append(this.importTarget);
            this.importApply=button(()=>translateUI('確認匯入'),()=>{
                try {
                    if(this.macroBusy())throw Error(translateUI('請先停止錄製或播放，再匯入。'));
                    const source=this.importSource.value,target=Number(this.importTarget.value),plan=MacroBackup.plan(doc,source,target);
                    const destinations=plan.map(entry=>(translateUI("槽位 ")+String(entry.slot)+"（"+String(this.p.macros[entry.slot].name||translateUI('未命名'))+"，"+String(this.p.macros[entry.slot].events.length)+translateUI(" 筆）"))).join('\n');
                    if(!ask((translateUI("匯入將取代以下巨集：\n")+String(destinations)+"\n"+String(source==='all'?translateUI('備份中的空槽也會覆蓋現有資料。\n'):'')+translateUI("確定繼續？"))))return;
                    const count=MacroBackup.commit(this.config,doc,source,target,()=>this.macroBusy());
                    this.importToken++;preview.hidden=true;setText(this.backupMessage,()=>(translateUI("已匯入 ")+String(count)+translateUI(" 組巨集。")));this.refresh();
                }catch(e){setText(this.backupMessage,()=>translateUI(e.message));}
            });
            const actions=el('div','row');actions.append(this.importApply,button(()=>translateUI('取消'),()=>{this.importToken++;preview.hidden=true;setText(this.backupMessage,()=>translateUI('已取消，巨集沒有變更。'));this.refresh();}));
            preview.append(sourceRow,targetRow,actions);this.refresh();
        }
        layoutPage() {
            const page=el('div');const slotRow=el('div','slots');this.layoutSlots=[];
            const styles=el('div','row');styles.setAttribute('role','group');setLabel(styles,"aria-label",()=>translateUI('操作佈局'));this.layoutStyleButtons={};
            for(const [value,label] of [['panel',()=>translateUI('標準面板')],['touch',()=>translateUI('觸控佈局')]]){const b=button(()=>translateUI(label),()=>this.app.changeControlStyle(value));this.layoutStyleButtons[value]=b;styles.append(b);}
            page.append(styles,el('div','hint',()=>translateUI('面板與觸控各自保存六組位置，切換不會覆蓋另一種佈局。賽車維持原本的操作區。')));
            for(let s=1;s<=6;s++){const b=button(()=>String(s),()=>{this.app.pointers.cancelAll();this.p.layoutSlot=s;this.app.layout.apply();this.config.save();this.refresh();});this.layoutSlots.push(b);slotRow.append(b);}
            this.editBtn=button(()=>translateUI('開始編輯'),()=>{
                if(this.p.gameMode==='racing'){this.app.notice(translateUI('賽車模式不支援佈局編輯，請先切回標準模式。'));return;}
                this.app.stopAll();this.app.layout.editing=!this.app.layout.editing;this.refresh();
            });
            this.groupBtn=button(()=>translateUI('群組移動'),()=>{this.app.layout.group=!this.app.layout.group;this.refresh();});
            this.snapBtn=button(()=>translateUI('磁吸 10px'),()=>{this.app.layout.snap=!this.app.layout.snap;this.refresh();});
            const row=el('div','row');row.append(this.editBtn,this.groupBtn,this.snapBtn,button(()=>translateUI('還原此組'),()=>{
                if(ask(translateUI('還原目前槽位的佈局？其他槽位不受影響。'))){this.app.pointers.cancelAll();this.app.layout.reset();}
            },'danger'));
            page.append(slotRow,row,el('div','hint',()=>translateUI('編輯時拖曳按鍵／搖桿；拖曳只改位置，不送出遊戲輸入。舊版儲存的位移會沿用於新介面的對應控制元件。')));
            return page;
        }
        openTab(tab) {if(this.app.layout.editing&&tab!=='layout'){this.app.pointers.cancelAll();this.app.layout.editing=false;}
            this.tab=tab;if(tab)this.collapsed=false;this.refresh();
            if(tab==='diagnostics'){this.app.override=false;this.app.updateVisibility();}}
        setMode(id,mode) {if(this.app.manualStart()===false)return null;this.app.auto.set(id,mode);this.refresh();}
        createKey(id,width=44,height=32) {
            const node=el('button','padkey',()=>LABELS[id]);node.type='button';node.dataset.id=id;node.dataset.mode='none';
            node.style.width=`${width}px`;node.style.height=`${height}px`;setLabel(node,'title',()=>(String(LABELS[id])+translateUI("：右鍵切換連發／鎖定")));
            this.app.layout.register(String(id),node);this.buttons.push({id,node});
            this.app.pointers.bind(node,e=>{
                if(this.app.layout.editing) return this.app.layout.drag(String(id),e,this.app.touch?.active?this.app.touch.scale:this.effectiveScale);
                if(this.app.manualStart()===false)return null;const source=`manual:${e.pointerId}`;this.app.input.set(source,'btn',id,1);
                const combo=this.p.comboTaps&&this.p.gameMode==='standard';let taps=this.tapStates.get(id);
                if(!taps){taps={count:0,last:-Infinity,due:null};this.tapStates.set(id,taps);}
                if(combo){const now=this.app.clock();taps.count=now-taps.last<300?taps.count+1:1;taps.last=now;taps.due=null;}
                return {end:(_,cancelled)=>{
                    this.app.input.clear(source);
                    if(cancelled){taps.count=0;taps.due=null;}
                    else if(combo&&taps.count>1)taps.due=this.app.clock()+180;
                }};
            });
            node.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();
                if(!this.app.layout.editing&&this.p.gameMode==='standard'){
                    this.tapStates.delete(id);
                    this.setMode(id,{none:'interval',interval:'hold',hold:'none'}[this.app.auto.mode(id)]);
                }});
            return node;
        }
        createStick(axis) {
            const wrapper=el('div',`stickwrap ${axis===0?'left':'right'}`);const base=el('div','stick');const knob=el('div','knob',()=>axis===0?'LS':'RS');
            setLabel(base,"aria-label",()=>axis===0?translateUI('左搖桿'):translateUI('右搖桿'));base.dataset.axis=axis;base.append(knob);
            this.app.layout.register(`stick_${axis}`,base);this.sticks.push({axis,node:base,knob});
            let active=false;
            this.app.pointers.bind(base,e=>{
                if(this.app.layout.editing)return this.app.layout.drag(`stick_${axis}`,e,this.app.touch?.active?this.app.touch.scale:this.effectiveScale);
                if(active)return null;if(this.app.manualStart()===false)return null;active=true;const source=`manual:${e.pointerId}`;
                const rect=base.getBoundingClientRect();const scale=rect.width/base.offsetWidth;
                const radius=(base.clientWidth-knob.offsetWidth)/2*scale;
                const move=ev=>{if(this.app.manualStart()===false)return null;let x=(ev.clientX-rect.left-rect.width/2)/radius,y=(ev.clientY-rect.top-rect.height/2)/radius;
                    const d=Math.max(1,Math.hypot(x,y));this.app.input.set(source,'axis',axis,x/d);this.app.input.set(source,'axis',axis+1,y/d);};
                move(e);return {move,end:()=>{active=false;this.app.input.clear(source);}};
            });
            wrapper.append(base,this.createKey(axis===0?10:11,25,25));return wrapper;
        }
        cross(face=false) {
            const grid=el('div',face?'cross face':'cross');
            for(const [id,col,row] of (face?[[3,2,1],[2,1,2],[1,3,2],[0,2,3]]:[[12,2,1],[14,1,2],[15,3,2],[13,2,3]])) {
                const key=this.createKey(id,32,32);key.style.width='';key.style.height='';key.style.gridColumn=col;key.style.gridRow=row;grid.append(key);
            }return grid;
        }
        buildControls() {
            const top=el('div','topkeys');const left=el('div','cluster'),center=el('div','cluster'),right=el('div','cluster');
            left.append(this.createKey(6),this.createKey(4));center.append(this.createKey(8,52),this.createKey(16,32),this.createKey(9,52));
            right.append(this.createKey(5),this.createKey(7));top.append(left,center,right);
            const row=el('div','playrow');const l=el('div','zone'),r=el('div','zone');
            l.append(this.createStick(0),this.cross());r.append(this.cross(true),this.createStick(2));row.append(l,r);
            this.controls.append(top,row);
        }
        tick(now,state) {
            this.refreshRecordingControls();
            for(const [id,t] of this.tapStates)if(t.due!==null&&now>=t.due){t.due=null;
                if(this.p.comboTaps&&this.p.gameMode==='standard'&&!this.app.layout.editing){const mode=t.count===2?'interval':'hold';this.setMode(id,this.app.auto.mode(id)===mode?'none':mode);}t.count=0;}
            for(const {id,node} of this.buttons){node.classList.toggle('active',state.buttons[id]>0.05);
                node.dataset.mode=this.app.auto.mode(id);if(id===6||id===7){node.classList.add('trigger');node.style.setProperty('--depth',`${Math.round(state.buttons[id]*100)}%`);}}
            for(const {axis,node,knob} of this.sticks){const radius=(node.clientWidth-knob.offsetWidth)/2;
                styleValue(knob,'transform',`translate(${state.axes[axis]*radius}px,${state.axes[axis+1]*radius}px)`);
                node.classList.toggle('active',Math.hypot(state.axes[axis],state.axes[axis+1])>0.15);}
            const m=this.app.macro;
            const msg=m.recording?(m.started===null?translateUI('錄製已準備 · 等待第一次操作…'):(translateUI("錄製中 · ")+String(m.recordSource==='physical'?translateUI('實體手把'):translateUI('虛擬操作'))+" · "+String(((now-m.started)/1000).toFixed(1))+translateUI(" 秒"))):m.playing?(String(m.loop?translateUI('循環播放'):translateUI('播放中'))+translateUI(" · 槽位 ")+String(m.slot)):
                (translateUI("槽位 ")+String(m.slot)+"："+String(this.p.macros[m.slot].events.length)+translateUI(" 筆 / ")+String((this.p.macros[m.slot].duration/1000).toFixed(1))+translateUI(" 秒"));
            if(this.macroStatus.textContent!==msg)setText(this.macroStatus,()=>msg);
            const last=m.lastStop;
            setText(this.macroStopReason,()=>translateUI('背景播放：')+translateUI(this.p.backgroundMacro?'開啟':'關閉')+' · '+translateUI('最後停止原因：')+(last?stopLabel(last.reason)+' · '+new Date(last.at).toLocaleTimeString():translateUI('尚無停止紀錄')));
            if(this.macroDebug.open)setText(this.macroDebugText,()=>JSON.stringify({version:VERSION,backgroundOption:this.p.backgroundMacro,
                playing:m.playing,loop:m.loop,backgrounded:!!this.app.backgrounded,hasFocus:document.hasFocus(),hidden:document.hidden,
                ignoredLateInput:this.app.ignoredBackgroundInput||0,focusGuards:this.app.focusGuardCount||0,timerActive:this.app.backgroundTimer!=null,
                lastStop:m.lastStop||null},null,2));
            const sig=JSON.stringify([...this.app.auto.modes].map(([id,v])=>[id,v.mode]))+this.app.racing.afk+m.playing+m.recording+m.slot+this.app.backgrounded;
            if(sig!==this.statusSignature){this.statusSignature=sig;this.refreshStatus();}
        }
        refreshStatus() {
            this.status.replaceChildren();for(const [id,m] of this.app.auto.modes)this.status.append(button(()=>`${LABELS[id]} ${m.mode==='hold'?translateUI('鎖定'):translateUI('連發')} ×`,()=>this.setMode(id,'none')));
            if(this.app.racing.afk)this.status.append(button(()=>'AFK ×',()=>{this.app.racing.stop();this.refresh();}));
            const m=this.app.macro;if(m.playing||m.recording)this.status.append(button(()=>(translateUI("巨集 ")+String(m.slot)+" "+String(m.recording?translateUI('錄製'):this.app.backgrounded?translateUI('背景播放中'):translateUI('播放'))+" ■"),()=>{m.stop('button');this.refresh();}));
            this.refreshRecordingControls();
            this.macroSlots.forEach((b,i)=>{const data=this.p.macros[i+1];b.classList.toggle('on',m.slot===i+1);setText(b,()=>`${i+1}${data.events.length?' •':''}${data.name?' '+data.name:''}`);setLabel(b,'title',()=>data.name||(translateUI("槽位 ")+String(i+1)));});
            this.macroName.disabled=this.importBtn.disabled=!!this.macroBusy();
            this.exportOne.disabled=this.exportAll.disabled=!!m.recording;
            if(this.app.shadow.activeElement!==this.macroName||this.macroName.dataset.slot!==String(m.slot)){this.macroName.value=this.p.macros[m.slot].name||'';this.macroName.dataset.slot=String(m.slot);}
            if(this.importApply){this.importApply.disabled=this.importSource.disabled=!!this.macroBusy();this.importTarget.disabled=this.macroBusy()||this.importSource.value==='all';}
            this.afkBtn.classList.toggle('on',this.app.racing.afk);setText(this.afkBtn,()=>this.app.racing.afk?translateUI('停止 AFK 擺頭'):translateUI('啟動 AFK 擺頭'));
        }
        refreshRecordingControls() {
            const m=this.app.macro,physical=this.p.macroRecordSource==='physical',monitor=this.app.physical;
            for(const [source,b] of Object.entries(this.recordSourceButtons)){b.disabled=m.recording;b.classList.toggle('on',source===this.p.macroRecordSource);b.setAttribute('aria-pressed',String(source===this.p.macroRecordSource));}
            this.recordButton.disabled=m.recording||this.app.layout.editing||(physical&&!monitor.connected);
            this.playButton.disabled=this.loopButton.disabled=m.recording;this.stopButton.disabled=!m.recording&&!m.playing;
            setText(this.recordSourceState,()=>m.recording?(translateUI("錄製中 · ")+String(m.recordSource==='physical'?translateUI('實體手把（來源已固定）'):translateUI('虛擬操作'))):
                physical?(monitor.connected?(translateUI("已連接：")+String(monitor.id)):translateUI('未連接實體手把 · 請連接並按一下手把按鍵')):translateUI('目前來源：畫面上的虛擬操作'));
        }
        refresh() {
            this.app.touch?.sync();
            this.root.classList.toggle('collapsed',this.collapsed);this.helpBtn.classList.add('help-toggle');this.root.classList.toggle('help-off',!this.p.showHelp);this.app.racingView?.area.classList.toggle('help-off',!this.p.showHelp);
            this.helpBtn.classList.toggle('on',this.p.showHelp);this.helpBtn.setAttribute('aria-pressed',String(this.p.showHelp));setLabel(this.helpBtn,'title',()=>this.p.showHelp?translateUI('隱藏操作說明'):translateUI('顯示操作說明'));
            this.macroQuick.classList.toggle('on',this.tab==='macro'&&!this.collapsed);this.macroQuick.setAttribute('aria-expanded',String(this.tab==='macro'&&!this.collapsed));
            this.toolBtn.classList.toggle('on',this.tab==='settings'&&!this.collapsed);this.toolBtn.setAttribute('aria-expanded',String(this.tab==='settings'&&!this.collapsed));
            const racing=this.p.gameMode==='racing';this.root.classList.toggle('compact',racing);
            const touch=this.p.controlStyle==='touch'||racing;
            this.root.classList.toggle('touch-mode',touch);
            setText(this.styleQuick,()=>touch?translateUI('觸控'):translateUI('面板'));this.styleQuick.disabled=racing;this.styleQuick.setAttribute('aria-pressed',String(touch));
            for(const [style,b] of Object.entries(this.layoutStyleButtons)){b.disabled=racing;b.classList.toggle('on',this.p.controlStyle===style);b.setAttribute('aria-pressed',String(this.p.controlStyle===style));}
            this.root.classList.toggle('transparent',this.p.bgTrans);this.root.classList.toggle('editing',this.app.layout.editing);
            const width=this.collapsed?300:touch&&!this.tab?400:550;
            this.effectiveScale=Math.min(this.p.uiScale,(window.innerWidth-16)/width);
            this.root.classList.toggle('compact-toolbar',!this.collapsed&&width*this.effectiveScale<480);
            this.root.style.transform=`scale(${this.effectiveScale})`;
            this.root.style.width=`${width}px`;
            if(racing){this.root.style.left=`${Math.max(8,(window.innerWidth-width*this.effectiveScale)/2)}px`;this.root.style.top=window.innerWidth<700?'66px':'15px';}
            setText(this.modeBtn,()=>racing?translateUI('賽車'):translateUI('標準'));setText(this.collapseBtn,()=>this.collapsed?translateUI('展開'):translateUI('收合'));
            this.controls.hidden=this.collapsed||touch;this.help.hidden=this.collapsed;this.raceHint.hidden=this.collapsed||!racing;
            this.tabs.hidden=this.tools.hidden=this.collapsed||!this.tab;
            for(const [key,page] of Object.entries(this.pages)){page.hidden=key!==this.tab;this.tabButtons[key].classList.toggle('on',key===this.tab);}
            this.layoutSlots.forEach((b,i)=>{b.classList.toggle('on',this.p.layoutSlot===i+1);setText(b,()=>`${i+1}${this.p.layoutNames[i+1]?' '+this.p.layoutNames[i+1]:''}`);setLabel(b,'title',()=>this.p.layoutNames[i+1]||(translateUI("佈局 ")+String(i+1)));});
            setText(this.editBtn,()=>this.app.layout.editing?translateUI('完成編輯'):translateUI('開始編輯'));this.editBtn.classList.toggle('on',this.app.layout.editing);
            setText(this.groupBtn,()=>this.app.layout.group?translateUI('群組移動'):translateUI('單顆移動'));setText(this.snapBtn,()=>this.app.layout.snap?translateUI('磁吸 10px'):translateUI('自由移動'));
            this.groupBtn.classList.toggle('on',this.app.layout.group);this.snapBtn.classList.toggle('on',this.app.layout.snap);
            for(const select of this.root.querySelectorAll('[data-setting]'))select.value=String(this.p[select.dataset.setting]);
            this.refreshStatus();
            if(!this.tools.hidden){
                const otherHeight=this.root.offsetHeight-this.tools.offsetHeight;
                const available=touch?Math.max(100,window.innerHeight-(this.app.touch?.renderedHeight||0)-44):window.innerHeight-16;
                this.tools.style.maxHeight=`${Math.max(touch?30:60,available/this.effectiveScale-otherHeight)}px`;
            }
            this.app.clampElement(this.root);this.app.touch?.positionUtility();
        }
        cancelTaps() {this.tapStates.clear();}
    }

    class ViewerHUD {
        constructor(app) {
            this.app=app;this.p=app.config.prefs;this.root=el('aside','viewer');setLabel(this.root,"aria-label",()=>translateUI('展示 HUD'));
            this.root.style.left=this.p.viewerPos.x;this.root.style.top=this.p.viewerPos.y;this.keys=new Map();
            const head=el('div','head');head.append(el('span','',()=>translateUI(APP_NAME)));this.sourceLabel=el('span','',()=>'VIRTUAL');head.append(this.sourceLabel);
            const meters=el('div','triggers');this.meters=[];
            for(const [id,label] of [[6,'LT'],[7,'RT']]){const meter=el('div',id===7?'meter mirror':'meter');const labels=el('div','meterlabel');
                const percent=el('span','',()=>'0%');labels.append(el('span','',()=>translateUI(label)),percent);const track=el('div','track'),fill=el('div','fill');track.append(fill);meter.append(labels,track);meters.append(meter);this.meters.push({id,fill,percent});}
            const row=el('div','viewerkeys');for(const id of [4,8,16,9,5])row.append(this.key(id));
            const bottom=el('div','vbottom');this.sticks=[];
            const stick=axis=>{const base=el('div','vstick'),dot=el('div','vdot',()=>axis===0?'LS':'RS');base.append(dot);this.sticks.push({axis,dot});return base;};
            const cross=face=>{const c=el('div',face?'vcross vface':'vcross');for(const [id,x,y] of(face?[[3,2,1],[2,1,2],[1,3,2],[0,2,3]]:[[12,2,1],[14,1,2],[15,3,2],[13,2,3]])){
                const k=this.key(id);k.style.gridColumn=x;k.style.gridRow=y;c.append(k);}return c;};
            bottom.append(stick(0),cross(false),cross(true),stick(2));
            const foot=el('div','viewerfoot');this.sizeBtn=button(()=>'',e=>app.popup(e,[.6,.8,1,1.2].map(v=>[v,`${Math.round(v*100)}%`]),this.p.viewerScale,v=>{
                this.p.viewerScale=v;this.resize();app.panel.refresh();app.config.save();}));
            setLabel(this.sizeBtn,'title',()=>translateUI('調整展示大小'));foot.append(this.sizeBtn);this.root.append(head,meters,row,bottom,foot);app.shadow.append(this.root);
            app.dragElement(this.root,this.root,()=>{this.p.viewerPos={x:this.root.style.left,y:this.root.style.top};app.config.save();});this.resize();
        }
        key(id) {const k=el('span','vkey',()=>LABELS[id]);k.dataset.id=id;this.keys.set(id,k);return k;}
        resize() {this.root.style.transform=`scale(${this.p.viewerScale})`;setText(this.sizeBtn,()=>`${Math.round(this.p.viewerScale*100)}%`);this.app.clampElement(this.root);}
        render(state,physical) {
            setText(this.sourceLabel,()=>physical?'PHYSICAL':'VIRTUAL');
            for(const {id,fill,percent} of this.meters){const v=clamp(state.buttons[id],0,1);styleValue(fill,'transform',`scaleX(${v})`);const t=`${Math.round(v*100)}%`;if(percent.textContent!==t)setText(percent,()=>t);}
            for(const [id,k] of this.keys)k.classList.toggle('active',state.buttons[id]>0.05);
            for(const {axis,dot} of this.sticks){styleValue(dot,'transform',`translate(${state.axes[axis]*10}px,${state.axes[axis+1]*10}px)`);dot.classList.toggle('active',state.buttons[axis===0?10:11]>0.05);}
        }
    }

    class RacingRenderer {
        constructor(app) {
            this.app=app;this.area=el('div','racearea');this.area.hidden=true;this.area.classList.toggle('help-off',!app.config.prefs.showHelp);
            for(const side of ['left','right']){const zone=el('div','racezone');zone.dataset.side=side;
                zone.append(el('span','',()=>side==='left'?translateUI('轉向 · 下拉 A'):translateUI('RT ↑ · LT ↓ · 左甩 X 退檔 · 右甩 B 進檔')));app.pointers.bind(zone,e=>app.racing.start(side,e));this.area.append(zone);}
            this.canvas=el('canvas');this.ctx=this.canvas.getContext('2d');app.shadow.append(this.area,this.canvas);this.resize();
        }
        resize() {this.dpr=window.devicePixelRatio||1;this.canvas.width=window.innerWidth*this.dpr;this.canvas.height=window.innerHeight*this.dpr;
            this.canvas.style.width=`${window.innerWidth}px`;this.canvas.style.height=`${window.innerHeight}px`;}
        render() {
            const c=this.ctx;if(!c)return;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,window.innerWidth,window.innerHeight);
            const l=this.app.racing.left,r=this.app.racing.right;
            if(l){c.lineWidth=2;c.strokeStyle=l.pressed?'#74efb4':'#82bfff';c.beginPath();c.arc(l.x,l.y,55,0,Math.PI*2);c.stroke();c.fillStyle=c.strokeStyle;c.beginPath();c.arc(l.x+l.dx,l.y,14,0,Math.PI*2);c.fill();}
            if(r){c.fillStyle='#ffffff44';c.fillRect(r.x-2,r.y-70,4,140);c.fillStyle=r.dy<0?'#74efb4':'#ff8585';c.fillRect(r.x-3,Math.min(r.y,r.y+r.dy),6,Math.abs(r.dy));c.beginPath();c.arc(r.x,r.y+r.dy,12,0,Math.PI*2);c.fill();}
        }
    }

    class AdvancedTools {
        constructor(app) {
            this.app=app;this.panel=app.panel;this.p=app.config.prefs;this.urls=new Set();this.fileToken=0;this.lastTick=0;
            const style=el('style');style.textContent=`
            .v15-card{margin-top:10px;padding:9px;border:1px solid var(--line);border-radius:10px;font-size:11px}.v15-card h3{font-size:12px;margin:0 0 8px;color:var(--green)}
            .v15-card input,.v15-card textarea{background:#182634;color:inherit;border:1px solid var(--line);border-radius:5px;padding:5px;font:inherit;user-select:text}
            .v15-card input[type=number]{width:80px}.v15-card input[type=checkbox]{width:auto}.v15-card select{max-width:180px}
            .v15-table{width:100%;border-collapse:collapse;font-size:10px}.v15-table th,.v15-table td{text-align:left;padding:4px;border-bottom:1px solid var(--line)}.v15-table input[type=number]{width:65px}.v15-table select{max-width:80px;padding:4px}
            .v15-scroll{overflow:auto;max-height:260px}.v15-message{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;margin:6px 0}.v15-message:empty{display:none}
            .quickbar{position:fixed;right:8px;top:35%;z-index:6;pointer-events:auto;background:#111c29e8;border:1px solid var(--line);border-radius:12px;padding:6px;max-width:155px;max-height:65vh;overflow:auto}
            .quickbar button{display:block;width:100%;margin:3px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v15-diagnostics{white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.6 monospace;user-select:text}
            `;app.shadow.append(style);
            this.addPage('input',()=>translateUI('輸入'),this.inputPage());this.addPage('shortcuts',()=>translateUI('快捷／保護'),this.shortcutPage());this.addPage('backup',()=>translateUI('備份'),this.backupPage());this.addPage('diagnostics',()=>translateUI('診斷'),this.diagnosticPage());
            this.panel.pages.macro.append(this.editorPage());this.panel.pages.layout.append(this.layoutPage());
            this.touchSettings=this.touchSettingsPage();this.panel.pages.layout.append(this.touchSettings);
            this.quickbar=el('aside','quickbar');setLabel(this.quickbar,"aria-label",()=>translateUI('巨集快捷列'));
            this.quickToggle=button(()=>translateUI('巨集 ▸'),()=>{this.p.quickbarCollapsed=!this.p.quickbarCollapsed;app.config.save();this.syncQuickbar();});this.quickItems=el('div');this.quickButtons=[];
            for(let s=1;s<=6;s++){const b=button(()=>`${s}`,()=>app.playMacro(false,s));this.quickButtons.push(b);this.quickItems.append(b);}
            this.quickItems.append(button(()=>translateUI('■ 全停'),()=>app.stopAll(),'danger'));this.quickbar.append(this.quickToggle,this.quickItems);app.shadow.append(this.quickbar);
            app.signal.addEventListener('abort',()=>{this.fileToken++;for(const url of this.urls)URL.revokeObjectURL(url);this.urls.clear();},{once:true});
            this.panel.refresh();this.syncQuickbar();
        }
        addPage(key,label,page) {const b=button(()=>translateUI(label),()=>this.panel.openTab(key));this.panel.tabButtons[key]=b;this.panel.tabs.append(b);this.panel.pages[key]=page;this.panel.tools.append(page);}
        card(title,parent) {const c=el('section','v15-card');c.append(el('h3','',()=>translateUI(title)));parent?.append(c);return c;}
        message(parent) {const n=el('div','v15-message');n.setAttribute('role','status');parent.append(n);return n;}
        busy() {return this.app.macro.playing||this.app.macro.recording;}
        requireIdle() {if(this.busy()||this.app.layout.editing)throw Error(translateUI('請先停止巨集並完成佈局編輯，再進行此操作。'));}
        attempt(message,fn) {try{if(fn()===false){setText(message,()=>translateUI('已取消。'));return false;}setText(message,()=>translateUI('已儲存。'));this.panel.refresh();this.syncQuickbar();return true;}catch(e){setText(message,()=>translateUI(e.message));return false;}}
        saveChange(fn) {
            const old=clone(this.p);this.app.stopAll();
            try{fn();if(!this.app.config.save())throw Error(translateUI('儲存失敗，已恢復原設定。'));}
            catch(e){Object.assign(this.p,old);throw e;}
        }
        select(parent,label,values,current,onChange) {
            const row=el('label','setting');row.append(el('span','',()=>translateUI(label)));const s=el('select');setLabel(s,"aria-label",()=>translateUI(label));
            values.forEach(([value,title])=>{const o=el('option','',()=>translateUI(title));o.value=String(value);s.append(o);});s.value=String(current);
            let previous=s.value;s.onchange=()=>{if(onChange(s.value)===false)s.value=previous;else previous=s.value;};row.append(s);parent.append(row);return s;
        }
        number(parent,label,value,min,max,step,onChange) {
            const row=el('label','setting');row.append(el('span','',()=>translateUI(label)));const n=el('input');n.type='number';n.required=true;n.value=String(value);n.min=min;n.max=max;n.step=step;setLabel(n,"aria-label",()=>translateUI(label));
            let previous=n.value;n.onchange=()=>{if(n.value===''||!n.checkValidity()){this.app.notice((String(translateUI(label))+translateUI("：請輸入 ")+String(min)+"～"+String(max)+translateUI(" 的有效數值。")));return;}if(onChange(Number(n.value))===false)n.value=previous;else previous=n.value;};row.append(n);parent.append(row);return n;
        }
        check(parent,label,value,onChange) {const row=el('label','setting'),n=el('input');n.type='checkbox';n.checked=value;setLabel(n,"aria-label",()=>translateUI(label));let previous=n.checked;n.onchange=()=>{if(onChange(n.checked)===false)n.checked=previous;else previous=n.checked;};row.append(el('span','',()=>translateUI(label)),n);parent.append(row);return n;}
        inputPage() {
            const page=el('div');this.tuningSide=0;const c=this.card(()=>translateUI('搖桿曲線與死區'),page);this.tuningBody=el('div');this.tuningMessage=this.message(c);
            this.select(c,()=>translateUI('調整搖桿'),[[0,()=>translateUI('LS 左搖桿')],[1,()=>translateUI('RS 右搖桿')]],0,v=>{this.tuningSide=Number(v);this.renderTuning();});c.append(this.tuningBody);this.renderTuning();
            const map=this.card(()=>translateUI('按鍵重新映射'),page);this.mappingMessage=this.message(map);
            this.check(map,()=>translateUI('實體手把也套用映射與曲線'),this.p.physicalMapping,on=>this.attempt(this.mappingMessage,()=>this.saveChange(()=>this.p.physicalMapping=on)));
            map.append(el('div','hint',()=>translateUI('預設只改虛擬輸出。錄製保存原始動作，播放時才套用目前設定。實體映射直接修改回傳資料，不額外建立第二份手把輸入。')));
            const rows=el('div','v15-scroll');this.mapSelects=[];
            LABELS.forEach((name,id)=>this.mapSelects.push(this.select(rows,()=>`${name} →`,LABELS.map((title,value)=>[value,title]),this.p.buttonMap[id],v=>this.attempt(this.mappingMessage,()=>this.saveChange(()=>this.p.buttonMap[id]=Number(v))))));
            map.append(rows,button(()=>translateUI('還原按鍵映射'),()=>this.attempt(this.mappingMessage,()=>{this.requireIdle();this.saveChange(()=>this.p.buttonMap=LABELS.map((_,i)=>i));this.mapSelects.forEach((s,i)=>s.value=i);})));return page;
        }
        renderTuning() {
            const body=this.tuningBody;body.replaceChildren();const t=this.p.axisTuning[this.tuningSide];
            const presets={standard:{deadzone:0,sensitivity:1,max:1,curve:'linear'},aim:{deadzone:.08,sensitivity:.8,max:1,curve:'soft'},racing:{deadzone:.04,sensitivity:1,max:1,curve:'soft'},fast:{deadzone:.08,sensitivity:1.2,max:1,curve:'fast'}};
            this.select(body,()=>translateUI('常用預設'),[['custom',()=>translateUI('手動調整')],['standard',()=>translateUI('標準（相容舊版）')],['aim',()=>translateUI('細膩瞄準')],['racing',()=>translateUI('柔和轉向')],['fast',()=>translateUI('快速反應')]],'custom',v=>{if(v==='custom')return;this.attempt(this.tuningMessage,()=>this.saveChange(()=>Object.assign(this.p.axisTuning[this.tuningSide],presets[v])));this.renderTuning();});
            const change=(key,value)=>this.attempt(this.tuningMessage,()=>this.saveChange(()=>this.p.axisTuning[this.tuningSide][key]=value));
            this.number(body,()=>translateUI('死區（0～0.45）'),t.deadzone,0,.45,.01,v=>change('deadzone',v));this.number(body,()=>translateUI('靈敏度（0.2～3）'),t.sensitivity,.2,3,.05,v=>change('sensitivity',v));this.number(body,()=>translateUI('最大輸出（0.1～1）'),t.max,.1,1,.05,v=>change('max',v));
            this.select(body,()=>translateUI('曲線'),[['linear',()=>translateUI('線性')],['soft',()=>translateUI('柔和')],['fast',()=>translateUI('快速')]],t.curve,v=>change('curve',v));this.check(body,()=>translateUI('反轉 X 軸'),t.invertX,v=>change('invertX',v));this.check(body,()=>translateUI('反轉 Y 軸'),t.invertY,v=>change('invertY',v));
            body.append(el('div','hint',()=>translateUI('死區使用圓形計算，預設參數保留舊版操作感。修改輸入設定時會停止目前自動操作。')));
        }
        shortcutPage() {
            const page=el('div'),c=this.card(()=>translateUI('巨集快捷啟動'),page);this.shortcutMessage=this.message(c);
            const toggle=(key,on)=>this.attempt(this.shortcutMessage,()=>this.saveChange(()=>this.p[key]=on));
            this.check(c,()=>translateUI('鍵盤巨集快捷鍵'),this.p.keyboardMacros,v=>toggle('keyboardMacros',v));this.check(c,()=>translateUI('手把組合鍵巨集'),this.p.comboMacros,v=>toggle('comboMacros',v));this.check(c,()=>translateUI('顯示側邊巨集快捷列'),this.p.showQuickbar,v=>toggle('showQuickbar',v));
            c.append(el('div','hint',()=>translateUI('鍵盤與組合鍵預設關閉。組合鍵不會吃掉原遊戲輸入；有衝突時請關閉。按住只啟動一次，放開後才能再觸發；輸入文字時不啟動鍵盤巨集。')));
            const keyValues=[...Array.from({length:10},(_,i)=>`F${i+3}`),...Array.from({length:26},(_,i)=>`Key${String.fromCharCode(65+i)}`),...Array.from({length:10},(_,i)=>`Digit${i}`)].map(v=>[v,v]);
            for(let i=0;i<6;i++){
                const group=this.card(()=>(translateUI("巨集 ")+String(i+1)),c);this.select(group,()=>(translateUI("巨集 ")+String(i+1)+translateUI(" 鍵盤")),keyValues,this.p.macroKeys[i],v=>this.attempt(this.shortcutMessage,()=>{
                    if(this.p.macroKeys.some((k,j)=>j!==i&&k===v)||v===this.p.emergencyKey)throw Error(translateUI('快捷鍵不能重複或與急停相同。'));this.saveChange(()=>this.p.macroKeys[i]=v);
                }));
                for(let j=0;j<2;j++)this.select(group,()=>(translateUI("巨集 ")+String(i+1)+translateUI(" 組合鍵 ")+String(j+1)),LABELS.map((v,k)=>[k,v]),this.p.macroCombos[i][j],v=>this.attempt(this.shortcutMessage,()=>{
                    const combo=[...this.p.macroCombos[i]];combo[j]=Number(v);if(combo[0]===combo[1])throw Error(translateUI('組合键需選兩個不同按鍵。'));
                    if(this.p.macroCombos.some((k,n)=>n!==i&&[...k].sort().join() === [...combo].sort().join()))throw Error(translateUI('組合鍵已用於其他巨集。'));
                    if(combo.includes(10)&&combo.includes(11))throw Error(translateUI('L3＋R3 保留給面板快捷操作。'));this.saveChange(()=>this.p.macroCombos[i]=combo);
                }));
            }
            const safety=this.card(()=>translateUI('急停與輸入保護'),page);this.check(safety,()=>translateUI('啟用急停快捷鍵'),this.p.emergencyEnabled,v=>toggle('emergencyEnabled',v));
            this.select(safety,()=>translateUI('急停鍵'),keyValues,this.p.emergencyKey,v=>this.attempt(this.shortcutMessage,()=>{if(this.p.macroKeys.includes(v))throw Error(translateUI('急停不可與巨集快捷鍵相同。'));this.saveChange(()=>this.p.emergencyKey=v);}));
            this.number(safety,()=>translateUI('手動長按上限（秒，0＝關閉）'),this.p.holdTimeout,0,600,1,v=>this.attempt(this.shortcutMessage,()=>this.saveChange(()=>this.p.holdTimeout=v)));
            this.number(safety,()=>translateUI('巨集播放上限（秒，0＝關閉）'),this.p.playbackLimit,0,3600,1,v=>this.attempt(this.shortcutMessage,()=>this.saveChange(()=>this.p.playbackLimit=v)));
            safety.append(el('div','hint',()=>translateUI('長按保護只限制手動觸控按鍵／油門，不限制刻意鎖定或連發。失焦或隱藏分頁時依「背景繼續播放巨集」設定處理；離線或離開頁面時全停。全螢幕切換會取消觸控操作。')));return page;
        }
        editorPage() {
            const c=this.card(()=>translateUI('巨集時間軸編輯器'));this.editorMessage=this.message(c);
            c.append(button(()=>translateUI('開啟目前槽位草稿'),()=>{try{this.requireIdle();if(this.draft&&!ask(translateUI('捨棄目前草稿並重新載入？')))return;this.editSlot=this.app.macro.slot;this.draft=clone(this.p.macros[this.editSlot]);this.editPage=0;this.renderEditor();setText(this.editorMessage,()=>(translateUI("正在編輯槽位 ")+String(this.editSlot)+translateUI("，尚未取代原巨集。")));}catch(e){setText(this.editorMessage,()=>translateUI(e.message));}}));
            this.editorBody=el('div');c.append(this.editorBody);
            this.speedSelect=this.select(c,()=>translateUI('播放速度'),[[.25,'0.25×'],[.5,'0.5×'],[.75,'0.75×'],[1,'1×'],[1.5,'1.5×'],[2,'2×'],[3,'3×']],this.p.macroSpeed,v=>this.attempt(this.editorMessage,()=>this.saveChange(()=>this.p.macroSpeed=Number(v))));return c;
        }
        renderEditor() {
            const body=this.editorBody;body.replaceChildren();if(!this.draft)return;
            const d=this.draft,info=el('div','meta',()=>(translateUI("草稿：槽位 ")+String(this.editSlot)+" · "+String(d.events.length)+translateUI(" 筆")));body.append(info);
            const name=el('input');name.type='text';name.maxLength=60;name.value=d.name;setLabel(name,"aria-label",()=>translateUI('草稿名稱'));name.onchange=()=>d.name=name.value.trim();body.append(name);
            this.number(body,()=>translateUI('總長度（秒，包含結尾等待）'),d.duration/1000,0,86400,.001,v=>d.duration=v*1000);
            const scroll=el('div','v15-scroll'),table=el('table','v15-table'),head=el('tr');[()=>translateUI('時間（秒）'),()=>translateUI('動作'),()=>translateUI('按鍵／軸'),()=>translateUI('數值'),''].forEach(t=>head.append(el('th','',()=>translateUI(t))));table.append(head);
            const pageSize=40,pages=Math.max(1,Math.ceil(d.events.length/pageSize));this.editPage=clamp(this.editPage,0,pages-1);
            for(let i=this.editPage*pageSize;i<Math.min(d.events.length,(this.editPage+1)*pageSize);i++){
                const event=d.events[i],tr=el('tr');const cell=node=>{const td=el('td');td.append(node);tr.append(td);};
                const time=el('input');time.type='number';time.required=true;time.min=0;time.max=86400;time.step=.001;time.value=(event.t/1000).toFixed(3);setLabel(time,"aria-label",()=>(translateUI("步驟 ")+String(i+1)+translateUI(" 時間")));
                time.onchange=()=>{if(time.value===''||!time.checkValidity()){setText(this.editorMessage,()=>translateUI('時間需為有效的非負數。'));return;}event.t=Number(time.value)*1000;};cell(time);
                const type=el('select');for(const [value,label] of [['btn',()=>translateUI('按鍵')],['axis',()=>translateUI('搖桿')]]){const o=el('option','',()=>translateUI(label));o.value=value;type.append(o);}type.value=event.type;setLabel(type,"aria-label",()=>(translateUI("步驟 ")+String(i+1)+translateUI(" 類型")));
                type.onchange=()=>{event.type=type.value;event.id=0;event.val=0;this.renderEditor();};cell(type);
                const id=el('select');(event.type==='btn'?LABELS:['LS X','LS Y','RS X','RS Y']).forEach((label,value)=>{const o=el('option','',()=>translateUI(label));o.value=value;id.append(o);});id.value=event.id;id.onchange=()=>event.id=Number(id.value);setLabel(id,"aria-label",()=>(translateUI("步驟 ")+String(i+1)+translateUI(" 按鍵")));cell(id);
                const value=el('input');value.type='number';value.required=true;value.min=event.type==='btn'?0:-1;value.max=1;value.step='any';value.value=event.val;setLabel(value,"aria-label",()=>(translateUI("步驟 ")+String(i+1)+translateUI(" 數值")));
                value.onchange=()=>{if(value.value===''||!value.checkValidity()){setText(this.editorMessage,()=>translateUI('數值需在按鍵 0～1 或搖桿 -1～1 範圍內。'));return;}event.val=Number(value.value);};cell(value);
                cell(button(()=>translateUI('刪'),()=>{d.events.splice(i,1);this.renderEditor();}));table.append(tr);
            }
            scroll.append(table);body.append(scroll);const nav=el('div','row');nav.append(button(()=>translateUI('上一頁'),()=>{this.editPage--;this.renderEditor();}),el('span','meta',()=>`${this.editPage+1} / ${pages}`),button(()=>translateUI('下一頁'),()=>{this.editPage++;this.renderEditor();}));body.append(nav);
            const row=el('div','row');row.append(button(()=>translateUI('＋ 插入動作'),()=>{if(d.events.length>=MacroBackup.MAX_EVENTS){setText(this.editorMessage,()=>translateUI('已達事件上限。'));return;}d.events.push({t:d.duration,type:'btn',id:0,val:0});this.editPage=Math.floor((d.events.length-1)/pageSize);this.renderEditor();}),button(()=>translateUI('依時間排序'),()=>{d.events.sort((a,b)=>a.t-b.t);this.renderEditor();}));
            const shift=el('input');shift.type='number';shift.value=0;shift.step=.001;setLabel(shift,"aria-label",()=>translateUI('整段平移秒數'));row.append(shift,button(()=>translateUI('整段平移'),()=>{const delta=Number(shift.value)*1000;if(shift.value===''||!Number.isFinite(delta)||d.duration+delta<0||d.events.some(e=>e.t+delta<0)){setText(this.editorMessage,()=>translateUI('平移後不可產生負時間。'));return;}d.events.forEach(e=>e.t+=delta);d.duration+=delta;this.renderEditor();}));body.append(row);
            body.append(el('div','hint',()=>translateUI('0＝放開；按鍵／LT／RT 數值 0～1，搖桿 -1～1。保留同時動作的原順序。總長度不得早於最後一步；過長清單分頁顯示。')));
            const actions=el('div','row');actions.append(button(()=>translateUI('儲存並取代原巨集'),()=>this.attempt(this.editorMessage,()=>{
                this.requireIdle();if(body.querySelector('input:invalid'))throw Error(translateUI('請先修正草稿的無效數值。'));
                MacroTimeline.normalize(d);if(!ask((translateUI("以草稿取代槽位 ")+String(this.editSlot)+translateUI(" 的巨集？"))))return false;MacroTimeline.save(this.app.config,this.editSlot,d);this.draft=null;this.renderEditor();
            })),button(()=>translateUI('捨棄草稿'),()=>{if(ask(translateUI('捨棄未儲存的草稿？'))){this.draft=null;this.renderEditor();setText(this.editorMessage,()=>translateUI('草稿已捨棄，原巨集不變。'));}}));body.append(actions);
        }
        layoutPage() {
            const c=this.card(()=>translateUI('佈局管理'));this.layoutMessage=this.message(c);this.layoutName=el('input');this.layoutName.type='text';this.layoutName.maxLength=60;setLabel(this.layoutName,"aria-label",()=>translateUI('佈局名稱'));this.layoutName.value=this.p.layoutNames[this.p.layoutSlot];
            this.layoutName.onchange=()=>this.attempt(this.layoutMessage,()=>this.saveChange(()=>this.p.layoutNames[this.p.layoutSlot]=this.layoutName.value.trim()));c.append(this.layoutName);
            this.layoutTarget=this.select(c,()=>translateUI('目的佈局'),Array.from({length:6},(_,i)=>[i+1,()=>(translateUI("佈局 ")+String(i+1))]),1,()=>{});
            const row=el('div','row');row.append(button(()=>translateUI('複製到目的'),()=>this.layoutOperation('copy')),button(()=>translateUI('交換兩組'),()=>this.layoutOperation('swap')));c.append(row);
            this.layoutItem=this.select(c,()=>translateUI('還原單一元件'),[...this.app.layout.items.keys()].map(id=>[id,id.startsWith('stick_')?(id==='stick_0'?'LS':'RS'):LABELS[Number(id)]]),'0',()=>{});
            c.append(button(()=>translateUI('還原此元件'),()=>this.attempt(this.layoutMessage,()=>{this.requireIdle();if(!ask(translateUI('還原目前模式的此元件位置？')))return false;this.saveChange(()=>delete this.app.layout.offsets()[this.layoutItem.value]);this.app.layout.apply();})),button(()=>translateUI('匯出六組佈局'),()=>this.download('cloudpad-studio-layouts.json',JSON.stringify(this.layoutDocument(),null,2),this.layoutMessage)),button(()=>translateUI('匯入佈局'),()=>this.chooseFile('layouts',this.layoutMessage)));
            return c;
        }
        layoutOperation(kind) {
            this.attempt(this.layoutMessage,()=>{this.requireIdle();const from=this.p.layoutSlot,to=Number(this.layoutTarget.value);if(from===to)throw Error(translateUI('請選擇不同目的佈局。'));if(!ask((String(kind==='copy'?translateUI('複製覆蓋'):translateUI('交換'))+translateUI("佈局 ")+String(from)+translateUI(" 與 ")+String(to)+"？")))return;
                this.saveChange(()=>{const name=this.p.layoutNames[from];for(const collection of [this.p.layouts,this.p.touchLayouts,this.p.racingLayouts]){const layout=clone(collection[from]);if(kind==='swap')collection[from]=clone(collection[to]);collection[to]=layout;}if(kind==='swap')this.p.layoutNames[from]=this.p.layoutNames[to];this.p.layoutNames[to]=name;});this.app.layout.apply();});
        }
        touchSettingsPage() {
            const c=this.card(()=>translateUI('觸控尺寸與分區透明度')),message=this.message(c);
            const change=(key,value)=>this.attempt(message,()=>this.saveChange(()=>this.p[key]=value));
            this.number(c,()=>translateUI('觸控按鍵大小（倍率）'),this.p.touchButtonSize,.7,1.4,.05,v=>change('touchButtonSize',v));
            this.number(c,()=>translateUI('觸控搖桿大小（倍率）'),this.p.touchStickSize,.7,1.4,.05,v=>change('touchStickSize',v));
            this.number(c,()=>translateUI('按鍵觸控外擴（像素）'),this.p.touchHitPadding,0,8,1,v=>change('touchHitPadding',v));
            this.number(c,()=>translateUI('左操作區透明度（0.2～1）'),this.p.touchOpacityLeft,.2,1,.05,v=>change('touchOpacityLeft',v));
            this.number(c,()=>translateUI('右操作區透明度（0.2～1）'),this.p.touchOpacityRight,.2,1,.05,v=>change('touchOpacityRight',v));
            this.number(c,()=>translateUI('輔助按鍵透明度（0.2～1）'),this.p.touchOpacityUtility,.2,1,.05,v=>change('touchOpacityUtility',v));
            c.append(el('div','hint',()=>translateUI('只影響觸控佈局。空白處仍可操作遊戲頁面；預設排列會保留觸控範圍間距。佈局編輯時顯示按鍵實際範圍，並暫時恢復清楚顯示。自訂拖曳時請避免重疊。窄畫面改為上下排列；大小超過可用空間時會自動縮放。')));
            return c;
        }
        layoutDocument() {return {format:'cloudpad-studio-layouts',version:2,layouts:clone(this.p.layouts),racingLayouts:clone(this.p.racingLayouts),touchLayouts:clone(this.p.touchLayouts),layoutNames:clone(this.p.layoutNames)};}
        validateLayouts(doc) {
            if(!['cloudpad-studio-layouts','better-xcloud-layouts'].includes(doc?.format)||![1,2].includes(doc.version))throw Error(translateUI('不是支援的佈局備份。'));
            if(doc.version===2&&!doc.touchLayouts)throw Error(translateUI('觸控佈局資料不完整。'));
            const merged=clone(this.p);merged.layouts=doc.layouts;merged.layoutNames=doc.layoutNames;
            if(doc.touchLayouts)merged.touchLayouts=doc.touchLayouts;
            if(doc.racingLayouts)merged.racingLayouts=doc.racingLayouts;
            const valid=ConfigurationBackup.validate({format:'better-xcloud-config',version:1,settings:merged});return {layouts:valid.layouts,touchLayouts:valid.touchLayouts,racingLayouts:valid.racingLayouts,layoutNames:valid.layoutNames};
        }
        backupPage() {
            const page=el('div'),c=this.card(()=>translateUI('完整設定備份'),page);this.backupMessage=this.message(c);const row=el('div','row');
            row.append(button(()=>translateUI('匯出完整備份'),()=>{try{this.requireIdle();this.download(`cloudpad-studio-config-${VERSION}.json`,ConfigurationBackup.encode(this.app.config),this.backupMessage);}catch(e){setText(this.backupMessage,()=>translateUI(e.message));}}),button(()=>translateUI('匯入完整備份'),()=>this.chooseFile('config',this.backupMessage)));
            c.append(row,el('div','hint',()=>translateUI('備份包含六組巨集、六組佈局、名稱、曲線、映射與介面設定。匯入只保存設定，不會自動啟動巨集／連發。')));
            this.backupPreview=el('div','v15-card');this.backupPreview.hidden=true;c.append(this.backupPreview);
            const update=this.card(()=>translateUI('版本與更新'),page);update.append(el('div','meta',()=>`${APP_NAME} · v${VERSION}`));this.updateMessage=this.message(update);
            this.updateButton=button(()=>translateUI(UPDATE_CHANNEL==='dev'?'檢查開發版更新':'檢查正式版更新'),()=>this.checkUpdate());const releases=el('a','',()=>translateUI(UPDATE_CHANNEL==='dev'?'開啟開發版安裝檔':'開啟正式版本下載頁'));releases.href=UPDATE_CHANNEL==='dev'?DEV_SCRIPT_URL:'https://github.com/sl721225/CloudPad-Studio/releases/latest';releases.target='_blank';releases.rel='noopener noreferrer';releases.style.color='var(--green)';update.append(this.updateButton,releases,el('div','hint',()=>translateUI(UPDATE_CHANNEL==='dev'?'追蹤 v15-development 開發分支，可能包含未完成的修改。自動更新依腳本管理器設定執行；遊戲中不強制重載。':'只追蹤正式 Release，不使用 main 測試版本。自動更新依腳本管理器設定執行；遊戲中不強制重載。')));
            return page;
        }
        download(name,text,message) {
            try{if(this.app.destroyed)return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));this.urls.add(url);const link=el('a');link.href=url;link.download=name;this.app.shadow.append(link);link.click();link.remove();setTimeout(()=>{URL.revokeObjectURL(url);this.urls.delete(url);},30000);setText(message,()=>translateUI('已產生備份，請確認瀏覽器下載。'));}catch(e){setText(message,()=>translateUI(e.message));}
        }
        chooseFile(kind,message) {
            try{this.requireIdle();}catch(e){setText(message,()=>translateUI(e.message));return;}
            const token=++this.fileToken,input=el('input');input.type='file';input.accept='.json,application/json';input.hidden=true;this.app.shadow.append(input);
            input.onchange=async()=>{
                const file=input.files[0];input.remove();if(!file)return;
                try{this.requireIdle();if(file.size>MacroBackup.MAX_BYTES)throw Error(translateUI('檔案超過 16 MB。'));const text=await file.text();if(token!==this.fileToken||this.app.destroyed)return;this.requireIdle();
                    if(kind==='config')this.showRestore(ConfigurationBackup.parse(text),message);
                    else{let doc;try{doc=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error(translateUI('JSON 無法解析。'));}const data=this.validateLayouts(doc);this.showRestore({...clone(this.p),...data},message,['layouts']);}
                }catch(e){if(token===this.fileToken&&!this.app.destroyed)setText(message,()=>translateUI(e.message));}
            };
            input.addEventListener('cancel',()=>input.remove(),{once:true});input.click();
        }
        showRestore(data,message,allowed=ConfigurationBackup.groups) {
            this.restorePending=true;this.panel.openTab('backup');const preview=this.backupPreview;preview.replaceChildren();preview.hidden=false;
            preview.append(el('h3','',()=>translateUI('還原預覽（尚未寫入）')));
            for(let s=1;s<=6;s++)preview.append(el('div','meta',()=>(translateUI("巨集 ")+String(s)+"："+String(data.macros[s].name||translateUI('未命名'))+"，"+String(data.macros[s].events.length)+translateUI(" 筆；佈局 ")+String(s)+"："+String(data.layoutNames[s]||translateUI('未命名'))+translateUI("，面板 ")+String(Object.keys(data.layouts[s]).length)+translateUI("／觸控 ")+String(Object.keys(data.touchLayouts[s]).length)+translateUI(" 個位移"))));
            const choices={};for(const [key,label] of [['macros',()=>translateUI('六組巨集')],['layouts',()=>translateUI('六組佈局與名稱')],['settings',()=>translateUI('介面／曲線／映射／快捷設定')]])if(allowed.includes(key))choices[key]=this.check(preview,()=>(translateUI("還原")+String(translateUI(label))),true,()=>{});
            this.restoreButton=button(()=>translateUI('確認還原所選項目'),()=>{try{this.requireIdle();const groups=Object.keys(choices).filter(k=>choices[k].checked);if(!groups.length)throw Error(translateUI('請至少選一項。'));if(!ask((translateUI("取代目前的 ")+String(groups.join('、'))+translateUI("？空槽也會覆蓋原資料。"))))return;
                this.app.stopAll();ConfigurationBackup.commit(this.app.config,data,groups);this.fileToken++;this.restorePending=false;preview.hidden=true;this.draft=null;this.renderEditor();this.app.layout.apply();this.app.viewer.resize();this.app.changeModeAfterRestore?.();this.app.setLanguage(this.p.language);this.panel.languageSelect.value=this.p.language;this.panel.refresh();this.refreshControls();this.syncQuickbar();setText(this.backupMessage,()=>translateUI('已還原所選資料；自動操作維持停止。'));
            }catch(e){setText(this.backupMessage,()=>translateUI(e.message));}});preview.append(this.restoreButton,button(()=>translateUI('取消還原'),()=>{this.fileToken++;this.restorePending=false;preview.hidden=true;setText(this.backupMessage,()=>translateUI('已取消，資料沒有變更。'));}));setText(message,()=>translateUI('檔案驗證完成。'));this.panel.refresh();
        }
        refreshControls() {
            // 整個設定頁重新建立，確保還原之後畫面與設定一致。
            for(const key of ['input','shortcuts']){const old=this.panel.pages[key],next=key==='input'?this.inputPage():this.shortcutPage();old.replaceWith(next);this.panel.pages[key]=next;}
            const touch=this.touchSettingsPage();this.touchSettings.replaceWith(touch);this.touchSettings=touch;
            this.layoutName.value=this.p.layoutNames[this.p.layoutSlot];this.speedSelect.value=String(this.p.macroSpeed);this.panel.refresh();
        }
        async checkUpdate() {
            this.updateButton.disabled=true;setText(this.updateMessage,()=>translateUI(UPDATE_CHANNEL==='dev'?'正在查詢開發版…':'正在查詢正式 Release…'));
            try {
                const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);this.app.signal.addEventListener('abort',()=>controller.abort(),{once:true});let response;
                try{response=await fetch(UPDATE_CHANNEL==='dev'?DEV_SCRIPT_URL:'https://api.github.com/repos/sl721225/CloudPad-Studio/releases/latest',{signal:controller.signal,credentials:'omit',cache:'no-store',headers:{Accept:UPDATE_CHANNEL==='dev'?'text/plain':'application/vnd.github+json'}});}finally{clearTimeout(timer);}
                if(!response.ok)throw Error((translateUI("GitHub 回應 ")+String(response.status)+translateUI("，請稍後重試或開啟下載頁。")));const release=UPDATE_CHANNEL==='dev'?{tag_name:readDevVersion(await response.text()),body:''}:await response.json();if(this.app.destroyed)return;
                if(release.draft||release.prerelease||!/^v?\d+\.\d+\.\d+$/.test(release.tag_name))throw Error(translateUI('未找到有效的正式版本。'));
                const latest=release.tag_name.replace(/^v/,''),a=latest.split('.').map(Number),b=VERSION.split('.').map(Number);let newer=false;for(let i=0;i<3;i++){if(a[i]!==b[i]){newer=a[i]>b[i];break;}}
                if(UPDATE_CHANNEL==='dev'){
                    setText(this.updateMessage,()=>translateUI('開發版最新版本：')+latest+translateUI('；目前 ')+VERSION+'\n'+(newer?translateUI('請透過腳本管理器檢查更新，或開啟開發版安裝檔。'):latest===VERSION?translateUI('已是最新版'):translateUI('目前為開發版測試版本。')));
                    return;
                }
                setText(this.updateMessage,()=>newer?(translateUI("有新版本 ")+String(latest)+"\n"+String(String(release.body||'').slice(0,3000))+translateUI("\n請透過腳本管理器更新，或開啟正式版本下載頁。")):(translateUI("正式版為 ")+String(latest)+translateUI("；目前 ")+String(VERSION)+" "+String(latest===VERSION?translateUI('已是最新版'):translateUI('比公開正式版新，尚在測試'))+"。"));
            }catch(e){if(!this.app.destroyed)setText(this.updateMessage,()=>e.name==='AbortError'?translateUI('查詢逾時，請稍後再試。'):e.message);}
            finally{if(!this.app.destroyed)this.updateButton.disabled=false;}
        }
        diagnosticPage() {
            const page=el('div'),c=this.card(()=>translateUI('輸入測試中心'),page);c.append(el('div','hint',()=>translateUI('RAW：虛擬原始輸入；OUT：套用曲線與映射後的虛擬輸出。實體原始與處理後數值分開列出，不宣稱可量測雲端遊戲延遲。')));
            this.diagnostics=el('pre','v15-diagnostics');c.append(this.diagnostics,button(()=>translateUI('清除虛擬輸入／全停'),()=>this.app.stopAll(),'danger'));return page;
        }
        syncQuickbar() {
            if(!this.quickbar)return;this.quickbar.hidden=!this.p.showQuickbar;this.quickItems.hidden=this.p.quickbarCollapsed;setText(this.quickToggle,()=>this.p.quickbarCollapsed?translateUI('巨集 ▸'):translateUI('巨集 ▾'));this.quickToggle.setAttribute('aria-expanded',String(!this.p.quickbarCollapsed));
            this.quickButtons.forEach((b,i)=>{const m=this.p.macros[i+1];setText(b,()=>`${i+1} ${m.name||translateUI('未命名')}`);setLabel(b,'title',()=>m.name||(translateUI("巨集 ")+String(i+1)));b.disabled=this.app.macro.recording||this.app.layout.editing||!m.events.length;b.classList.toggle('on',this.app.macro.playing&&this.app.macro.slot===i+1);});
        }
        tick(now) {
            if(now-this.lastTick<100)return;this.lastTick=now;this.syncQuickbar();if(this.restoreButton)this.restoreButton.disabled=this.busy()||this.app.layout.editing;
            if(this.app.shadow.activeElement!==this.layoutName)this.layoutName.value=this.p.layoutNames[this.p.layoutSlot];
            if(this.panel.tab!=='diagnostics'||this.panel.collapsed)return;
            const a=this.app,raw=a.rawSnapshot(),out=a.input.snapshot(),real=a.physical.state;
            const describe=(label,s)=>(String(translateUI(label))+translateUI("\n按鍵：")+String(s.buttons.map((v,i)=>v>0?`${LABELS[i]}=${v.toFixed(2)}`:'').filter(Boolean).join(' ')||translateUI('全部放開'))+translateUI("\n軸：")+String(s.axes.map(v=>v.toFixed(3)).join(' / ')));
            const keys=[...a.input.sources].map(([key,s])=>(String(key)+translateUI("（優先 ")+String(s.priority)+"）")).join('\n')||translateUI('無');
            const physicalOut=this.p.physicalMapping?a.pipeline.process(real):real;
            setText(this.diagnostics,()=>(String(describe(translateUI('RAW 虛擬原始'),raw))+"\n\n"+String(describe(translateUI('OUT 虛擬最終'),out))+translateUI("\n\n實體：")+String(a.physical.connected?a.physical.id:translateUI('未連接'))+"\n"+String(describe(translateUI('實體原始'),real))+"\n"+String(describe(translateUI('實體送出'),physicalOut))+translateUI("\n\n作用中來源\n")+String(keys)+translateUI("\n\n巨集：")+String(a.macro.recording?translateUI('錄製中'):a.macro.playing?translateUI('播放中'):translateUI('停止'))+translateUI("\n虛擬槽位：")+String(a.virtual.slot)+translateUI("\n目前來源按鍵由最大值合併；軸依優先順序仲裁。")));
        }
    }

    class App {
        constructor() {
            this.clock=()=>performance.now();this.abort=new AbortController();this.signal=this.abort.signal;this.destroyed=false;this.override=false;
            this.manualUntil=-Infinity;this.comboSince=null;this.comboFired=false;this.popupNode=null;
            this.lastRaceContact=-Infinity;this.panelWakeUntil=-Infinity;this.panelPointers=new Set();
            let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
            this.warnings=[];this.config=new ConfigStore(storage,(message,e)=>{console.warn('[CloudPad Studio]',message,e||'');if(!this.warnings.includes(message)){this.warnings.push(message);this.notice(message);}});
            this.input=new InputManager(this.clock);this.virtual=new VirtualGamepad(this.input,navigator,window);this.physical=new PhysicalGamepadMonitor(this.virtual);
            this.auto=new ButtonAutomation(this.input,this.config,this.clock);this.macro=new MacroEngine(this.input,this.config,this.clock);
            this.layout=new LayoutManager(this.config);this.pointers=new PointerManager(window,this.signal);this.racing=new RacingController(this);
            this.pipeline=new InputPipeline(this.config);this.virtual.pipeline=this.pipeline;
            this.rawSnapshot=this.input.snapshot.bind(this.input);this.input.snapshot=(filter)=>this.pipeline.process(this.rawSnapshot(filter));
            this.input.recordingState=()=>this.rawSnapshot(key=>key!=='macro'&&key!=='afk');
            const rawSet=this.input.set.bind(this.input),rawClear=this.input.clear.bind(this.input);
            this.input.set=(key,...args)=>{if(this.shortcuts?.blocked.has(key))return;rawSet(key,...args);};
            this.input.clear=key=>{this.shortcuts?.blocked.delete(key);rawClear(key);};
        }
        start() {
            this.signal.addEventListener('abort',()=>startupGuard.abort(),{once:true});
            this.i18n=new I18n(this.config.prefs.language);
            this.host=el('div');this.host.id='bxg-v14-root';this.host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
            this.host.lang=this.config.prefs.language;this.shadow=this.host.attachShadow({mode:'open'});const style=el('style');style.textContent=CSS;this.shadow.append(style);document.documentElement.append(this.host);
            // UI 的右鍵也會產生 pointer/mouse/auxclick；不可讓它們冒泡到串流頁面的滑鼠控制。
            // 在 ShadowRoot 冒泡階段攔截，保留控制元件與全域 capture 的觸控清理流程。
            for(const type of ['click','dblclick','contextmenu','pointerdown','pointerup','mousedown','mouseup','auxclick'])this.shadow.addEventListener(type,e=>{
                e.stopPropagation();if(e.button===2)e.preventDefault();
            },{signal:this.signal});
            this.panel=new ControlPanel(this);this.viewer=new ViewerHUD(this);this.racingView=new RacingRenderer(this);
            this.touch=new TouchLayout(this);this.panel.refresh();
            this.shortcuts=new ShortcutManager(this);this.advanced=new AdvancedTools(this);
            try {this.virtual.install();} catch(e) {this.notice(translateUI('無法掛接虛擬手把。請停用其他手把腳本後重新整理。'));throw e;}
            this.bindEvents();this.loop();
            if(this.warnings.length)this.notice(this.warnings.join(' '));
            this.i18n.refresh();
        }
        bindEvents() {
            window.addEventListener('keydown',e=>{if(e.code==='F2'&&!e.repeat&&!e.composedPath().some(n=>n?.matches?.('input,select,textarea,[contenteditable=true]'))){e.preventDefault();this.shortcut();}},{signal:this.signal});
            window.addEventListener('blur',event=>{if(event.target===window)this.leaveForeground();},{signal:this.signal});
            window.addEventListener('focus',()=>{if(!document.hidden)this.returnForeground();},{signal:this.signal});
            document.addEventListener('visibilitychange',()=>{if(document.hidden)this.leaveForeground();else if(document.hasFocus())this.returnForeground();},{signal:this.signal});
            window.addEventListener('pagehide',()=>this.suspend('pagehide'),{signal:this.signal});
            window.addEventListener('offline',()=>{this.suspend('offline');this.notice(translateUI('網路已離線，已釋放所有虛擬輸入。'));},{signal:this.signal});
            window.addEventListener('resize',()=>{this.pointers.cancelAll();this.panel.refresh();this.viewer.resize();this.racingView.resize();},{signal:this.signal});
            document.addEventListener('pointerdown',e=>{
                if(this.popupNode&&!e.composedPath().includes(this.popupNode))this.closePopup();
                if(!e.composedPath().includes(this.viewer.root)){this.manualUntil=this.clock()+2500;if(this.override){this.override=false;this.updateVisibility();}}
                if(e.composedPath().includes(this.panel.root)){
                    this.panelPointers.add(e.pointerId);this.panelWakeUntil=this.clock()+1000;
                    this.updatePanelFade(this.clock());
                }
            },{signal:this.signal,capture:true});
            for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>{
                if(this.panelPointers.delete(e.pointerId))this.panelWakeUntil=this.clock()+1000;
            },{signal:this.signal,capture:true});
            document.addEventListener('fullscreenchange',()=>{
                this.pointers.cancelAll();const target=document.fullscreenElement||document.documentElement;
                if(target!==this.host&&!target.contains(this.host))target.append(this.host);
                this.panel.refresh();this.viewer.resize();this.racingView.resize();
            },{signal:this.signal});
        }
        manualStart() {
            if(this.config.prefs.backgroundMacro&&this.macro.playing&&!document.hasFocus()){
                this.ignoredBackgroundInput=(this.ignoredBackgroundInput||0)+1;return false;
            }
            this.macro.stopPlayback('manual');this.manualUntil=this.clock()+2500;this.override=false;return true;
        }
        vibrate(pattern) {try{navigator.vibrate?.(pattern);}catch{}}
        stopAll(reason='stop-all') {
            this.cancelBackgroundPump();this.macro.stop(reason);this.pointers.cancelAll();this.panel?.cancelTaps();this.auto.stop();this.racing.stop();this.input.clearAll();
            this.lastRaceContact=-Infinity;this.panelPointers.clear();this.panelWakeUntil=-Infinity;
            if(this.panel)this.updatePanelFade(this.clock());
            this.panel?.refreshStatus();
            this.shortcuts?.blocked.clear();this.shortcuts?.holdSince.clear();
        }
        cancelBackgroundPump() {clearTimeout(this.backgroundTimer);this.backgroundTimer=null;}
        returnForeground() {this.backgrounded=false;this.cancelBackgroundPump();this.panel?.refreshStatus();}
        leaveForeground() {
            this.backgrounded=true;this.shortcuts?.keyHeld.clear();this.shortcuts?.comboHeld.clear();
            if(!this.config.prefs.backgroundMacro||!this.macro.playing){this.suspend(this.config.prefs.backgroundMacro?'focus-idle':'focus-off');return;}
            // Preserve only the macro source; never retain a finger, AFK or automated hold.
            this.pointers.cancelAll();this.panel.cancelTaps();this.auto.stop();this.racing.stop();
            for(const key of [...this.input.sources.keys()])if(key!=='macro')this.input.clear(key);
            this.panelPointers.clear();this.comboSince=null;this.comboFired=false;
            this.shortcuts?.blocked.clear();this.shortcuts?.holdSince.clear();
            this.override=false;this.closePopup();this.updateVisibility();this.panel.refreshStatus();
            this.scheduleBackgroundPump();
        }
        scheduleBackgroundPump() {
            this.cancelBackgroundPump();
            if(this.destroyed||!this.backgrounded||!this.config.prefs.backgroundMacro||!this.macro.playing)return;
            this.backgroundTimer=setTimeout(()=>{
                this.backgroundTimer=null;
                if(this.destroyed||!this.backgrounded||!this.config.prefs.backgroundMacro||!this.macro.playing)return;
                const now=this.clock(),limit=this.config.prefs.playbackLimit;
                if(limit&&now-this.macro.runStart>=limit*1000){this.macro.stop('time-limit');this.notice(translateUI('巨集已達播放時間上限，已停止。'));}
                else this.macro.tick(now);
                this.virtual.sync(this.virtual.readPhysical());
                this.scheduleBackgroundPump();
            },30);
        }
        suspend(reason='stop-all') {this.cancelBackgroundPump();this.stopAll(reason);this.override=false;this.closePopup();this.updateVisibility();}

        changeModeAfterRestore() {
            const p=this.config.prefs;
            this.panel.root.style.left=p.gameMode==='racing'?'15px':p.panelPos?.x||'15px';
            this.panel.root.style.top=p.gameMode==='racing'?'15px':p.panelPos?.y||`${Math.max(15,window.innerHeight-280*p.uiScale)}px`;
            this.viewer.root.style.left=p.viewerPos.x;this.viewer.root.style.top=p.viewerPos.y;
            this.override=false;this.panel.refresh();this.touch.positionPanel();this.clampElement(this.panel.root);this.viewer.resize();this.racingView.resize();this.updateVisibility();
        }
        shortcut() {
            if(this.auto.modes.size){this.auto.stopModes();this.panel.refreshStatus();}
            else {this.pointers.cancelAll();this.panel.collapsed=!this.panel.collapsed;this.panel.refresh();}
            this.manualUntil=this.clock()+2500;this.override=false;this.updateVisibility();
        }
        changeMode() {
            this.stopAll();this.layout.editing=false;
            this.config.prefs.gameMode=this.config.prefs.gameMode==='racing'?'standard':'racing';
            if(this.config.prefs.gameMode==='racing'){this.panel.root.style.left='15px';this.panel.root.style.top='15px';}
            else {this.panel.root.style.left=this.config.prefs.panelPos?.x||'15px';this.panel.root.style.top=this.config.prefs.panelPos?.y||`${Math.max(15,window.innerHeight-280)}px`;}
            this.config.save();this.panel.refresh();this.updateVisibility();
        }
        changeControlStyle(style=null) {
            if(this.config.prefs.gameMode==='racing'){this.notice(translateUI('賽車使用自己的操作區，請切回標準模式再選擇佈局。'));return;}
            const p=this.config.prefs,old=p.controlStyle,next=style|| (old==='panel'?'touch':'panel');
            if(!['panel','touch'].includes(next)||next===old)return;
            this.stopAll();this.closePopup();this.layout.editing=false;p.controlStyle=next;
            if(!this.config.save()){p.controlStyle=old;this.notice(translateUI('佈局切換儲存失敗，已保留原模式。'));}
            this.override=false;this.manualUntil=this.clock()+2500;this.panel.refresh();this.updateVisibility();
        }
        playMacro(loop,slot=this.macro.slot) {if(this.macro.recording){this.notice(translateUI('請先停止錄製，再播放巨集。'));return;}this.stopAll();this.macro.slot=slot;if(!this.macro.play(loop))this.notice((translateUI("槽位 ")+String(slot)+translateUI(" 沒有可播放的動作。")));this.panel.refresh();}
        startRecording() {
            if(this.macro.recording)return;
            if(this.layout.editing){this.notice(translateUI('請先完成佈局編輯，再錄製巨集。'));return;}
            const source=this.config.prefs.macroRecordSource;
            if(source==='physical'){
                this.physical.poll(this.clock());
                if(!this.physical.connected){this.notice(translateUI('未連接實體手把，無法開始錄製。'));this.panel.refresh();return;}
            }
            this.stopAll();
            const physicalIndex=source==='physical'?this.physical.lastIndex:null;
            this.macro.record(source==='physical'?()=>this.physical.state:null,{source,physicalIndex});
            this.override=false;this.updateVisibility();this.panel.refresh();
        }
        clampElement(node) {
            if(!node||node.hidden)return;const rect=node.getBoundingClientRect();
            // CSS left/top 是視窗座標，不需除以 scale。
            node.style.left=`${clamp(parseFloat(node.style.left)||rect.left,8,Math.max(8,window.innerWidth-rect.width-8))}px`;
            node.style.top=`${clamp(parseFloat(node.style.top)||rect.top,8,Math.max(8,window.innerHeight-rect.height-8))}px`;
        }
        dragElement(handle,node,save,enabled=()=>true) {
            let busy=false;
            this.pointers.bind(handle,e=>{
                if(busy||!enabled()||e.target.closest('button,select,input'))return null;busy=true;
                const rect=node.getBoundingClientRect();const x=e.clientX,y=e.clientY,l=rect.left,t=rect.top;
                return {move:ev=>{node.style.left=`${l+ev.clientX-x}px`;node.style.top=`${t+ev.clientY-y}px`;},end:(_,cancel)=>{
                    busy=false;if(cancel){node.style.left=`${l}px`;node.style.top=`${t}px`;}this.clampElement(node);if(!cancel)save();}};
            });
        }
        closePopup() {this.popupNode?.remove();this.popupNode=null;}
        popup(e,options,current,select) {
            this.closePopup();const menu=el('div','popup');menu.setAttribute('role','group');
            for(const [value,label] of options)menu.append(button(()=>translateUI(label),()=>{select(value);this.closePopup();},value===current?'on':''));
            this.popupNode=menu;this.shadow.append(menu);const anchor=e.currentTarget?.getBoundingClientRect();
            menu.style.left=`${anchor?.left??e.clientX}px`;menu.style.top=`${anchor?.bottom??e.clientY}px`;this.clampElement(menu);
        }
        setLanguage(language) {
            if(!['zh-TW','en'].includes(language))return;
            this.i18n.language=language;uiLanguage=language;
            this.shadow.host.setAttribute('lang',language);
            this.panel.statusSignature='';this.panel.refresh();this.advanced?.syncQuickbar();this.i18n.refresh();
            this.clampElement(this.panel.root);
        }
        notice(message) {if(!this.shadow)return;const n=el('div','notice',()=>translateUI(message));n.append(button(()=>translateUI('關閉'),()=>n.remove()));this.shadow.append(n);}
        updateVisibility() {
            if(!this.panel||!this.viewer||!this.racingView)return;
            this.panel.root.hidden=this.override;this.viewer.root.hidden=!(this.override||this.config.prefs.showViewer);
            this.touch?.updateVisibility();
            this.racingView.area.hidden=this.override||this.panel.collapsed||this.config.prefs.gameMode!=='racing';
        }
        updatePanelFade(now) {
            const raceMode=this.config.prefs.gameMode==='racing',touchMode=!raceMode&&this.config.prefs.controlStyle==='touch';
            const eligible=(raceMode?this.config.prefs.racingAutoFade:touchMode&&this.config.prefs.touchAutoFade)
                &&!this.panel.collapsed&&!this.panel.tab&&!this.layout.editing&&!this.override;
            // 使用觸控工作階段，不只看 pointermove；按住油門不移動也會持續淡化。
            if(!eligible)this.lastRaceContact=-Infinity;
            else if(raceMode?(this.racing.left||this.racing.right):[...this.pointers.sessions.values()].some(s=>this.touch.root.contains(s.el)))this.lastRaceContact=now;
            const awake=this.panelPointers.size>0||now<this.panelWakeUntil;
            const dim=eligible&&!awake&&now-this.lastRaceContact<1000;
            // 頂部面板一被觸碰就立即清楚，其餘淡入淡出則平滑過渡。
            styleValue(this.panel.root,'transition',awake?'none':'opacity 200ms ease');
            styleValue(this.panel.root,'opacity',dim?'0.25':'1');
            if(this.touch?.active){styleValue(this.touch.root,'transition',awake?'none':'opacity 200ms ease');styleValue(this.touch.root,'opacity',dim&&raceMode?'0.25':'1');}
            if(this.advanced?.quickbar){const race=this.config.prefs.gameMode==='racing';styleValue(this.advanced.quickbar,'top',race?'64px':'35%');styleValue(this.advanced.quickbar,'maxHeight',race?'80px':'65vh');}
        }
        loop() {
            if(this.destroyed)return;
            const now=this.clock();if(now-(this.i18nPruneAt||0)>5000){this.i18n.prune();this.i18nPruneAt=now;}const physicalRecording=this.macro.recording&&this.macro.recordSource==='physical';
            this.physical.poll(now,physicalRecording?this.macro.physicalIndex:null);
            if(physicalRecording){
                if(this.physical.connected)this.macro.capture();
                else{this.macro.stopRecording();this.panel.refresh();this.notice(translateUI('錄製來源手把已斷線，已停止並保存本次錄製。'));}
            }
            const diagnosing=this.panel.tab==='diagnostics'&&!this.panel.collapsed;
            const shouldOverride=this.physical.connected&&now-this.physical.lastActivity<2500&&now>=this.manualUntil&&!this.layout.editing&&!this.pointers.busy&&!this.macro.recording&&!diagnosing;
            if(shouldOverride!==this.override){this.override=shouldOverride;if(!shouldOverride)this.panel.refresh();}
            this.auto.tick(now);this.macro.tick(now);this.racing.tick(now);
            this.shortcuts.tick(now);this.advanced.tick(now);
            const virtualState=this.rawSnapshot();
            const combo=!this.macro.recording&&((virtualState.buttons[10]>0.05&&virtualState.buttons[11]>0.05)||(this.physical.state.buttons[10]>0.05&&this.physical.state.buttons[11]>0.05));
            if(combo){if(this.comboSince===null)this.comboSince=now;if(!this.comboFired&&now-this.comboSince>=1500){this.comboFired=true;this.shortcut();}}
            else {this.comboSince=null;this.comboFired=false;}
            this.virtual.sync(this.virtual.readPhysical());this.updateVisibility();this.updatePanelFade(now);
            const showPhysical=this.physical.connected&&(this.override||this.physical.active);
            // 控制面板監控採最大按鍵值；實體軸僅在有活動時覆蓋顯示，不修改虛擬輸出。
            const display=this.input.snapshot();
            if(showPhysical){display.buttons=display.buttons.map((v,i)=>Math.max(v,this.physical.state.buttons[i]));this.physical.state.axes.forEach((v,i)=>{if(Math.abs(v)>0.15)display.axes[i]=v;});}
            this.panel.tick(now,display);
            if(!this.viewer.root.hidden)this.viewer.render(showPhysical?this.physical.state:this.input.snapshot(),showPhysical);
            this.racingView.render();this.raf=requestAnimationFrame(()=>this.loop());
        }
        destroy() {
            this.destroyed=true;cancelAnimationFrame(this.raf);this.stopAll('destroy');this.abort.abort();this.virtual.destroy();this.i18n?.destroy();this.host?.remove();
            if(window.__BXG_V14__===this)delete window.__BXG_V14__;
            if(window.__CLOUDPAD_STUDIO__===this)delete window.__CLOUDPAD_STUDIO__;
        }
    }

    // 測試可載入純邏輯類別，不啟動 DOM，也不改寫真實 navigator。
    if(typeof module==='object'&&module.exports) {
        module.exports={readDevVersion,I18n,translateUI,ConfigStore,InputManager,VirtualGamepad,PhysicalGamepadMonitor,ButtonAutomation,MacroEngine,MacroBackup,MacroTimeline,ConfigurationBackup,InputPipeline,LayoutManager,PointerManager,RacingController,App};return;
    }
    if(window.top!==window.self)return;
    // Install at document-start, before the stream registers its focus-loss handlers.
    // Do not suppress anything until the user explicitly enables background playback.
    const startupGuard=new AbortController();
    window.addEventListener('blur',event=>{
        const app=window.__CLOUDPAD_STUDIO__;
        if(event.target!==window||!app||app.destroyed||!app.config.prefs.backgroundMacro||!app.macro.playing)return;
        event.stopImmediatePropagation();app.focusGuardCount=(app.focusGuardCount||0)+1;app.leaveForeground();
    },{capture:true,signal:startupGuard.signal});
    window.addEventListener('focusout',event=>{
        const app=window.__CLOUDPAD_STUDIO__;
        if(app&&!app.destroyed&&app.config.prefs.backgroundMacro&&app.macro.playing&&event.relatedTarget===null&&!document.hasFocus()){
            event.stopImmediatePropagation();app.leaveForeground();
        }
    },{capture:true,signal:startupGuard.signal});
    const boot=()=>{const previous=window.__CLOUDPAD_STUDIO__||window.__BXG_V14__;previous?.destroy?.();const app=new App();window.__CLOUDPAD_STUDIO__=app;window.__BXG_V14__=app;
        try{app.start();}catch(e){console.error(translateUI('[CloudPad Studio] 啟動失敗'),e);app.destroy();alert(translateUI('CloudPad Studio 啟動失敗，請查看 Console 並確認舊版已停用。'));}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
