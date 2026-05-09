/**
 * M 視覺 — Drive PDF 上傳 + 預約檔期備份到 Sheet
 *
 * 後端 (server/src/routes/*) 會把不同 action 都打到這支 endpoint：
 *   1. 客戶送單：PDF base64 → 存進 Drive 資料夾，回傳公開 URL
 *   2. 預約檔期變動：bookings 整張陣列 → 寫到備份 Sheet 的 bookings 分頁
 *
 * 部署前要設好：
 *   - PDF_FOLDER_ID：契約 PDF 存放資料夾 ID
 *   - BOOKINGS_BACKUP_SHEET_ID：備份用 Google Sheet ID（建議直接用既有的設定 Sheet）
 *
 * 第一次部署：
 *   1. ▶ 執行 → 選 init → 確認 DriveApp + SpreadsheetApp 兩個權限
 *   2. 部署 → 網路應用程式 → 執行身分：我；存取：所有人
 *   3. 把 .../exec URL 設給後端 PDF_UPLOAD_ENDPOINT 環境變數
 *
 * 改 code 一定要「管理部署作業 → ✏️ → 版本：新版本 → 部署」才會生效。
 */

var PDF_FOLDER_ID = '1os5QkoQ3x1Mzp0vcE45brJ9ICscQyCqd';

// 預約檔期備份 Sheet。可以直接用既有的設定 Sheet（會在裡面新建一個 bookings 分頁）
var BOOKINGS_BACKUP_SHEET_ID = '1keLGOiVFkgnInnP4fa3lt3u5DeNvswbxkHZ9Wd5G3dc';
var BOOKINGS_SHEET_NAME = 'bookings';
var BOOKINGS_COLUMNS = [
  'date',
  'videoSlots',
  'photoSlots',
  'videoCamsUsed',
  'photoCamsUsed',
  'videoLeads',
  'photoLeads',
  'notes'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'syncBookings') {
      return handleSyncBookings(data);
    }

    return handlePdfUpload(data);
  } catch (err) {
    return jsonResp({ ok: false, error: String(err) });
  }
}

// 上 PDF 拿 url
function handlePdfUpload(data) {
  var pdfUrl = '';
  if (data.pdfBase64 && PDF_FOLDER_ID) {
    var folder = DriveApp.getFolderById(PDF_FOLDER_ID);
    var bytes = Utilities.base64Decode(data.pdfBase64);
    var blob = Utilities.newBlob(bytes, 'application/pdf', data.pdfFilename || 'contract.pdf');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = file.getUrl();
  }
  return jsonResp({ ok: true, pdfUrl: pdfUrl });
}

// 把整份 bookings 陣列覆寫到備份 Sheet 的 bookings 分頁
function handleSyncBookings(data) {
  if (!BOOKINGS_BACKUP_SHEET_ID) {
    return jsonResp({ ok: false, error: 'BOOKINGS_BACKUP_SHEET_ID 尚未設定' });
  }
  var ss = SpreadsheetApp.openById(BOOKINGS_BACKUP_SHEET_ID);
  var sheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(BOOKINGS_SHEET_NAME);
  sheet.clear();
  sheet.appendRow(BOOKINGS_COLUMNS);

  var bookings = Array.isArray(data.bookings) ? data.bookings : [];
  if (bookings.length > 0) {
    var rows = bookings.map(function (b) {
      return [
        b.date || '',
        Number(b.videoSlots || 0),
        Number(b.photoSlots || 0),
        Number(b.videoCamsUsed || 0),
        Number(b.photoCamsUsed || 0),
        (b.videoLeads || []).join(','),
        (b.photoLeads || []).join(','),
        b.notes || ''
      ];
    });
    sheet.getRange(2, 1, rows.length, BOOKINGS_COLUMNS.length).setValues(rows);
  }
  return jsonResp({ ok: true, count: bookings.length });
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// 首次授權：執行一次讓 Apps Script 觸發 OAuth 同意畫面（DriveApp + SpreadsheetApp）
function init() {
  if (PDF_FOLDER_ID) DriveApp.getFolderById(PDF_FOLDER_ID).getName();
  if (BOOKINGS_BACKUP_SHEET_ID) SpreadsheetApp.openById(BOOKINGS_BACKUP_SHEET_ID).getName();
}
