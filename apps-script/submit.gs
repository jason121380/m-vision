/**
 * M 視覺 — 契約 PDF 上傳到 Drive
 *
 * 後端 /api/booking 收到客戶送單後，server-side 打這個 endpoint，
 * 把 base64 PDF 轉成檔案丟進指定 Drive 資料夾、回傳公開 URL，
 * 後端再把 URL 寫進 data.json 的 submissions。
 *
 * Sheet 寫入 / bookings 累加都改由後端 data.json 處理，這支 script
 * 唯一職責就是「Drive 上傳」一件事。
 *
 * 部署：
 *   1. PDF_FOLDER_ID 填好（Drive 資料夾網址 /folders/ 後面那段）
 *   2. 工具列 ▶ 執行 → 選 init → 確認授權 DriveApp
 *   3. 部署 → 網路應用程式（執行身分：我，存取：所有人）
 *   4. 取得 .../exec URL，設給後端的 PDF_UPLOAD_ENDPOINT 環境變數
 *
 * 之後改 code 一定要「管理部署作業 → ✏️ → 版本：新版本 → 部署」
 * 才會生效，URL 不變。
 */

var PDF_FOLDER_ID = '1os5QkoQ3x1Mzp0vcE45brJ9ICscQyCqd';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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

// 首次授權：執行一次讓 Apps Script 觸發 OAuth 同意畫面
function init() {
  if (PDF_FOLDER_ID) {
    DriveApp.getFolderById(PDF_FOLDER_ID).getName();
  }
}
