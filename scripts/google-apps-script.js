/**
 * Google Apps Script — EleazMead RSVP Web App
 *
 * HOW TO DEPLOY:
 * 1. Open the Google Sheet → Extensions → Apps Script
 * 2. Replace all code with this file's contents
 * 3. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL and paste it into:
 *    src/app/config/sheets.config.ts → gasWebAppUrl
 *
 * HOW TO UPDATE:
 * 1. Edit this file in the repo
 * 2. Copy the updated contents into the Apps Script editor
 * 3. Deploy → New deployment (always a new deployment, not "Manage")
 * 4. Update gasWebAppUrl in sheets.config.ts if the URL changed
 *
 * SHEET COLUMN MAPPING (GuestList tab):
 *   A (1) — FullName
 *   B (2) — Guest1Name
 *   C (3) — Guest2Name
 *   D (4) — RSVP_Raw       (JSON)
 *   E (5) — RSVPTotal      (attending count, computed from merged entries)
 *   F (6) — RSVPBeef_Count
 *   G (7) — RSVPFish_Count
 *   H (8) — RSVPSubmittedAt
 *   I (9) — RSVPSubmittedBy
 *   J (10) — FullNameHash_MD5
 *   K (11) — Guest1FullName_MD5
 *   L (12) — Guest2FullName_MD5
 *   M (13) — LetterAddress
 *   N (14) — LetterMessage
 *   O (15) — LetterShowForAll
 *   P (16) — LetterSignedBy
 *
 * LOG COLUMN MAPPING (Log tab):
 *   A (1) — id
 *   B (2) — name
 *   C (3) — event
 *   D (4) — count
 *   E (5) — createdAt
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Admin')
    .addItem('Set admin password', 'setupAdminPasswordHash')
    .addToUi();
}

/**
 * Triggered from the Admin menu in the Google Sheet (not the Apps Script editor).
 * Refresh the sheet after saving this script to see the Admin menu appear.
 */
function setupAdminPasswordHash() {
  const password = Browser.inputBox('Admin Setup', 'Enter the admin password to hash and store:', Browser.Buttons.OK_CANCEL);
  if (!password || password === 'cancel') {
    Logger.log('Setup cancelled.');
    return;
  }
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8,
  )
    .map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))
    .join('');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hash);
  Logger.log('Stored ADMIN_PASSWORD_HASH: ' + hash);
  Browser.msgBox('Done', 'Admin password hash stored successfully.', Browser.Buttons.OK);
}

function generateMd5Hash(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, value, Utilities.Charset.UTF_8)
    .map((byte) => {
      const unsignedByte = byte < 0 ? byte + 256 : byte;
      return unsignedByte.toString(16).padStart(2, '0');
    })
    .join('');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.action === 'getGuestList') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('GuestList');
      const values = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ values })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'getGuestByHash') {
      const hash = String(payload.hash || '').trim().toLowerCase();
      if (!hash) {
        return ContentService.createTextOutput(JSON.stringify({ found: false })).setMimeType(
          ContentService.MimeType.JSON,
        );
      }
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('GuestList');
      const values = sheet.getDataRange().getValues();
      // Skip header row (index 0), search columns J(9), K(10), L(11)
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const j = String(row[9] || '').trim().toLowerCase();
        const k = String(row[10] || '').trim().toLowerCase();
        const l = String(row[11] || '').trim().toLowerCase();
        if ((j && j === hash) || (k && k === hash) || (l && l === hash)) {
          return ContentService.createTextOutput(
            JSON.stringify({ found: true, row, rowIndex: i + 1 }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ found: false })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'verifyAdmin') {
      const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
      const authorized = stored !== null && stored === payload.passwordHash;
      return ContentService.createTextOutput(JSON.stringify({ authorized })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'updateRsvp') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const guestSheet = ss.getSheetByName('GuestList');
      const row = payload.rowIndex;

      // Compute grand total from merged rsvpRaw (source of truth)
      const allEntries = Object.values(JSON.parse(payload.rsvpRaw)).flat();
      const grandTotal = allEntries.filter((e) => e.RSVP).length;

      guestSheet.getRange(row, 4).setValue(payload.rsvpRaw); // D — RSVP_Raw
      guestSheet.getRange(row, 5).setValue(grandTotal); // E — RSVPTotal
      guestSheet.getRange(row, 6).setValue(payload.rsvpBeefCount); // F — RSVPBeef_Count
      guestSheet.getRange(row, 7).setValue(payload.rsvpFishCount); // G — RSVPFish_Count
      guestSheet.getRange(row, 8).setValue(payload.rsvpSubmittedAt); // H — RSVPSubmittedAt
      guestSheet.getRange(row, 9).setValue(payload.rsvpSubmittedBy); // I — RSVPSubmittedBy

      // Append log row
      const logSheet = ss.getSheetByName('Log');
      const log = payload.log;
      logSheet.appendRow([log.id, log.name, log.event, log.count, log.createdAt]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'unknown_action' }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
