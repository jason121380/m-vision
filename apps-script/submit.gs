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

// === 必填：設定 Sheet 的 ID（前端讀取 photographers / bookings 等的那份）===
//   開該份 Sheet → 網址 /d/ 跟 /edit 之間那段亂碼貼進來。
//   留空字串就不會更新 bookings 分頁。
var SETTINGS_SHEET_ID = '';

// 接收表單回覆要寫到的分頁名稱（沒有就會自動建立）
var RESPONSE_SHEET_NAME = 'responses';

// 設定 Sheet 裡面 bookings 分頁的名稱（前端 useConfig 讀的就是這個分頁）
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

// 找分頁：先用完全相符的名稱，找不到再退回「名稱包含關鍵字」（case-insensitive）。
// 這樣使用者把 tab 重命名成「預約 bookings」「bookings 預約」「📅 bookings」之類也找得到。
function findSheetLoose(ss, name) {
  var exact = ss.getSheetByName(name);
  if (exact) return exact;
  var needle = String(name).toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().indexOf(needle) !== -1) return sheets[i];
  }
  return null;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 新流程：後端 /api/booking 過來的請求，只請我們上 PDF 拿 URL。
    // Sheet / bookings 寫入由後端 data.json 處理，這裡不重複寫。
    if (data.action === 'pdfOnly') {
      return handlePdfOnly(data);
    }

    // 舊流程（向下相容）：前台直接打 Apps Script 的完整提交
    Logger.log('[doPost] v2 start (with bookings sync)');
    if (!RESPONSE_SHEET_ID) {
      throw new Error('RESPONSE_SHEET_ID 尚未設定');
    }
    Logger.log('[doPost] payload keys: ' + Object.keys(data).join(',') +
               ' / eventDate=' + data.eventDate +
               ' / svc=' + data.svc +
               ' / vpKey=' + data.vpKey + ' / ppKey=' + data.ppKey +
               ' / vCams=' + data.vCams + ' / pCams=' + data.pCams);

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
    var sheet = findSheetLoose(ss, RESPONSE_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(RESPONSE_SHEET_NAME);
      sheet.appendRow(COLUMNS);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
    }
    var row = COLUMNS.map(function (k) { return data[k] != null ? data[k] : ''; });
    sheet.appendRow(row);

    // 3. 同步更新「設定 Sheet」的 bookings 分頁，讓前端下次讀 CSV 時看到新檔期
    //    任何錯誤都不阻擋表單寫入流程
    try {
      updateBookingsTab(data);
    } catch (bookErr) {
      Logger.log('updateBookingsTab failed: ' + bookErr);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, pdfUrl: pdfUrl }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 後端 /api/booking 用：只上 PDF、回 url，不寫 Sheet 也不更新 bookings
function handlePdfOnly(data) {
  try {
    Logger.log('[doPost] action=pdfOnly');
    var pdfUrl = '';
    if (data.pdfBase64 && PDF_FOLDER_ID) {
      var folder = DriveApp.getFolderById(PDF_FOLDER_ID);
      var bytes = Utilities.base64Decode(data.pdfBase64);
      var blob = Utilities.newBlob(bytes, 'application/pdf', data.pdfFilename || 'contract.pdf');
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfUrl = file.getUrl();
    }
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
  if (SETTINGS_SHEET_ID) {
    SpreadsheetApp.openById(SETTINGS_SHEET_ID).getName();
  }
  if (PDF_FOLDER_ID) {
    DriveApp.getFolderById(PDF_FOLDER_ID).getName();
  }
}

/**
 * 把這次送出的訂單彙整到 設定 Sheet 的 bookings 分頁。
 *
 * 規則：
 *  - 用 eventDate（YYYY-MM-DD）找該日 row
 *  - 找不到 → 直接 append 一列（依 BOOKINGS_COLUMNS 順序）
 *  - 找得到 → 增量更新 slots / camsUsed，leads 用逗號串接（已有就不重複）
 *  - service = 'video' 只動 video 三欄；'photo' 只動 photo 三欄；'both' 兩邊都動
 *  - vpKey / ppKey 為空字串或 'any' 不寫進 leads
 */
function updateBookingsTab(data) {
  if (!SETTINGS_SHEET_ID) {
    Logger.log('[bookings] skipped: SETTINGS_SHEET_ID is empty');
    return;
  }

  var date = String(data.eventDate || '').trim();
  if (!date) {
    Logger.log('[bookings] skipped: empty eventDate');
    return;
  }

  var svc = String(data.svc || '');
  var addV = svc === 'video' || svc === 'both';
  var addP = svc === 'photo' || svc === 'both';
  if (!addV && !addP) {
    Logger.log('[bookings] skipped: unknown svc=' + svc);
    return;
  }

  Logger.log('[bookings] open settings sheet ' + SETTINGS_SHEET_ID + ' / date=' + date + ' / svc=' + svc);
  var ss = SpreadsheetApp.openById(SETTINGS_SHEET_ID);
  var sh = findSheetLoose(ss, BOOKINGS_SHEET_NAME);
  if (!sh) {
    Logger.log('[bookings] tab not found, creating "' + BOOKINGS_SHEET_NAME + '"');
    sh = ss.insertSheet(BOOKINGS_SHEET_NAME);
    sh.appendRow(BOOKINGS_COLUMNS);
  } else {
    Logger.log('[bookings] using tab "' + sh.getName() + '"');
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(BOOKINGS_COLUMNS);
  }

  var lastRow = sh.getLastRow();
  var rowIdx = -1;
  if (lastRow >= 2) {
    var dates = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (String(dates[i][0]).trim() === date) {
        rowIdx = i + 2;
        break;
      }
    }
  }

  var vCams = Number(data.vCams || 0) || 0;
  var pCams = Number(data.pCams || 0) || 0;
  var vKey = String(data.vpKey || '').trim();
  var pKey = String(data.ppKey || '').trim();
  if (vKey === 'any') vKey = '';
  if (pKey === 'any') pKey = '';

  if (rowIdx < 0) {
    var newRow = [
      date,
      addV ? 1 : 0,
      addP ? 1 : 0,
      addV ? vCams : 0,
      addP ? pCams : 0,
      addV ? vKey : '',
      addP ? pKey : '',
      ''
    ];
    sh.appendRow(newRow);
    Logger.log('[bookings] appended new row: ' + JSON.stringify(newRow));
    return;
  }

  var range = sh.getRange(rowIdx, 1, 1, BOOKINGS_COLUMNS.length);
  var row = range.getValues()[0];
  var nz = function (v) { var n = Number(v); return isNaN(n) ? 0 : n; };
  var mergeLeads = function (existing, key) {
    var arr = String(existing || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (key && arr.indexOf(key) === -1) arr.push(key);
    return arr.join(',');
  };

  if (addV) {
    row[1] = nz(row[1]) + 1;
    row[3] = nz(row[3]) + vCams;
    row[5] = mergeLeads(row[5], vKey);
  }
  if (addP) {
    row[2] = nz(row[2]) + 1;
    row[4] = nz(row[4]) + pCams;
    row[6] = mergeLeads(row[6], pKey);
  }
  range.setValues([row]);
  Logger.log('[bookings] updated row ' + rowIdx + ': ' + JSON.stringify(row));
}
