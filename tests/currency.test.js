const { priceHotels } = require('../src/services/currency.service');

afterEach(() => { jest.restoreAllMocks(); delete process.env.EXCHANGE_RATE_API_KEY; });

test('THB uses stored satang and preserves missing prices', async () => {
  const result = await priceHotels([{ pricePerNightSatang: 123456 }, { name: 'Unpriced' }]);
  expect(result[0].displayPrice.amount).toBe(1234.56);
  expect(result[1].displayPrice.amount).toBeNull();
});

test('rejects unsupported or structured currency input', async () => {
  await expect(priceHotels([], 'GBP')).rejects.toMatchObject({ statusCode: 400 });
  await expect(priceHotels([], ['USD'])).rejects.toThrow('Currency must');
});

test('fetches live provider rates once and rounds JPY to whole yen', async () => {
  process.env.EXCHANGE_RATE_API_KEY = 'test-key';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    result: 'success', base_code: 'THB', time_last_update_unix: Math.floor(Date.now() / 1000),
    conversion_rates: { THB: 1, USD: 0.03, EUR: 0.028, JPY: 4.51 },
  }) });
  const [usd] = await priceHotels([{ pricePerNightSatang: 10000 }], 'usd');
  const [jpy] = await priceHotels([{ pricePerNightSatang: 10000 }], 'JPY');
  expect(usd.displayPrice.amount).toBe(3);
  expect(jpy.displayPrice.amount).toBe(451);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('provider failure without a cache gives a recoverable 503', async () => {
  jest.resetModules();
  const service = require('../src/services/currency.service');
  process.env.EXCHANGE_RATE_API_KEY = 'test-key';
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
  await expect(service.priceHotels([{ pricePerNightSatang: 10000 }], 'USD'))
    .rejects.toMatchObject({ statusCode: 503 });
});

test('rejects malformed provider rates without exposing provider errors', async () => {
  jest.resetModules();
  const service = require('../src/services/currency.service');
  process.env.EXCHANGE_RATE_API_KEY = 'test-key';
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    result: 'success', base_code: 'THB', time_last_update_unix: Math.floor(Date.now() / 1000),
    conversion_rates: { THB: 1, USD: -2 },
  }) });
  await expect(service.priceHotels([{ pricePerNightSatang: 100 }], 'USD')).rejects.toMatchObject({ statusCode: 503 });
});

test('expired cache is marked stale on failure and rejected after 48 hours', async () => {
  jest.resetModules();
  const service = require('../src/services/currency.service');
  process.env.EXCHANGE_RATE_API_KEY = 'test-key';
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    result: 'success', base_code: 'THB', time_last_update_unix: Math.floor(now / 1000),
    conversion_rates: { THB: 1, USD: 0.03, EUR: 0.028, JPY: 4.51 },
  }) });
  await service.priceHotels([{ pricePerNightSatang: 10000 }], 'USD');
  fetchMock.mockRejectedValue(new Error('offline'));
  clock.mockReturnValue(now + 2 * 3600000);
  const [hotel] = await service.priceHotels([{ pricePerNightSatang: 10000 }], 'USD');
  expect(hotel.displayPrice.stale).toBe(true);
  clock.mockReturnValue(now + 49 * 3600000);
  await expect(service.priceHotels([{ pricePerNightSatang: 10000 }], 'USD')).rejects.toMatchObject({ statusCode: 503 });
});
