CREATE TABLE `budget_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`baseMonthlyBudget` decimal(12,2) NOT NULL DEFAULT '0.00',
	`investmentRate` decimal(5,4) NOT NULL DEFAULT '0.1500',
	`annualReturnRate` decimal(5,4) NOT NULL DEFAULT '0.1500',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_settings_user_year_month` UNIQUE(`userId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `credit_card_monthly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`creditCardId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`isPaid` boolean NOT NULL DEFAULT false,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_card_monthly_id` PRIMARY KEY(`id`),
	CONSTRAINT `credit_card_monthly_card_year_month` UNIQUE(`creditCardId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`lastFourDigits` varchar(4),
	`color` varchar(7) NOT NULL DEFAULT '#6366f1',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`targetAmount` decimal(12,2) NOT NULL,
	`currentAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`targetDate` timestamp,
	`achievedDate` timestamp,
	`period` varchar(64),
	`isAchieved` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_expense_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixed_expense_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixed_expense_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixed_expense_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `fixed_expense_entries_cat_year_month` UNIQUE(`categoryId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `income_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `income_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `income_entries_source_year_month` UNIQUE(`sourceId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `income_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('fixed','variable','extra') NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `income_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installment_expense_months` (
	`id` int AUTO_INCREMENT NOT NULL,
	`installmentExpenseId` int NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`installmentNumber` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`isPaid` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `installment_expense_months_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installment_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`installmentAmount` decimal(12,2) NOT NULL,
	`totalInstallments` int NOT NULL,
	`paidInstallments` int NOT NULL DEFAULT 0,
	`startYear` int NOT NULL,
	`startMonth` int NOT NULL,
	`creditCardId` int,
	`category` enum('lazer','alimentacao','transporte','saude','outros') NOT NULL DEFAULT 'outros',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installment_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `planned_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`paymentType` enum('credit_card','cash') NOT NULL,
	`category` enum('lazer','alimentacao','transporte','saude','outros') NOT NULL DEFAULT 'outros',
	`creditCardId` int,
	`transactionDate` timestamp NOT NULL,
	`isPaid` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `planned_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pluggy_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pluggyItemId` varchar(128) NOT NULL,
	`connectorName` varchar(255),
	`connectorId` int,
	`status` enum('updated','updating','waiting_user_input','login_error','outdated','error') NOT NULL DEFAULT 'updated',
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pluggy_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `pluggy_connections_pluggyItemId_unique` UNIQUE(`pluggyItemId`)
);
--> statement-breakpoint
CREATE TABLE `pluggy_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pluggyTransactionId` varchar(128) NOT NULL,
	`pluggyItemId` varchar(128) NOT NULL,
	`accountId` varchar(128),
	`description` varchar(500) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`type` enum('debit','credit') NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`category` enum('lazer','alimentacao','transporte','saude','outros','receita','fixo','investimento','nao_categorizado') NOT NULL DEFAULT 'nao_categorizado',
	`isReviewed` boolean NOT NULL DEFAULT false,
	`linkedExpenseId` int,
	`linkedExpenseType` enum('qol','planned','installment','fixed'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pluggy_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pluggy_transactions_pluggyTransactionId_unique` UNIQUE(`pluggyTransactionId`)
);
--> statement-breakpoint
CREATE TABLE `qol_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`category` enum('lazer','alimentacao','transporte','saude','outros') NOT NULL,
	`paymentType` enum('credit_card','cash') NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`creditCardId` int,
	`transactionDate` timestamp NOT NULL,
	`pluggyTransactionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qol_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `credit_cards_user_idx` ON `credit_cards` (`userId`);--> statement-breakpoint
CREATE INDEX `financial_goals_user_idx` ON `financial_goals` (`userId`);--> statement-breakpoint
CREATE INDEX `fixed_expense_categories_user_idx` ON `fixed_expense_categories` (`userId`);--> statement-breakpoint
CREATE INDEX `fixed_expense_entries_user_year_month` ON `fixed_expense_entries` (`userId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `income_entries_user_year_month` ON `income_entries` (`userId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `income_sources_user_idx` ON `income_sources` (`userId`);--> statement-breakpoint
CREATE INDEX `installment_months_expense_year_month` ON `installment_expense_months` (`installmentExpenseId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `installment_months_user_year_month` ON `installment_expense_months` (`userId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `installment_expenses_user_idx` ON `installment_expenses` (`userId`);--> statement-breakpoint
CREATE INDEX `planned_expenses_user_year_month` ON `planned_expenses` (`userId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `pluggy_connections_user_idx` ON `pluggy_connections` (`userId`);--> statement-breakpoint
CREATE INDEX `pluggy_transactions_user_idx` ON `pluggy_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `pluggy_transactions_user_date` ON `pluggy_transactions` (`userId`,`transactionDate`);--> statement-breakpoint
CREATE INDEX `qol_expenses_user_year_month` ON `qol_expenses` (`userId`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `qol_expenses_user_category` ON `qol_expenses` (`userId`,`category`);