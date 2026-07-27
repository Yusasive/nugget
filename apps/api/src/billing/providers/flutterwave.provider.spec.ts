import type { ConfigService } from '@nestjs/config';
import { FlutterwaveProvider } from './flutterwave.provider';

const CONFIGURED_HASH = 'a-secret-hash-configured-in-the-dashboard';

function fakeConfig(hash: string | undefined = CONFIGURED_HASH): ConfigService {
  return { get: () => hash } as unknown as ConfigService;
}

describe('FlutterwaveProvider.verifyWebhookSignature', () => {
  it('accepts a verif-hash header matching the configured hash exactly', () => {
    const provider = new FlutterwaveProvider(fakeConfig());
    expect(
      provider.verifyWebhookSignature(Buffer.from('{}'), CONFIGURED_HASH),
    ).toBe(true);
  });

  it('rejects a header that does not match the configured hash', () => {
    const provider = new FlutterwaveProvider(fakeConfig());
    expect(
      provider.verifyWebhookSignature(Buffer.from('{}'), 'some-other-value'),
    ).toBe(false);
  });

  it('rejects a missing header', () => {
    const provider = new FlutterwaveProvider(fakeConfig());
    expect(provider.verifyWebhookSignature(Buffer.from('{}'), undefined)).toBe(
      false,
    );
  });
});
