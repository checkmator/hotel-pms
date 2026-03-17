import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/rbac';
import { recordAudit } from '../../services/audit.service';
import { emitNfse, cancelNfse, isProviderConfigured, getProviderName } from '../../services/nfse.service';

const prisma = new PrismaClient();

// ─── Service code for accommodation: LC 116/2003 item 9.01 ──────────────────
const DEFAULT_CODIGO_SERVICO = '0107'; // Municipal code for hotel accommodation
const DEFAULT_ALIQUOTA_ISS   = 0.0500; // 5%

const createFiscalNoteSchema = z.object({
  reservationId:        z.string().uuid(),
  invoiceId:            z.string().uuid(),

  // Prestador overrides (defaults come from hotel config)
  prestadorCnpj:        z.string().min(11).max(20),
  prestadorRazaoSocial: z.string().min(2).max(150),
  prestadorIm:          z.string().max(20).optional(),
  prestadorMunicipio:   z.string().min(2).max(80),

  // Tomador
  tomadorDocumento:     z.string().min(11).max(20),
  tomadorNome:          z.string().min(2).max(150),
  tomadorEmail:         z.string().email().optional(),

  // Service
  discriminacao:        z.string().min(10).max(2000),
  codigoServico:        z.string().max(10).default(DEFAULT_CODIGO_SERVICO),
  aliquotaIss:          z.number().min(0).max(1).default(DEFAULT_ALIQUOTA_ISS),
  valorDeducoes:        z.number().min(0).default(0),
});

