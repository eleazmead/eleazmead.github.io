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

const CACHE_KEY = 'guestList_v1';
const ADMIN_HASH_CACHE_KEY = 'adminPasswordHash_v1';
const HASH_INDEX_GEN_KEY = 'hashIndexGen_v1';
const CACHE_TTL_SECONDS = 1800; // 30 minutes
const ADMIN_HASH_CACHE_TTL_SECONDS = 21600; // 6 hours (CacheService maximum)

// Paste your spreadsheet ID from the URL:
// https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
const SPREADSHEET_ID = 'REPLACE_WITH_SPREADSHEET_ID';

/**
 * Reads the GuestList sheet, with a 30-minute in-memory cache via CacheService.
 * Returns rows as string arrays (same shape as getValues() but all values stringified).
 * Call invalidateGuestListCache() after any write to force a fresh read.
 */
function getGuestListCached() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);

  // LockService prevents concurrent cache-miss reads from all hitting the sheet simultaneously.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Re-check cache after acquiring lock - another execution may have populated it.
    const hit2 = cache.get(CACHE_KEY);
    if (hit2) return JSON.parse(hit2);

    const values = SpreadsheetApp.openById(SPREADSHEET_ID)
      .getSheetByName('GuestList')
      .getDataRange()
      .getValues()
      .map(function(row) {
        return row.map(function(v) { return v === null || v === undefined ? '' : String(v); });
      });

    try {
      cache.put(CACHE_KEY, JSON.stringify(values), CACHE_TTL_SECONDS);
    } catch (_) {
      // Data exceeds 100KB cache limit - skip caching, serve fresh every time.
    }
    populateHashIndex(values);
    return values;
  } finally {
    lock.releaseLock();
  }
}

function invalidateGuestListCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY);
  cache.remove(HASH_INDEX_GEN_KEY);
  // Individual hash entries expire naturally - their gen prefix makes them unreachable.
}

// Writes one cache entry per hash (columns J/K/L) so getGuestByHash is a single cache.get().
// Uses a generation ID so invalidateGuestListCache() can atomically retire all entries at once
// by removing just the gen key - no need to enumerate or pattern-delete individual hash entries.
function populateHashIndex(values) {
  const cache = CacheService.getScriptCache();
  const gen = String(Date.now());
  const entries = {};
  entries[HASH_INDEX_GEN_KEY] = gen;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const payload = JSON.stringify({ row: row, rowIndex: i + 1 });
    [row[9], row[10], row[11]].forEach(function(h) {
      const key = String(h || '').trim().toLowerCase();
      if (key) entries['hash:' + gen + ':' + key] = payload;
    });
  }
  try {
    cache.putAll(entries, CACHE_TTL_SECONDS);
  } catch (_) {}
}

function getAdminPasswordHashCached() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(ADMIN_HASH_CACHE_KEY);
  if (hit) return hit;
  const hash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if (hash) cache.put(ADMIN_HASH_CACHE_KEY, hash, ADMIN_HASH_CACHE_TTL_SECONDS);
  return hash;
}

/**
 * Keep-warm. Set up a time-based trigger in the GAS editor:
 *   Triggers -> Add Trigger -> keepWarm -> Time-driven -> Minutes timer -> Every 5 minutes
 * This prevents the 5+ second cold-start delay guests would otherwise experience.
 * Also primes the CacheService so the first real request after idle hits the cache, not the sheet.
 */
function keepWarm() {
  getGuestListCached();
}

function onEdit(e) {
  if (e && e.source.getActiveSheet().getName() === 'GuestList') {
    invalidateGuestListCache();
  }
}

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
  CacheService.getScriptCache().put(ADMIN_HASH_CACHE_KEY, hash, ADMIN_HASH_CACHE_TTL_SECONDS);
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

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.action === 'getGuestList') {
      const values = getGuestListCached();
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
      // Fast path: check the per-hash index populated by populateHashIndex().
      const cache = CacheService.getScriptCache();
      const gen = cache.get(HASH_INDEX_GEN_KEY);
      const indexed = gen ? cache.get('hash:' + gen + ':' + hash) : null;
      if (indexed) {
        const data = JSON.parse(indexed);
        return ContentService.createTextOutput(
          JSON.stringify({ found: true, row: data.row, rowIndex: data.rowIndex }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      // Slow path: index was cold or invalidated - reload sheet (repopulates index) then retry.
      const values = getGuestListCached();
      const gen2 = cache.get(HASH_INDEX_GEN_KEY);
      const indexed2 = gen2 ? cache.get('hash:' + gen2 + ':' + hash) : null;
      if (indexed2) {
        const data = JSON.parse(indexed2);
        return ContentService.createTextOutput(
          JSON.stringify({ found: true, row: data.row, rowIndex: data.rowIndex }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      // Final fallback: linear scan in case putAll failed and hash index was never populated.
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const j = String(row[9] || '').trim().toLowerCase();
        const k = String(row[10] || '').trim().toLowerCase();
        const l = String(row[11] || '').trim().toLowerCase();
        if ((j && j === hash) || (k && k === hash) || (l && l === hash)) {
          return ContentService.createTextOutput(
            JSON.stringify({ found: true, row: row, rowIndex: i + 1 }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ found: false })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'clearCache') {
      const stored = getAdminPasswordHashCached();
      const authorized = stored !== null && stored === payload.passwordHash;
      if (!authorized) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'unauthorized' })).setMimeType(
          ContentService.MimeType.JSON,
        );
      }
      invalidateGuestListCache();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'verifyAdmin') {
      const stored = getAdminPasswordHashCached();
      const authorized = stored !== null && stored === payload.passwordHash;
      return ContentService.createTextOutput(JSON.stringify({ authorized })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'trackAccess') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const guestSheet = ss.getSheetByName('GuestList');
      const row = payload.rowIndex;
      guestSheet.getRange(row, 17).setValue(payload.ipAddress);    // Q - IPAddress
      guestSheet.getRange(row, 18).setValue(payload.lastAccessedAt); // R - LastAccessedAt
      guestSheet.getRange(row, 19).setValue(payload.userAgent);    // S - UserAgent

      const logSheet = ss.getSheetByName('Log');
      const event =
        'IP: [' +
        payload.ipAddress +
        '], LastAccessed: [' +
        payload.lastAccessedAt +
        '], UserAgent: [' +
        payload.userAgent +
        ']';
      logSheet.appendRow([Utilities.getUuid(), payload.name, event, 0, payload.lastAccessedAt]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(
        ContentService.MimeType.JSON,
      );
    }

    if (payload.action === 'updateRsvp') {
      invalidateGuestListCache();
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
