-- =====================================================================
-- STF Group ERP - Upgrade an EXISTING database (keeps all live data)
-- ---------------------------------------------------------------------
-- Run this ONCE on a database that was created from the previous
-- 4-company release. It is safe to re-run: every statement is guarded.
--
-- What it does:
--   1. Adds document_types.alert_lead_days (QID 15, Passport 90, Istimara 30)
--   2. Adds vehicles.vehicle_name and backfills it from make + model
--   3. Renames the four existing companies to their official names
--   4. Adds the fifth company: TRUST AND FIRST TRADING (GARAGE)
--   5. Moves "Labour Contract" from a company document to a staff document
--   6. Grants the Super Admin access to the new company
--   7. Marks the Laravel migration as applied
--
-- Take a database backup before running this.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = "+03:00";

-- ---------------------------------------------------------------------
-- 1. document_types.alert_lead_days
-- ---------------------------------------------------------------------
SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'document_types'
      AND COLUMN_NAME = 'alert_lead_days'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `document_types` ADD COLUMN `alert_lead_days` SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER `custom_reminder_days`',
    'SELECT "document_types.alert_lead_days already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `document_types` SET `alert_lead_days` = 15 WHERE `code` = 'qid';
UPDATE `document_types` SET `alert_lead_days` = 90 WHERE `code` = 'passport';
UPDATE `document_types` SET `alert_lead_days` = 30 WHERE `code` = 'istimara';

-- ---------------------------------------------------------------------
-- 2. vehicles.vehicle_name
-- ---------------------------------------------------------------------
SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'vehicles'
      AND COLUMN_NAME = 'vehicle_name'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `vehicles` ADD COLUMN `vehicle_name` VARCHAR(255) NULL AFTER `internal_vehicle_id`',
    'SELECT "vehicles.vehicle_name already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `vehicles`
SET `vehicle_name` = NULLIF(TRIM(CONCAT(COALESCE(`make`, ''), ' ', COALESCE(`model`, ''))), '')
WHERE `vehicle_name` IS NULL OR `vehicle_name` = '';

UPDATE `vehicles`
SET `vehicle_name` = `vehicle_number`
WHERE `vehicle_name` IS NULL OR `vehicle_name` = '';

-- ---------------------------------------------------------------------
-- 3. Official company names (matched on the old code, data preserved)
-- ---------------------------------------------------------------------
UPDATE `companies` SET `code` = 'SAS', `name` = 'SEAF AL SAFER LIMOUSINE'
    WHERE `code` = 'TL';
UPDATE `companies` SET `code` = 'TFC', `name` = 'TRUST AND FIRST TRADING AND CONTRACTING'
    WHERE `code` = 'TC';
UPDATE `companies` SET `code` = 'TFD', `name` = 'TRUST AND FIRST DELIVERY SERVICES'
    WHERE `code` = 'TD';
UPDATE `companies` SET `code` = 'FST', `name` = 'FLY SAFE TRAVELS AND TOURS'
    WHERE `code` = 'FS';

-- ---------------------------------------------------------------------
-- 4. Fifth company: TRUST AND FIRST TRADING (GARAGE)
-- ---------------------------------------------------------------------
INSERT INTO `companies`
    (`code`, `name`, `city`, `country`, `is_active`, `reminder_days`, `created_at`, `updated_at`)
SELECT 'TFG', 'TRUST AND FIRST TRADING (GARAGE)', 'Doha', 'Qatar', 1,
       '[30,15,10,7,3,1,0]', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM (SELECT * FROM `companies`) AS c WHERE c.`code` = 'TFG');

-- ---------------------------------------------------------------------
-- 5. Labour Contract becomes a staff (employee) document
-- ---------------------------------------------------------------------
INSERT INTO `document_types`
    (`name`, `code`, `owner_type`, `document_number_required`, `issue_date_required`,
     `expiry_date_required`, `file_required`, `reminder_enabled`, `custom_reminder_days`,
     `alert_lead_days`, `is_active`, `created_at`, `updated_at`)
SELECT 'Labour Contract', 'labour-contract', 'employee', 0, 0, 0, 0, 0,
       '[30,15,10,7,3,1,0]', 30, 1, NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT * FROM `document_types`) AS t WHERE t.`code` = 'labour-contract'
);

-- Only flip the owner type when no company-owned labour contract exists yet,
-- so historical company records are never orphaned.
UPDATE `document_types`
SET `owner_type` = 'employee'
WHERE `code` = 'labour-contract'
  AND `owner_type` = 'company'
  AND `id` NOT IN (
      SELECT `document_type_id` FROM (
          SELECT DISTINCT `document_type_id` FROM `documents` WHERE `owner_type` = 'company'
      ) AS used_types
  );

-- ---------------------------------------------------------------------
-- 6. Super Admin gains access to every company
-- ---------------------------------------------------------------------
INSERT INTO `company_user` (`company_id`, `user_id`, `is_primary`, `created_at`, `updated_at`)
SELECT c.`id`, u.`id`, 0, NOW(), NOW()
FROM `companies` c
CROSS JOIN `users` u
LEFT JOIN (SELECT `company_id`, `user_id` FROM `company_user`) AS cu
       ON cu.`company_id` = c.`id` AND cu.`user_id` = u.`id`
WHERE u.`all_companies` = 1
  AND cu.`company_id` IS NULL;

-- ---------------------------------------------------------------------
-- 7. Record the Laravel migration
-- ---------------------------------------------------------------------
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_17_090000_add_stf_group_module_columns',
       (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM (SELECT * FROM `migrations`) AS b)
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT * FROM `migrations`) AS m
    WHERE m.`migration` = '2026_08_17_090000_add_stf_group_module_columns'
);

-- ---------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------
SELECT `id`, `code`, `name` FROM `companies` ORDER BY `id`;
SELECT `code`, `owner_type`, `alert_lead_days` FROM `document_types`
WHERE `code` IN ('qid', 'passport', 'istimara', 'labour-contract') ORDER BY `code`;
