-- =====================================================================
-- STF Group ERP - Upgrade: fleet registration dates, bank account phone
-- expiry, bank document / employee message tables and speed indexes.
-- ---------------------------------------------------------------------
-- Run this ONCE on an existing live database. Every statement is guarded,
-- so re-running it is safe and no live data is touched.
--
-- What it does:
--   1. Creates `bank_documents` and `employee_messages` if they are missing
--   2. Adds bank_documents.account_phone_expiry_date
--   3. Adds vehicles.issue_date, vehicles.expiry_date, vehicles.renew_date
--   4. Adds indexes that keep list screens fast with 300+ employees
--   5. Marks the matching Laravel migrations as applied
--
-- Take a database backup before running this.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = "+03:00";

-- ---------------------------------------------------------------------
-- 1. Bank documents + employee messages (no-op when they already exist)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bank_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `company_id` BIGINT UNSIGNED NOT NULL,
    `employee_id` BIGINT UNSIGNED NOT NULL,
    `employee_name` VARCHAR(255) NOT NULL,
    `employee_code` VARCHAR(60) NULL,
    `account_phone` VARCHAR(40) NULL,
    `account_phone_owner` VARCHAR(20) NOT NULL DEFAULT 'company',
    `account_phone_expiry_date` DATE NULL,
    `personal_phone` VARCHAR(40) NULL,
    `nationality` VARCHAR(100) NULL,
    `iban_number` VARCHAR(80) NULL,
    `bank_card_expiry_date` DATE NULL,
    `bank_file_id` BIGINT UNSIGNED NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    `deleted_at` TIMESTAMP NULL,
    KEY `bank_documents_company_id_employee_id_index` (`company_id`, `employee_id`),
    KEY `bank_documents_bank_card_expiry_date_index` (`bank_card_expiry_date`),
    CONSTRAINT `bank_documents_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
    CONSTRAINT `bank_documents_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `bank_documents_bank_file_id_foreign` FOREIGN KEY (`bank_file_id`) REFERENCES `stored_files` (`id`) ON DELETE SET NULL,
    CONSTRAINT `bank_documents_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `bank_documents_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `company_id` BIGINT UNSIGNED NOT NULL,
    `employee_id` BIGINT UNSIGNED NOT NULL,
    `employee_name` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(255) NULL,
    `message_body` TEXT NOT NULL,
    `channel` VARCHAR(20) NOT NULL DEFAULT 'internal',
    `status` VARCHAR(20) NOT NULL DEFAULT 'sent',
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP NULL,
    KEY `employee_messages_company_id_employee_id_created_at_index` (`company_id`, `employee_id`, `created_at`),
    CONSTRAINT `employee_messages_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
    CONSTRAINT `employee_messages_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `employee_messages_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. bank_documents.account_phone_expiry_date
-- ---------------------------------------------------------------------
SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bank_documents'
      AND COLUMN_NAME = 'account_phone_expiry_date'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `bank_documents` ADD COLUMN `account_phone_expiry_date` DATE NULL AFTER `account_phone_owner`',
    'SELECT "bank_documents.account_phone_expiry_date already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 3. vehicles.issue_date / expiry_date / renew_date
-- ---------------------------------------------------------------------
SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'issue_date'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `vehicles` ADD COLUMN `issue_date` DATE NULL AFTER `registration_date`',
    'SELECT "vehicles.issue_date already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'expiry_date'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `vehicles` ADD COLUMN `expiry_date` DATE NULL AFTER `issue_date`',
    'SELECT "vehicles.expiry_date already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'renew_date'
);
SET @sql := IF(@column_exists = 0,
    'ALTER TABLE `vehicles` ADD COLUMN `renew_date` DATE NULL AFTER `expiry_date`',
    'SELECT "vehicles.renew_date already exists" AS notice'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 4. Performance indexes (guarded, so re-running is safe)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `stf_add_index`;
DELIMITER $$
CREATE PROCEDURE `stf_add_index`(
    IN in_table VARCHAR(64), IN in_index VARCHAR(64), IN in_columns VARCHAR(255)
)
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table AND INDEX_NAME = in_index) = 0
       AND (SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_table) = 1
    THEN
        SET @ddl := CONCAT('ALTER TABLE `', in_table, '` ADD INDEX `', in_index, '` (', in_columns, ')');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL `stf_add_index`('vehicles', 'vehicles_company_id_expiry_date_index', '`company_id`, `expiry_date`');
CALL `stf_add_index`('employees', 'employees_company_id_full_name_index', '`company_id`, `full_name`');
CALL `stf_add_index`('employees', 'employees_employee_code_index', '`employee_code`');
CALL `stf_add_index`('documents', 'documents_owner_type_owner_id_index', '`owner_type`, `owner_id`');
CALL `stf_add_index`('documents', 'documents_company_id_expiry_date_index', '`company_id`, `expiry_date`');
CALL `stf_add_index`('bank_documents', 'bank_documents_employee_name_index', '`employee_name`');
CALL `stf_add_index`('bank_documents', 'bank_documents_account_phone_expiry_date_index', '`account_phone_expiry_date`');

DROP PROCEDURE IF EXISTS `stf_add_index`;

-- ---------------------------------------------------------------------
-- 5. Mark the Laravel migrations as applied
-- ---------------------------------------------------------------------
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_17_100000_create_bank_documents_and_messages', COALESCE((SELECT MAX(b.batch) FROM (SELECT batch FROM `migrations`) b), 0) + 1
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT migration FROM `migrations`) m
    WHERE m.migration = '2026_08_17_100000_create_bank_documents_and_messages'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_090000_add_fleet_registration_and_bank_phone_expiry', COALESCE((SELECT MAX(b.batch) FROM (SELECT batch FROM `migrations`) b), 0) + 1
WHERE NOT EXISTS (
    SELECT 1 FROM (SELECT migration FROM `migrations`) m
    WHERE m.migration = '2026_08_18_090000_add_fleet_registration_and_bank_phone_expiry'
);

SELECT 'Upgrade complete: fleet dates, account phone expiry and speed indexes are in place.' AS result;
