/**
 * Backend Absensi English Club — Google Apps Script
 * -------------------------------------------------
 * Cara pakai: lihat README.md di root project.
 *
 * Sheet ini butuh satu tab bernama "Absensi" dengan header persis:
 * ID | Tanggal | Kegiatan | Catatan | Nama | Status | Timestamp
 */

const SHEET_NAME = "Absensi";

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ID", "Tanggal", "Kegiatan", "Catatan", "Nama", "Status", "Timestamp"]);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const data = values
    .filter(row => row.some(cell => cell !== "" && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  return jsonOutput_({ ok: true, data: data });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    const now = new Date();
    (payload.records || []).forEach(r => {
      sheet.appendRow([
        Utilities.getUuid(),
        payload.tanggal || "",
        payload.kegiatan || "",
        payload.catatan || "",
        r.nama || "",
        r.status || "",
        now,
      ]);
    });
    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
