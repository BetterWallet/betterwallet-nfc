type SendDefaults = {
  to: string;
  amountEth: string;
};

const baseDefaults: SendDefaults = {
  to: '',
  amountEth: '',
};

export function getSendDefaults(): SendDefaults {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const local = require('./sendDefaults.local') as {
      SEND_DEFAULTS?: Partial<SendDefaults>;
    };
    if (!local?.SEND_DEFAULTS) {
      return baseDefaults;
    }

    return {
      ...baseDefaults,
      ...local.SEND_DEFAULTS,
    };
  } catch {
    return baseDefaults;
  }
}
