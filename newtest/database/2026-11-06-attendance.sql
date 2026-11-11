CREATE TABLE IF NOT EXISTS `attendance_days` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `send_at` datetime NOT NULL,
  `fired_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_days_date_unique` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance_checks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `notified_at` timestamp NULL DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'pending',
  `device_session_id` varchar(64) NULL DEFAULT NULL,
  `reviewed_by` bigint unsigned NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_checks_user_id_date_unique` (`user_id`, `date`),
  KEY `attendance_checks_date_status_index` (`date`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`) SELECT '2026_11_06_000001_create_attendance_tables', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations` WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_06_000001_create_attendance_tables');
