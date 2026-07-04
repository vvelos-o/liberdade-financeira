CREATE TABLE `monthly_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`content` text NOT NULL,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_insights_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthly_insights_user_year_month` UNIQUE(`userId`,`year`,`month`)
);
--> statement-breakpoint
ALTER TABLE `category_rules` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos','receita','fixo','investimento','nao_categorizado') NOT NULL;--> statement-breakpoint
ALTER TABLE `installment_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL DEFAULT 'outros';--> statement-breakpoint
ALTER TABLE `planned_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL DEFAULT 'outros';--> statement-breakpoint
ALTER TABLE `pluggy_transactions` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos','receita','fixo','investimento','nao_categorizado') NOT NULL DEFAULT 'nao_categorizado';--> statement-breakpoint
ALTER TABLE `qol_expenses` MODIFY COLUMN `category` enum('lazer','alimentacao','transporte','saude','outros','pessoal','imprevistos') NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `investmentTarget` decimal(12,2) DEFAULT '1000.00';--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `categoryPercentages` json;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `goalType` enum('commitment','optional') DEFAULT 'optional' NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_goals` ADD `suggestedMonthlyAmount` decimal(12,2);