import { LangFuseService, LangFuseConfig } from '../langfuse.service';

describe('LangFuseService', () => {
  let service: LangFuseService;
  let mockConfig: LangFuseConfig;

  beforeEach(() => {
    mockConfig = {
      publicKey: 'test-public-key',
      secretKey: 'test-secret-key',
      host: 'https://test.langfuse.com',
      enabled: true,
      debug: false,
      flushAt: 10,
      flushInterval: 1000,
    };
  });

  describe('when LangFuse is disabled', () => {
    beforeEach(() => {
      service = new LangFuseService({ ...mockConfig, enabled: false });
    });

    it('should not be available', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return null trace when creating trace', () => {
      const result = service.createTrace('test-trace');
      expect(result.traceId).toBeNull();
      expect(result.trace).toBeNull();
    });

    it('should handle updateTrace gracefully', () => {
      const mockTrace = { id: 'test-trace', update: jest.fn() };
      expect(() => service.updateTrace(mockTrace, {}, {})).not.toThrow();
    });

    it('should handle logEvent gracefully', () => {
      const mockTrace = { id: 'test-trace', event: jest.fn() };
      expect(() => service.logEvent(mockTrace, 'test-event')).not.toThrow();
    });
  });

  describe('when LangFuse configuration is incomplete', () => {
    it('should not be available when missing public key', () => {
      service = new LangFuseService({ ...mockConfig, publicKey: '' });
      expect(service.isAvailable()).toBe(false);
    });

    it('should not be available when missing secret key', () => {
      service = new LangFuseService({ ...mockConfig, secretKey: '' });
      expect(service.isAvailable()).toBe(false);
    });

    it('should not be available when missing host', () => {
      service = new LangFuseService({ ...mockConfig, host: '' });
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('configuration methods', () => {
    beforeEach(() => {
      service = new LangFuseService({ ...mockConfig, enabled: false });
    });

    it('should return partial config', () => {
      const config = service.getConfig();
      expect(config).toEqual({
        host: mockConfig.host,
        enabled: mockConfig.enabled,
        debug: mockConfig.debug,
        flushAt: mockConfig.flushAt,
        flushInterval: mockConfig.flushInterval,
      });
    });
  });

  describe('graceful degradation', () => {
    beforeEach(() => {
      service = new LangFuseService({ ...mockConfig, enabled: false });
    });

    it('should handle flush when not available', async () => {
      await expect(service.flush()).resolves.not.toThrow();
    });

    it('should handle shutdown when not available', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });
});
