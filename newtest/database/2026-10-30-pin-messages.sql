ALTER TABLE `direct_messages` ADD COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE `project_messages` ADD COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT 0;
INSERT INTO `migrations` (`migration`, `batch`) SELECT '2026_10_30_000001_add_is_pinned_to_messages', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`;
