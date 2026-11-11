ALTER TABLE `tasks`
  ADD COLUMN IF NOT EXISTS `requires_links` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `submission_links` json NULL DEFAULT NULL;

INSERT INTO `migrations` (`migration`, `batch`) SELECT '2026_11_11_000001_add_submission_links_to_tasks', COALESCE(MAX(`batch`), 0) + 1 FROM `migrations` WHERE NOT EXISTS (SELECT 1 FROM `migrations` WHERE `migration` = '2026_11_11_000001_add_submission_links_to_tasks');
