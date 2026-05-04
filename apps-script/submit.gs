/**
 * M 視覺 — 表單回覆寫入「回覆 Sheet」
 *
 * 架構：
 *   - 設定 Sheet（讀）：發佈成 CSV 給前端讀，這個檔案不需要動它
 *   - 回覆 Sheet（寫）：這份 Apps Script 把客戶送出的資料 append 到這裡
 *
 * 部署步驟：
 * 1. 開一份新的 Google Sheet 當作「回覆 Sheet」
 * 2. 從網址列複製這份 Sheet 的 ID（在 /d/ 跟 /edit 之間那段亂碼）
 *    例如：https://docs.google.com/spreadsheets/d/【這段就是 ID】/edit
 *    把它貼到下面的 RESPONSE_SHEET_ID
 * 3. Apps Script 可以放在任何地方（建議直接從「回覆 Sheet」的
 *    擴充功能 → Apps Script 開），把這整份貼進去
 * 4. 上方工具列 ▶ 執行（選 `init`）→ 會跳授權，按確認
 * 5. 右上角「部署」→「新增部署作業」→ 類型選「網路應用程式」
 *    - 執行身分：我（你的 Google 帳號）
 *    - 誰可以存取：所有人
 *    - 按「部署」→ 複製出現的 URL（.../exec 結尾）
 * 6. 把 URL 貼到 src/config.ts 的 SUBMISSION_ENDPOINT_URL
 *
 * 之後改這份程式碼要重新「管理部署作業」→ 編輯現有的 → 版本改成「新版本」，
 * 不然網址背後跑的還是舊版。
 */

// === 必填：回覆 Sheet 的 ID（網址 /d/ 後面那段）===
var RESPONSE_SHEET_ID = '1wMqpUncxpn-j_TxXr27UJsovOc4EaiDvRRCAM239Qtc';

// 接收表單回覆要寫到的分頁名稱（沒有就會自動建立）
var RESPONSE_SHEET_NAME = 'responses';

// 寫進 Sheet 的欄位順序（第一列是 header）
var COLUMNS = [
  'submittedAt',
  'groom',
  'bride',
  'phone',
  'eventDate',
  'service',
  'weddingTime',
  'restaurant',
  'hotel',
  'cerWz',
  'cerYq',
  'cerZh',
  'makeupTime',
  'total',
  'breakdown',
  'signature'
];

function doPost(e) {
  try {
    if (!RESPONSE_SHEET_ID) {
      throw new Error('RESPONSE_SHEET_ID 尚未設定');
    }
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(RESPONSE_SHEET_ID);
    var sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(RESPONSE_SHEET_NAME);
      sheet.appendRow(COLUMNS);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
    }
    var row = COLUMNS.map(function (k) { return data[k] != null ? data[k] : ''; });
    sheet.appendRow(row);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 用來首次授權；不會做事，只是讓 Apps Script 觸發 OAuth 流程
function init() {
  if (RESPONSE_SHEET_ID) {
    SpreadsheetApp.openById(RESPONSE_SHEET_ID).getName();
  }
}
