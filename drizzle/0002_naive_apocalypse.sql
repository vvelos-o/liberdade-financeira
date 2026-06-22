CREATE TABLE `category_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pattern` varchar(500) NOT NULL,
	`category` enum('lazer','alimentacao','transporte','saude','outros','receita','fixo','investimento','nao_categorizado') NOT NULL,
	`confidence` int NOT NULL DEFAULT 1,
	`source` enum('user_correction','manual') NOT NULL DEFAULT 'user_correction',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `category_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `category_rules_user_idx` ON `category_rules` (`userId`);--> statement-breakpoint
CREATE INDEX `category_rules_pattern_idx` ON `category_rules` (`userId`,`pattern`);