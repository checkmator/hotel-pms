-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'IN_DISPUTE');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'BANK_SLIP', 'CHECK', 'OTA_TRANSFER', 'VOUCHER', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ARSourceType" AS ENUM ('RESERVATION', 'EVENT', 'RESTAURANT', 'OTA', 'AGENCY', 'CORPORATE', 'WALK_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "trade_name" VARCHAR(150),
    "document" VARCHAR(20) NOT NULL,
    "document_type" VARCHAR(10) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "address" TEXT,
    "city" VARCHAR(80),
    "state" VARCHAR(2),
    "zip_code" VARCHAR(10),
    "bank_name" VARCHAR(60),
    "bank_branch" VARCHAR(10),
    "bank_account" VARCHAR(20),
    "pix_key" VARCHAR(100),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_name" VARCHAR(80) NOT NULL,
    "branch" VARCHAR(10) NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "description" VARCHAR(200) NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_due_date" DATE NOT NULL,
    "template_amount" DECIMAL(14,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "cost_center_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "payment_date" DATE,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "document_number" VARCHAR(50),
    "document_type" VARCHAR(30),
    "barcode" VARCHAR(100),
    "notes" TEXT,
    "iss_retained" DECIMAL(14,2),
    "irrf_retained" DECIMAL(14,2),
    "pis_retained" DECIMAL(14,2),
    "cofins_retained" DECIMAL(14,2),
    "csll_retained" DECIMAL(14,2),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_id" UUID,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "source_type" "ARSourceType" NOT NULL,
    "category_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "description" VARCHAR(500) NOT NULL,
    "reservation_id" UUID,
    "guest_id" UUID,
    "company_name" VARCHAR(150),
    "ota_name" VARCHAR(60),
    "ota_booking_ref" VARCHAR(60),
    "ota_commission_rate" DECIMAL(5,2),
    "ota_commission_amt" DECIMAL(14,2),
    "ota_net_amount" DECIMAL(14,2),
    "total_amount" DECIMAL(14,2) NOT NULL,
    "received_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "receipt_date" DATE,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "document_number" VARCHAR(50),
    "notes" TEXT,
    "is_city_ledger" BOOLEAN NOT NULL DEFAULT false,
    "city_ledger_ref" VARCHAR(50),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" SERIAL NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "payable_id" UUID,
    "receivable_id" UUID,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" "FinancialPaymentMethod" NOT NULL,
    "bank_account_id" UUID,
    "transaction_ref" VARCHAR(100),
    "notes" TEXT,
    "payable_id" UUID,
    "receivable_id" UUID,
    "installment_id" INTEGER,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "payable_id" UUID,
    "receivable_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" VARCHAR(30) NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "performed_by_id" UUID NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "payable_id" UUID,
    "receivable_id" UUID,

    CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_document_key" ON "suppliers"("document");
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");
CREATE UNIQUE INDEX "revenue_categories_name_key" ON "revenue_categories"("name");
CREATE UNIQUE INDEX "cost_centers_name_key" ON "cost_centers"("name");
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");
CREATE UNIQUE INDEX "accounts_payable_code_key" ON "accounts_payable"("code");
CREATE UNIQUE INDEX "accounts_receivable_code_key" ON "accounts_receivable"("code");
CREATE INDEX "accounts_payable_status_due_date_idx" ON "accounts_payable"("status", "due_date");
CREATE INDEX "accounts_payable_supplier_id_idx" ON "accounts_payable"("supplier_id");
CREATE INDEX "accounts_payable_cost_center_id_idx" ON "accounts_payable"("cost_center_id");
CREATE INDEX "accounts_receivable_status_due_date_idx" ON "accounts_receivable"("status", "due_date");
CREATE INDEX "accounts_receivable_source_type_idx" ON "accounts_receivable"("source_type");
CREATE INDEX "accounts_receivable_reservation_id_idx" ON "accounts_receivable"("reservation_id");
CREATE INDEX "financial_payments_payable_id_idx" ON "financial_payments"("payable_id");
CREATE INDEX "financial_payments_receivable_id_idx" ON "financial_payments"("receivable_id");
CREATE INDEX "financial_audit_logs_entity_type_entity_id_idx" ON "financial_audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "revenue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "installments" ADD CONSTRAINT "installments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installments" ADD CONSTRAINT "installments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_attachments" ADD CONSTRAINT "financial_attachments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_attachments" ADD CONSTRAINT "financial_attachments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_audit_logs" ADD CONSTRAINT "financial_audit_logs_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
