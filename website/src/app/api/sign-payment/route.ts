export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import {
  validateSignerRequest,
  buildSignerResponse,
  type SignerRequest,
} from '@/lib/blink-signer'

const MERCHANT_ID = process.env.MERCHANT_ID
const MERCHANT_PRIVATE_KEY = process.env.MERCHANT_PRIVATE_KEY

export async function POST(req: NextRequest) {
  if (!MERCHANT_ID || !MERCHANT_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'Signer is not configured. Set MERCHANT_ID and MERCHANT_PRIVATE_KEY.' },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const errors = validateSignerRequest(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(' ') }, { status: 400 })
  }

  const signerRequest = body as SignerRequest

  try {
    const response = buildSignerResponse(signerRequest, MERCHANT_ID, MERCHANT_PRIVATE_KEY)
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signing failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
