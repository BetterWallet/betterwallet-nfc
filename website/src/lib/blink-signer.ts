import { createSign, randomUUID } from 'node:crypto'

export interface SignerRequest {
  amount: number
  chainId: number
  address: string
  token: string
  callbackScheme: string | null
  url: string
  version?: string
  reference?: string
  metadata?: Record<string, string>
}

export interface SignerResponse {
  merchantId: string
  payload: string
  signature: string
  preview: {
    amount: number
    chainId: number
    address: string
    token: string
    idempotencyKey: string
  }
}

export interface ValidationError {
  errors: string[]
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const EVM_TOKEN_RE = /^0x[a-fA-F0-9]{1,40}$/

const ALLOWED_CALLBACK_SCHEMES = new Set(['betterwallet'])

export function validateSignerRequest(body: unknown): string[] {
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object.']

  const req = body as Record<string, unknown>
  const errors: string[] = []

  if (!Number.isFinite(req.amount) || (req.amount as number) <= 0) {
    errors.push('amount must be a positive finite number.')
  }
  if (!Number.isInteger(req.chainId) || (req.chainId as number) <= 0) {
    errors.push('chainId must be a positive integer.')
  }
  if (typeof req.address !== 'string' || !EVM_ADDRESS_RE.test(req.address)) {
    errors.push('address must be a 0x-prefixed 40-character hex string.')
  }
  if (typeof req.token !== 'string' || !EVM_TOKEN_RE.test(req.token)) {
    errors.push('token must be a 0x-prefixed hex contract address.')
  }
  if (req.callbackScheme !== null && req.callbackScheme !== undefined) {
    if (
      typeof req.callbackScheme !== 'string' ||
      !ALLOWED_CALLBACK_SCHEMES.has(req.callbackScheme)
    ) {
      errors.push(
        `callbackScheme must be null or one of: ${[...ALLOWED_CALLBACK_SCHEMES].join(', ')}.`,
      )
    }
  }

  return errors
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signPayload(payload: string, privateKeyPem: string): string {
  const signer = createSign('SHA256')
  signer.update(payload)
  signer.end()
  return signer.sign(privateKeyPem).toString('base64url')
}

export function buildSignerResponse(
  req: SignerRequest,
  merchantId: string,
  privateKeyPem: string,
): SignerResponse {
  const idempotencyKey = randomUUID()
  const signatureTimestamp = new Date().toISOString()
  const version = req.version ?? 'v1'

  const payloadObject = {
    amount: req.amount,
    chainId: req.chainId,
    address: req.address,
    token: req.token,
    idempotencyKey,
    callbackScheme: req.callbackScheme ?? null,
    signatureTimestamp,
    version,
  }

  const payload = encodeBase64Url(JSON.stringify(payloadObject))
  const signature = signPayload(payload, privateKeyPem)

  return {
    merchantId,
    payload,
    signature,
    preview: {
      amount: req.amount,
      chainId: req.chainId,
      address: req.address,
      token: req.token,
      idempotencyKey,
    },
  }
}
