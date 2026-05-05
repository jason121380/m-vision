/**
 * M 視覺 — 表單回覆寫入「回覆 Sheet」+ 契約 PDF 存到 Drive
 *
 * 架構：
 *   - 設定 Sheet（讀）：發佈成 CSV 給前端讀，這個檔案不需要動它
 *   - 回覆 Sheet（寫）：這份 Apps Script 把客戶送出的資料 append 到這裡
 *   - PDF 資料夾：契約 PDF 會存到指定的 Google Drive 資料夾，URL 寫進 Sheet
 *
 * 部署步驟：
 * 1. 開一份新的 Google Sheet 當作「回覆 Sheet」
 * 2. 從網址列複製這份 Sheet 的 ID（在 /d/ 跟 /edit 之間那段亂碼）
 *    把它貼到下面的 RESPONSE_SHEET_ID
 * 3. 開一個 Drive 資料夾用來存契約 PDF，從網址列複製資料夾 ID，
 *    貼到 PDF_FOLDER_ID（已預先填好）
 * 4. Apps Script 可以放在任何地方（建議直接從「回覆 Sheet」的
 *    擴充功能 → Apps Script 開），把這整份貼進去
 * 5. 上方工具列 ▶ 執行（選 `init`）→ 會跳授權，按確認
 *    （第一次需要授權 SpreadsheetApp + DriveApp 兩個服務）
 * 6. 右上角「部署」→「管理部署作業」→ 編輯既有的網路應用程式 →
 *    版本選「新版本」→ 部署
 *
 * 重要：每次改完這份程式都要「新版本」部署，否則網址背後是舊版。
 */

// === 必填：回覆 Sheet 的 ID（網址 /d/ 後面那段）===
var RESPONSE_SHEET_ID = '1wMqpUncxpn-j_TxXr27UJsovOc4EaiDvRRCAM239Qtc';

// === 必填：契約 PDF 要存到的 Drive 資料夾 ID ===
var PDF_FOLDER_ID = '1os5QkoQ3x1Mzp0vcE45brJ9ICscQyCqd';

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
  'pdfUrl',
  'signature'
];

function doPost(e) {
  try {
    if (!RESPONSE_SHEET_ID) {
      throw new Error('RESPONSE_SHEET_ID 尚未設定');
    }
    var data = JSON.parse(e.postData.contents);

    // 1. 上傳 PDF 到 Drive 資料夾，拿公開連結
    var pdfUrl = '';
    if (data.pdfBase64 && PDF_FOLDER_ID) {
      try {
        var folder = DriveApp.getFolderById(PDF_FOLDER_ID);
        var bytes = Utilities.base64Decode(data.pdfBase64);
        var blob = Utilities.newBlob(bytes, 'application/pdf', data.pdfFilename || 'contract.pdf');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        pdfUrl = file.getUrl();
      } catch (pdfErr) {
        // PDF 上傳失敗不阻擋表單寫入
        pdfUrl = 'PDF upload failed: ' + String(pdfErr);
      }
    }
    data.pdfUrl = pdfUrl;

    // 2. 寫入 Sheet
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
      .createTextOutput(JSON.stringify({ ok: true, pdfUrl: pdfUrl }))
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
  if (PDF_FOLDER_ID) {
    DriveApp.getFolderById(PDF_FOLDER_ID).getName();
  }
}
