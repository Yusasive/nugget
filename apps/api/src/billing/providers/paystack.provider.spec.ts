import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { PaystackProvider } from './paystack.provider';

const SECRET = 'sk_test_fixed_secret_for_tests';

function fakeConfig(secret: string | undefined = SECRET): ConfigService {
  return { get: () => secret } as unknown as ConfigService;
}

function sign(body: Buffer, secret: string): string {
  return createHmac('sha512', secret).update(body).digest('hex');
}

describe('PaystackProvider.verifyWebhookSignature', () => {
  it('accepts a signature computed with the correct secret over the exact raw body', () => {
    const provider = new PaystackProvider(fakeConfig());
    const body = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { reference: 'r-1' } }),
    );
    expect(provider.verifyWebhookSignature(body, sign(body, SECRET))).toBe(
      true,
    );
  });

  it('rejects a signature computed with the wrong secret', () => {
    const provider = new PaystackProvider(fakeConfig());
    const body = Buffer.from(JSON.stringify({ event: 'charge.success' }));
    expect(
      provider.verifyWebhookSignature(body, sign(body, 'wrong-secret')),
    ).toBe(false);
  });

  it('rejects when the body has been tampered with after signing', () => {
    const provider = new PaystackProvider(fakeConfig());
    const originalBody = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { amount: 1000 } }),
    );
    const signature = sign(originalBody, SECRET);
    const tamperedBody = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { amount: 999999 } }),
    );
    expect(provider.verifyWebhookSignature(tamperedBody, signature)).toBe(
      false,
    );
  });

  it('rejects a missing signature header', () => {
    const provider = new PaystackProvider(fakeConfig());
    const body = Buffer.from('{}');
    expect(provider.verifyWebhookSignature(body, undefined)).toBe(false);
  });
});
