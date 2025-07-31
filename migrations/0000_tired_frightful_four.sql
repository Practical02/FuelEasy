CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_person" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'Generated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_date" timestamp NOT NULL,
	"amount_received" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"cheque_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"sale_date" timestamp NOT NULL,
	"quantity_gallons" numeric(10, 2) NOT NULL,
	"sale_price_per_gallon" numeric(8, 3) NOT NULL,
	"lpo_number" text NOT NULL,
	"lpo_due_date" timestamp NOT NULL,
	"invoice_date" timestamp,
	"sale_status" text DEFAULT 'Pending LPO' NOT NULL,
	"vat_percentage" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"quantity_gallons" numeric(10, 2) NOT NULL,
	"purchase_price_per_gallon" numeric(8, 3) NOT NULL,
	"vat_percentage" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;