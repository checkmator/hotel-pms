/**
 * NFS-e Integration Service
 *
 * Supported providers (set via env vars):
 *   NFSE_PROVIDER=nuvemfiscal  →  Nuvem Fiscal API  (https://nuvemfiscal.com.br)
 *   NFSE_PROVIDER=focusnfe     →  Focus NFe API     (https://focusnfe.com.br)
 *   NFSE_PROVIDER=mock         →  Mock (default when not configured)
 *
 * Required env vars per provider:
 *   Nuvem Fiscal: NFSE_API_KEY, NFSE_CLIENT_ID, NFSE_CLIENT_SECRET, NFSE_CNPJ
 *   Focus NFe:    NFSE_API_KEY, NFSE_CNPJ
 *
 * Optional:
 *   NFSE_AMBIENTE=producao  (default: homologacao)
 */

export interface NfseEmitPayload {
  // Tomador
  tomadorNome:      string;
  tomadorDocumento: string;   // CPF ou CNPJ (only digits)
  tomadorEmail?:    string;

  // Serviço
  discriminacao:    string;
  valorServicos:    number;
  valorDeducoes?:   number;
  aliquotaIss?:     number;   // decimal, e.g. 0.05 = 5%
  codigoServico?:   string;   // código lista serviços LC116/2003, default '0107'
  codigoMunicipio?: number;   // IBGE code, default 3550308 (São Paulo)

  // Prestador (override se necessário)
  prestadorCnpj?:  string;
  prestadorIm?:    string;    // inscrição municipal
}

export interface NfseResult {
  numero:            string;
  protocolo:         string;
  codigoVerificacao: string;
  provider:          'nuvemfiscal' | 'focusnfe' | 'mock';
  raw?:              unknown;  // raw provider response for debugging
}