export async function fiscalNoteRoutes(app: FastifyInstance) {

  // GET /reservations/:reservationId/fiscal-notes
  app.get('/reservations/:reservationId/fiscal-notes', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (request, reply) => {
    const { reservationId } = request.params as { reservationId: string };
    const notes = await prisma.fiscalNote.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ data: notes });
  });

  // POST /reservations/:reservationId/fiscal-notes — generate NFS-e document
  app.post('/reservations/:reservationId/fiscal-notes', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (request, reply) => {
    const { reservationId } = request.params as { reservationId: string };
    const body = createFiscalNoteSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Dados inválidos.', details: body.error.flatten() });

    // Validate reservation + invoice exist and are closed
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return reply.status(404).send({ error: 'Reserva não encontrada.' });

    const invoice = await prisma.invoice.findUnique({ where: { id: body.data.invoiceId } });
    if (!invoice) return reply.status(404).send({ error: 'Fatura não encontrada.' });
    if (invoice.status !== 'closed') return reply.status(409).send({ error: 'Somente faturas fechadas podem gerar NFS-e.' });
    if (invoice.reservationId !== reservationId) return reply.status(409).send({ error: 'Fatura não pertence a esta reserva.' });

    // Prevent duplicate emission for same invoice
    const existing = await prisma.fiscalNote.findFirst({
      where: { invoiceId: body.data.invoiceId, status: { in: ['pending', 'emitted'] } },
    });
    if (existing) return reply.status(409).send({ error: 'Já existe uma NFS-e gerada para esta fatura.', data: existing });

    const valorServicos = Number(invoice.total);
    const baseCalculo   = valorServicos - body.data.valorDeducoes;
    const valorIss      = Math.round(baseCalculo * body.data.aliquotaIss * 100) / 100;
    const valorLiquido  = valorServicos - valorIss;

    const note = await prisma.fiscalNote.create({
      data: {
        reservationId,
        invoiceId:            body.data.invoiceId,
        prestadorCnpj:        body.data.prestadorCnpj,
        prestadorRazaoSocial: body.data.prestadorRazaoSocial,
        prestadorIm:          body.data.prestadorIm,
        prestadorMunicipio:   body.data.prestadorMunicipio,
        tomadorDocumento:     body.data.tomadorDocumento,
        tomadorNome:          body.data.tomadorNome,
        tomadorEmail:         body.data.tomadorEmail,
        discriminacao:        body.data.discriminacao,
        codigoServico:        body.data.codigoServico,
        valorServicos,
        valorDeducoes:        body.data.valorDeducoes,
        baseCalculo,
        aliquotaIss:          body.data.aliquotaIss,
        valorIss,
        valorLiquido,
        status:               'pending',
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'fiscal_note', entityId: note.id, action: 'create', newValues: { reservationId, invoiceId: body.data.invoiceId, valorServicos }, ipAddress: request.ip });
    return reply.status(201).send({ data: note });
  });

  // GET /fiscal-notes/provider-status — check if real provider is configured
  app.get('/fiscal-notes/provider-status', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (_request, reply) => {
    return reply.send({
      data: {
        configured: isProviderConfigured(),
        provider:   getProviderName(),
      },
    });
  });

  // POST /fiscal-notes/:id/emit — emit to fiscal authority (real or mock)
  app.post('/fiscal-notes/:id/emit', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const note = await prisma.fiscalNote.findUnique({ where: { id } });
    if (!note) return reply.status(404).send({ error: 'NFS-e não encontrada.' });
    if (note.status === 'emitted')   return reply.status(409).send({ error: 'NFS-e já emitida.' });
    if (note.status === 'cancelled') return reply.status(409).send({ error: 'NFS-e cancelada não pode ser emitida.' });

    let result: { numero: string; protocolo: string; codigoVerificacao: string; provider: string };
    try {
      result = await emitNfse({
        tomadorNome:      note.tomadorNome,
        tomadorDocumento: note.tomadorDocumento,
        tomadorEmail:     note.tomadorEmail ?? undefined,
        discriminacao:    note.discriminacao,
        valorServicos:    Number(note.valorServicos),
        valorDeducoes:    Number(note.valorDeducoes),
        aliquotaIss:      Number(note.aliquotaIss),
        codigoServico:    note.codigoServico,
        prestadorCnpj:    note.prestadorCnpj,
        prestadorIm:      note.prestadorIm ?? undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.fiscalNote.update({ where: { id }, data: { status: 'error', errorMessage: msg } });
      return reply.status(502).send({ error: `Erro na comunicação com o provedor NFS-e: ${msg}` });
    }

    const emitted = await prisma.fiscalNote.update({
      where: { id },
      data: {
        status:            'emitted',
        numero:            result.numero,
        protocolo:         result.protocolo,
        codigoVerificacao: result.codigoVerificacao,
        emittedAt:         new Date(),
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'fiscal_note', entityId: id, action: 'update', newValues: { status: 'emitted', numero: result.numero, provider: result.provider }, ipAddress: request.ip });
    return reply.send({ data: emitted });
  });

  // POST /fiscal-notes/:id/cancel
  app.post('/fiscal-notes/:id/cancel', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { motivo } = request.body as { motivo?: string };

    const note = await prisma.fiscalNote.findUnique({ where: { id } });
    if (!note) return reply.status(404).send({ error: 'NFS-e não encontrada.' });
    if (note.status === 'cancelled') return reply.status(409).send({ error: 'NFS-e já cancelada.' });
    if (note.status === 'pending') return reply.status(409).send({ error: 'NFS-e pendente não pode ser cancelada. Exclua-a e crie uma nova.' });

    // Call real provider cancel if configured and note has a numero (provider ID)
    if (note.numero) {
      try {
        await cancelNfse(note.numero, motivo ?? 'Cancelamento solicitado.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(502).send({ error: `Erro ao cancelar no provedor NFS-e: ${msg}` });
      }
    }

    const cancelled = await prisma.fiscalNote.update({
      where: { id },
      data: {
        status:             'cancelled',
        motivoCancelamento: motivo ?? 'Cancelamento solicitado.',
        cancelledAt:        new Date(),
      },
    });

    await recordAudit({ userId: request.user.sub, entityType: 'fiscal_note', entityId: id, action: 'update', newValues: { status: 'cancelled', motivo }, ipAddress: request.ip });
    return reply.send({ data: cancelled });
  });

  // DELETE /fiscal-notes/:id — only pending notes
  app.delete('/fiscal-notes/:id', {
    preHandler: [authenticate, authorize('invoices:close')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const note = await prisma.fiscalNote.findUnique({ where: { id } });
    if (!note) return reply.status(404).send({ error: 'NFS-e não encontrada.' });
    if (note.status !== 'pending') return reply.status(409).send({ error: 'Somente NFS-e pendentes podem ser excluídas.' });

    await prisma.fiscalNote.delete({ where: { id } });
    return reply.status(204).send();
  });
}
