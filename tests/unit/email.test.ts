import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailDeliveryConfigured, sendAuthEmail } from '@/lib/email';

describe('authentication email delivery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requires both server-side email credentials', () => {
    expect(emailDeliveryConfigured({})).toBe(false);
    expect(
      emailDeliveryConfigured({
        RESEND_API_KEY: 'server-only-key',
        AUTH_EMAIL_FROM: 'accounts@withyou.example',
      }),
    ).toBe(true);
  });

  it('sends escaped transactional content without exposing the key in the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    await sendAuthEmail(
      {
        RESEND_API_KEY: 'server-only-key',
        AUTH_EMAIL_FROM: 'accounts@withyou.example',
      },
      {
        to: 'person@example.test',
        subject: 'Verify',
        heading: '<WithYou>',
        copy: 'Confirm & continue',
        action: 'Verify email',
        url: 'https://withyou.example/verify?token=a&next=b',
      },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request?.headers).toMatchObject({ Authorization: 'Bearer server-only-key' });
    const body = String(request?.body);
    expect(body).toContain('&lt;WithYou&gt;');
    expect(body).toContain('token=a&amp;next=b');
    expect(body).not.toContain('server-only-key');
  });

  it('does not include a provider response body in delivery errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('sensitive provider detail', { status: 401 }),
    );
    await expect(
      sendAuthEmail(
        {
          RESEND_API_KEY: 'server-only-key',
          AUTH_EMAIL_FROM: 'accounts@withyou.example',
        },
        {
          to: 'person@example.test',
          subject: 'Verify',
          heading: 'Verify',
          copy: 'Confirm',
          action: 'Continue',
          url: 'https://withyou.example',
        },
      ),
    ).rejects.toThrow('Authentication email delivery failed with status 401.');
  });
});
