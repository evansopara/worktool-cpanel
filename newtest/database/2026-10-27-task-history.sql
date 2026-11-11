SET time_zone = '+01:00';

ALTER TABLE `tasks`
  ADD COLUMN `original_deadline` datetime NULL DEFAULT NULL,
  ADD COLUMN `original_estimate_minutes` int NULL DEFAULT NULL,
  ADD COLUMN `instructions_updated_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `lock_early_start` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `estimate_warned_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `estimate_reached_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `task_sessions`
  ADD COLUMN `started_early` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `clash_task_id` bigint unsigned NULL DEFAULT NULL;

CREATE TABLE `task_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `actor_id` bigint unsigned NULL DEFAULT NULL,
  `type` varchar(40) NOT NULL,
  `from` json NULL,
  `to` json NULL,
  `meta` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_events_task_id_created_at_index` (`task_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `task_reads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `instructions_version` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_reads_task_id_user_id_unique` (`task_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `estimate_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `requester_id` bigint unsigned NOT NULL,
  `requested_minutes` int NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `approved_minutes` int NULL DEFAULT NULL,
  `decision_reason` text NULL,
  `decided_by` bigint unsigned NULL DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estimate_requests_task_id_index` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE `tasks` SET `original_deadline` = `deadline` WHERE `deadline` IS NOT NULL;

UPDATE `tasks`
SET `original_estimate_minutes` = COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)
WHERE `working_hours` IS NOT NULL OR `working_minutes` IS NOT NULL;

UPDATE `tasks`
SET `estimate_warned_at` = NOW()
WHERE `status` <> 'completed'
  AND (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) > 0
  AND `time_spent` + IF(`is_timer_running` = 1 AND `timer_start_time` IS NOT NULL, TIMESTAMPDIFF(SECOND, `timer_start_time`, NOW()), 0)
      >= (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) * 60 * 0.8;

UPDATE `tasks`
SET `estimate_reached_at` = NOW()
WHERE `status` <> 'completed'
  AND (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) > 0
  AND `time_spent` + IF(`is_timer_running` = 1 AND `timer_start_time` IS NOT NULL, TIMESTAMPDIFF(SECOND, `timer_start_time`, NOW()), 0)
      >= (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) * 60;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_27_000001_add_task_history_and_rules', COALESCE(MAX(`batch`), 0) + 1
FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_10_27_000001_add_task_history_and_rules');
