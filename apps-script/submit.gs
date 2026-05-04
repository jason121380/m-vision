/**
 * M 視覺 — 表單回覆寫入 Sheet
 *
 * 部署步驟：
 * 1. 在你的 Google Sheet 裡 → 擴充功能 → Apps Script
 * 2. 把這整份貼進去（覆蓋掉原本的 Code.gs）
 * 3. 第一次點 ▶ 執行 `doPost` 一次（會跳授權，按確認）
 *    — 之後資料庫權限就會綁好
 * 4. 右上角「部署」→「新增部署作業」→ 類型選「網路應用程式」
 *    - 執行身分：我（你的 Google 帳號）
 *    - 誰可以存取：所有人
 *    - 按「部署」→ 複製出現的 URL（.../exec 結尾）
 * 5. 把 URL 貼到 src/config.ts 的 SUBMISSION_ENDPOINT_URL
 *
 * 如果你之後改這份 Apps Script，要重新「部署」（或選「管理部署作業」→ 編輯
 * 現有的，把版本改成「新版本」），不然網址背後跑的還是舊版。
 */

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
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  SpreadsheetApp.getActiveSpreadsheet().getName();
}
