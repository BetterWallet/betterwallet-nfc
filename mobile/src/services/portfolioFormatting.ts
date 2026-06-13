interface FormatUsdOptions {
  compact?: boolean;
}

function normalizeFiniteNumber(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (Object.is(value, -0) || Math.abs(value) < 1e-12) {
    return 0;
  }
  return value;
}

export function formatUsd(value: number, options?: FormatUsdOptions): string {
  const normalized = normalizeFiniteNumber(value);
  if (normalized === null) {
    return '--';
  }

  if (options?.compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(normalized);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function formatTokenAmount(amount: number, priceUsd?: number): string {
  const normalizedAmount = normalizeFiniteNumber(amount);
  if (normalizedAmount === null) {
    return '--';
  }
  if (normalizedAmount === 0) {
    return '0';
  }

  const absAmount = Math.abs(normalizedAmount);
  const normalizedPrice = normalizeFiniteNumber(priceUsd ?? Number.NaN);
  const valueUsd = normalizedPrice === null ? Number.NaN : absAmount * normalizedPrice;

  let maxFractionDigits = 6;
  if (absAmount >= 1_000) {
    maxFractionDigits = 2;
  } else if (absAmount >= 1) {
    maxFractionDigits = 4;
  } else if (Number.isFinite(valueUsd) && valueUsd >= 1) {
    maxFractionDigits = 4;
  } else if (Number.isFinite(valueUsd) && valueUsd >= 0.01) {
    maxFractionDigits = 6;
  } else if (absAmount < 0.0001) {
    maxFractionDigits = 10;
  } else {
    maxFractionDigits = 8;
  }

  return normalizedAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}
