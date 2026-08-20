type CustomerLike = {
  name?: string
  phoneMasked?: string
  idNoMasked?: string
  address?: string
  community?: string
  avgDeposit?: number
  [key: string]: unknown
}

/**
 * Apply display-layer desensitization when `maskPii` is true.
 * The DB already stores half-masked phone/id values; this adds a second layer
 * for roles flagged as `mask_pii`（如合规 / 只读）。
 */
export function desensitizeCustomer<T extends CustomerLike>(customer: T, maskPii: boolean): T {
  if (!maskPii) return customer

  const out = { ...customer }

  // Further mask phone: show only last 4 digits
  if (out.phoneMasked) {
    out.phoneMasked = "****" + (out.phoneMasked as string).slice(-4)
  }
  // Fully mask ID number
  if (out.idNoMasked) {
    out.idNoMasked = "****************"
  }
  // Mask address to community only
  if (out.community) {
    out.address = out.community as string
  }
  // Round deposit to nearest 万
  if (typeof out.avgDeposit === "number") {
    out.avgDeposit = Math.round((out.avgDeposit as number) / 10000) * 10000
  }
  // Mask name to surname + **
  if (out.name && (out.name as string).length >= 2) {
    out.name = (out.name as string)[0] + "**"
  }

  return out
}

/**
 * Strip all PII fields before sending to LLM context.
 * Returns only L1 public fields safe for model consumption.
 */
export function redactForLlm<T extends CustomerLike>(customer: T): Partial<T> {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    phoneMasked: _p, idNoMasked: _i, address: _a,
    ...safe
  } = customer as CustomerLike & { phoneMasked?: unknown; idNoMasked?: unknown; address?: unknown }

  return {
    ...safe,
    phoneMasked: "[PHONE_REDACTED]",
    idNoMasked: "[ID_REDACTED]",
    address: safe.community ?? "[ADDRESS_REDACTED]",
  } as Partial<T>
}