export interface NfseCancelPayload {
  providerNfseId: string;  // the ID returned by provider on emit
  motivo:         string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const PROVIDER  = (process.env.NFSE_PROVIDER ?? 'mock') as 'nuvemfiscal' | 'focusnfe' | 'mock';
const API_KEY   = process.env.NFSE_API_KEY   ?? '';
const CLIENT_ID = process.env.NFSE_CLIENT_ID ?? '';   // Nuvem Fiscal only
const CLIENT_SECRET = process.env.NFSE_CLIENT_SECRET ?? '';
const CNPJ_ENV  = process.env.NFSE_CNPJ ?? '';         // digits only, e.g. "00000000000191"
const AMBIENTE  = process.env.NFSE_AMBIENTE ?? 'homologacao';

export function isProviderConfigured(): boolean {
  if (PROVIDER === 'mock') return false;
  if (PROVIDER === 'nuvemfiscal') return !!(CLIENT_ID && CLIENT_SECRET && CNPJ_ENV);
  if (PROVIDER === 'focusnfe')    return !!(API_KEY && CNPJ_ENV);
  return false;
}

export function getProviderName(): string {
  return PROVIDER;
}

// ── Main emit function ────────────────────────────────────────────────────────

export async function emitNfse(payload: NfseEmitPayload): Promise<NfseResult> {
  if (!isProviderConfigured()) return mockEmit(payload);

  switch (PROVIDER) {
    case 'nuvemfiscal': return emitNuvemFiscal(payload);
    case 'focusnfe':    return emitFocusNfe(payload);
    default:            return mockEmit(payload);
  }
}

export async function cancelNfse(providerNfseId: string, motivo: string): Promise<void> {
  if (!isProviderConfigured()) return; // mock: no-op

  switch (PROVIDER) {
    case 'nuvemfiscal': return cancelNuvemFiscal(providerNfseId, motivo);
    case 'focusnfe':    return cancelFocusNfe(providerNfseId, motivo);
  }
}

// ── Nuvem Fiscal ─────────────────────────────────────────────────────────────
// Docs: https://dev.nuvemfiscal.com.br/docs/api/nfse

let nuvemFiscalToken: string | null = null;
let nuvemFiscalTokenExpiry: number = 0;

async function getNuvemFiscalToken(): Promise<string> {
  if (nuvemFiscalToken && Date.now() < nuvemFiscalTokenExpiry) {
    return nuvemFiscalToken;
  }

  const res = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         'nfse',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nuvem Fiscal auth failed: ${res.status} — ${text}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  nuvemFiscalToken = json.access_token;
  nuvemFiscalTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return nuvemFiscalToken;
}

async function emitNuvemFiscal(p: NfseEmitPayload): Promise<NfseResult> {
  const token = await getNuvemFiscalToken();
  const cnpj  = (p.prestadorCnpj ?? CNPJ_ENV).replace(/\D/g, '');

  const body = {
    ambiente: AMBIENTE,
    cpf_cnpj: cnpj,
    ...(p.prestadorIm ? { inscricao_municipal: p.prestadorIm } : {}),
    servico: {
      valor_servicos:               p.valorServicos,
      valor_deducoes:               p.valorDeducoes ?? 0,
      iss_retido:                   false,
      item_lista_servico:           p.codigoServico ?? '09.01',
      codigo_tributario_municipio:  p.codigoServico ?? '0107',
      discriminacao:                p.discriminacao,
      municipio_prestacao_servico:  p.codigoMunicipio ?? 3550308,
    },
    tomador: {
      cpf_cnpj:    p.tomadorDocumento.replace(/\D/g, ''),
      razao_social: p.tomadorNome,
      ...(p.tomadorEmail ? { email: p.tomadorEmail } : {}),
    },
  };

  const res = await fetch('https://api.nuvemfiscal.com.br/nfse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nuvem Fiscal NFS-e emit failed: ${res.status} — ${text}`);
  }

  const json = await res.json() as {
    id: string;
    numero?: string;
    codigo_verificacao?: string;
    protocolo?: string;
  };

  return {
    numero:            json.numero            ?? json.id,
    protocolo:         json.protocolo         ?? json.id,
    codigoVerificacao: json.codigo_verificacao ?? json.id,
    provider:          'nuvemfiscal',
    raw:               json,
  };
}

async function cancelNuvemFiscal(nfseId: string, motivo: string): Promise<void> {
  const token = await getNuvemFiscalToken();

  const res = await fetch(`https://api.nuvemfiscal.com.br/nfse/${nfseId}/cancelamento`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ motivo }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nuvem Fiscal NFS-e cancel failed: ${res.status} — ${text}`);
  }
}

// ── Focus NFe ─────────────────────────────────────────────────────────────────
// Docs: https://focusnfe.com.br/docs/nfse

async function emitFocusNfe(p: NfseEmitPayload): Promise<NfseResult> {
  const cnpj = (p.prestadorCnpj ?? CNPJ_ENV).replace(/\D/g, '');
  const base = AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';

  const ref = `hotel_${Date.now()}`;

  const body = {
    data_emissao:           new Date().toISOString(),
    prestador: {
      cnpj,
      ...(p.prestadorIm ? { inscricao_municipal: p.prestadorIm } : {}),
    },
    tomador: {
      cpf: p.tomadorDocumento.replace(/\D/g, '').length === 11
        ? p.tomadorDocumento.replace(/\D/g, '')
        : undefined,
      cnpj: p.tomadorDocumento.replace(/\D/g, '').length === 14
        ? p.tomadorDocumento.replace(/\D/g, '')
        : undefined,
      razao_social: p.tomadorNome,
      ...(p.tomadorEmail ? { email: p.tomadorEmail } : {}),
    },
    servico: {
      aliquota:              (p.aliquotaIss ?? 0.05) * 100,
      discriminacao:          p.discriminacao,
      iss_retido:             'false',
      item_lista_servico:     p.codigoServico ?? '09.01',
      valor_servicos:         p.valorServicos,
      valor_deducoes:         p.valorDeducoes ?? 0,
    },
  };

  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const res = await fetch(`${base}/v2/nfse?ref=${ref}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Focus NFe NFS-e emit failed: ${res.status} — ${text}`);
  }

  const json = await res.json() as {
    numero_nfse?: string;
    codigo_verificacao?: string;
    protocolo?: string;
    ref?: string;
  };

  return {
    numero:            json.numero_nfse       ?? ref,
    protocolo:         json.protocolo         ?? ref,
    codigoVerificacao: json.codigo_verificacao ?? ref,
    provider:          'focusnfe',
    raw:               json,
  };
}

async function cancelFocusNfe(nfseId: string, motivo: string): Promise<void> {
  const base = AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';

  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const res = await fetch(`${base}/v2/nfse/${nfseId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
    },
    body: JSON.stringify({ justificativa: motivo }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Focus NFe NFS-e cancel failed: ${res.status} — ${text}`);
  }
}

// ── Mock ──────────────────────────────────────────────────────────────────────

function mockEmit(_p: NfseEmitPayload): NfseResult {
  return {
    numero:            String(Date.now()).slice(-8),
    protocolo:         `PRO${Date.now()}`,
    codigoVerificacao: Math.random().toString(36).slice(2, 10).toUpperCase(),
    provider:          'mock',
  };
}
