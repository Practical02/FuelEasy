CREATE TABLE "account_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_heads_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "cashbook" ADD COLUMN "account_head_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "cashbook" ADD CONSTRAINT "cashbook_account_head_id_account_heads_id_fk" FOREIGN KEY ("account_head_id") REFERENCES "public"."account_heads"("id") ON DELETE no action ON UPDATE no action;