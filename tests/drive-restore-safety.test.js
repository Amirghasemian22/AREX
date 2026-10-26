'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const backupSafety = require('../js/core/backup-safety.js');
const html = fs.readFileSync('index.html', 'utf8');

test('Google Drive restore validates downloaded backup before any replacement write', () => {
  const start = html.indexOf('async function restoreDriveBackupSafely(');
  const end = html.indexOf('\nasync function driveLoginSyncSafely()', start);
  assert.ok(start >= 0 && end > start, 'shared safe Drive restore helper should exist');
  const helper = html.slice(start, end);
  const validate = helper.indexOf('AREXCore.backupSafety.validateEnvelope');
  const replace = helper.indexOf('storage.replaceAllData(data)');
  assert.ok(validate >= 0 && replace > validate, 'validation must happen before database replacement');
  assert.match(helper, /makeRestoreSnapshot\(currentData\)/);
  assert.match(helper, /backup:pre-cloud-restore:/);
  assert.match(helper, /delete data\.driveFileId/);
});

test('all Google Drive restore entry points use the validated restore helper', () => {
  assert.match(html, /if\(useCloud\)\{const data=await driveDownloadBackup\(latest\.id\);await restoreDriveBackupSafely\(data\)/);
  assert.match(html, /async function driveRestoreFrom\(fileId\)[\s\S]{0,250}await restoreDriveBackupSafely\(data\)/);
  assert.doesNotMatch(html, /if\(useCloud\)[\s\S]{0,180}storage\.putAllData\(data\)/);
});

test('backup validation rejects oversized, array, and unsafe-key Drive payloads', () => {
  assert.equal(backupSafety.validateEnvelope([], 2).ok, false);
  assert.equal(backupSafety.validateEnvelope({ data: { constructor: 'unsafe' } }, 40).ok, false);
  assert.ok(backupSafety.validateEnvelope({ trades: '[]' }, backupSafety.MAX_BYTES + 1).errors.includes('backup_too_large'));
});

test('Drive downloads reject HTTP errors and API error objects instead of treating them as backups', () => {
  assert.match(html, /async function driveDownloadBackup\(fileId\)[\s\S]{0,500}if\(!res\.ok\)throw new Error/);
  assert.match(html, /if\(!data\|\|typeof data!=='object'\|\|Array\.isArray\(data\)\|\|data\.error\)throw new Error/);
  const start = html.indexOf('async function restoreDriveBackupSafely(');
  const end = html.indexOf('\nasync function driveLoginSyncSafely()', start);
  assert.match(html.slice(start, end), /Object\.keys\(data\)\.length===0/);
});

test('restored cloud settings are loaded before recording the sync timestamp', () => {
  const loginStart = html.indexOf('async function driveLoginSyncSafely()');
  const loginEnd = html.indexOf('\n/* ---- high-level sync actions ---- */', loginStart);
  const login = html.slice(loginStart, loginEnd);
  assert.ok(login.indexOf('await loadAll()') < login.indexOf("state.lastSyncAt=latest.modifiedTime"));
  const restoreStart = html.indexOf('async function driveRestoreFrom(fileId)');
  const restoreEnd = html.indexOf('\nfunction driveResolveConflictPull()', restoreStart);
  const restore = html.slice(restoreStart, restoreEnd);
  assert.ok(restore.indexOf('await loadAll()') < restore.indexOf('state.lastSyncAt=new Date()'));
  assert.doesNotMatch(restore, /storage\.set\('settings',buildSettingsPayload\(\)\)/);
  assert.match(restore, /arexStorageBridge\.flush/);
});
