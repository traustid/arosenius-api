/*
 * SQL model for Arosenius.
 *
 * WARNING: Executing this will drop existing data.
 */

DROP TABLE IF EXISTS `artwork`;
CREATE TABLE `artwork` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(20),
  `title` varchar(200),
  `description` text,
  `museum` varchar(100),
  `archive_physloc` varchar(50),
  `archive_title` varchar(100)
);

DROP TABLE IF EXISTS `keyword`;
CREATE TABLE `keyword` (
	`id` int(10) unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
	`artwork` int(10) unsigned NOT NULL,
	`type` varchar(50) NOT NULL,
	`name` varchar(50) NOT NULL,
	KEY (artwork, type, name)
);