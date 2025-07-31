CREATE TABLE "cashbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"is_inflow" integer NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"payment_method" text,
	"reference_type" text,
	"reference_id" uuid,
	"is_pending" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "lpo_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "lpo_due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "purchase_price_per_gallon" numeric(8, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "lpo_received_date" timestamp;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "invoice_date" timestamp;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cogs" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "gross_profit" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "vat_percentage" numeric(5, 2) DEFAULT '5.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "vat_amount" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "stock" ADD COLUMN "total_cost" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;