const mockHttpClient = {
  get: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockHttpClient),
}));

import isFakeMail from './isFakeMail.client';

describe('isFakeMail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects public provider emails when verification runs', async () => {
    mockHttpClient.get.mockResolvedValue({
      data: {
        isDisposable: false,
        isPublicProvider: true,
        mx: ['gmail-smtp-in.l.google.com'],
      },
    });

    await expect(isFakeMail('rzhutch98@gmail.com')).resolves.toBe(false);
    expect(mockHttpClient.get).toHaveBeenCalledWith('/check?url=rzhutch98%40gmail.com&mx=true');
  });

  it('rejects disposable emails', async () => {
    mockHttpClient.get.mockResolvedValue({
      data: {
        isDisposable: true,
        isPublicProvider: false,
        mx: ['mx.example.com'],
      },
    });

    await expect(isFakeMail('user@example.com')).resolves.toBe(false);
  });

  it('rejects emails without MX records', async () => {
    mockHttpClient.get.mockResolvedValue({
      data: {
        isDisposable: false,
        isPublicProvider: false,
        mx: [],
      },
    });

    await expect(isFakeMail('user@example.com')).resolves.toBe(false);
  });
});
