const ApiError = require('../utils/ApiError');

const CURRENCIES = ['THB', 'USD', 'EUR', 'JPY'];
let cache;
let pending;
const normalizeCurrency = (value = 'THB') => {
  if (typeof value !== 'string' || !CURRENCIES.includes(value.toUpperCase())) {
    throw new ApiError(400, 'Currency must be THB, USD, EUR or JPY');
  }
  return value.toUpperCase();
};

const loadRates = async () => {
  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) throw new ApiError(503, 'Currency conversion is not configured');
  const response = await fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/THB`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error('Exchange service unavailable');
  const body = await response.json();
  if (body.result !== 'success' || body.base_code !== 'THB' ||
      !Number.isFinite(body.time_last_update_unix) ||
      !CURRENCIES.every((code) => Number.isFinite(body.conversion_rates?.[code]) && body.conversion_rates[code] > 0) ||
      body.conversion_rates.THB !== 1) throw new Error('Invalid exchange rates');
  const updatedAt = body.time_last_update_unix * 1000;
  if (updatedAt > Date.now() + 60000 || Date.now() - updatedAt > 48 * 3600000) throw new Error('Outdated exchange rates');
  cache = { rates: body.conversion_rates, updatedAt, fetchedAt: Date.now() };
  return cache;
};

const rateFor = async (currency) => {
  if (currency === 'THB') return { rate: 1, updatedAt: null, stale: false };
  const fresh = cache && Date.now() - cache.fetchedAt < 3600000 && Date.now() - cache.updatedAt < 48 * 3600000;
  if (!fresh) {
    try {
      if (!pending) pending = loadRates().finally(() => { pending = null; });
      await pending;
    } catch {
      if (!cache || Date.now() - cache.updatedAt > 48 * 3600000) {
        throw new ApiError(503, 'Currency rates unavailable. Please retry or select THB');
      }
      return { rate: cache.rates[currency], updatedAt: new Date(cache.updatedAt).toISOString(), stale: true };
    }
  }
  return { rate: cache.rates[currency], updatedAt: new Date(cache.updatedAt).toISOString(), stale: false };
};

const priceHotels = async (hotels, input) => {
  const currency = normalizeCurrency(input);
  const rate = hotels.some((hotel) => hotel.pricePerNightSatang != null)
    ? await rateFor(currency) : { rate: null, updatedAt: null, stale: false };
  return hotels.map((hotel) => {
    const data = typeof hotel.toJSON === 'function' ? hotel.toJSON() : { ...hotel };
    const amount = data.pricePerNightSatang == null ? null : data.pricePerNightSatang / 100 * rate.rate;
    return { ...data, displayPrice: {
      amount: amount == null ? null : Number(amount.toFixed(currency === 'JPY' ? 0 : 2)),
      currency, baseCurrency: 'THB', rate: rate.rate, rateUpdatedAt: rate.updatedAt, stale: rate.stale,
    } };
  });
};

module.exports = { priceHotels, normalizeCurrency };
