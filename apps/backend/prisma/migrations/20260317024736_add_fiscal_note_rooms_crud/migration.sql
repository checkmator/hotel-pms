-- CreateEnum
CREATE TYPE "FiscalNoteStatus" AS ENUM ('pending', 'emitted', 'cancelled', 'error');

-- CreateTable
CREATE TABLE "fiscal_notes" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "prestador_cnpj" VARCHAR(20) NOT NULL,
    "prestador_razao_social" VARCHAR(150) NOT NULL,
    "prestador_im" VARCHAR(20),
    "prestador_municipio" VARCHAR(80) NOT NULL,
    "tomador_documento" VARCHAR(20) NOT NULL,
    "tomador_nome" VARCHAR(150) NOT NULL,
    "tomador_email" VARCHAR(255),
    "discriminacao" TEXT NOT NULL,
    "codigo_servico" VARCHAR(10) NOT NULL DEFAULT '0107',
    "valor_servicos" DECIMAL(10,2) NOT NULL,
    "valor_deducoes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "base_calculo" DECIMAL(10,2) NOT NULL,
    "aliquota_iss" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "valor_iss" DECIMAL(10,2) NOT NULL,
    "valor_liquido" DECIMAL(10,2) NOT NULL,
    "status" "FiscalNoteStatus" NOT NULL DEFAULT 'pending',
    "numero" VARCHAR(20),
    "serie" VARCHAR(5) NOT NULL DEFAULT '1',
    "protocolo" VARCHAR(100),
    "codigo_verificacao" VARCHAR(50),
    "motivo_cancelamento" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "fiscal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_notes_reservation_id_idx" ON "fiscal_notes"("reservation_id");

-- CreateIndex
CREATE INDEX "fiscal_notes_invoice_id_idx" ON "fiscal_notes"("invoice_id");

-- AddForeignKey
ALTER TABLE "fiscal_notes" ADD CONSTRAINT "fiscal_notes_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_notes" ADD CONSTRAINT "fiscal_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
