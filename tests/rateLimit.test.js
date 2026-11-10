const express = require('express');
const request = require('supertest');
const { parseRateLimitMax, createRateLimiter, DEFAULT_MAX } = require('../src/middleware/rateLimit');

const appWith = (limiter) => {
  const app = express();
  app.use(limiter);
  app.get('/', (req, res) => res.json({ success: true }));
  return app;
};

describe('parseRateLimitMax', () => {
  it.each([undefined, '', '   '])('uses the default of 100 when unset (%p)', (value) => {
    expect(parseRateLimitMax(value)).toBe(DEFAULT_MAX);
    expect(DEFAULT_MAX).toBe(100);
  });

  it.each([
    ['1', 1],
    ['1000', 1000],
    [' 250 ', 250],
  ])('accepts %p', (value, expected) => {
    expect(parseRateLimitMax(value)).toBe(expected);
  });

  it.each(['0', '-5', '1.5', 'abc', '100abc'])('rejects %p', (value) => {
    expect(() => parseRateLimitMax(value)).toThrow(`RATE_LIMIT_MAX must be a positive integer, got "${value}"`);
  });
});

describe('createRateLimiter', () => {
  const original = process.env.RATE_LIMIT_MAX;
  afterEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = original;
  });

  it('blocks a client once it goes over the limit', async () => {
    const app = appWith(createRateLimiter(2));

    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(429);
  });

  it('reads the limit from RATE_LIMIT_MAX', async () => {
    process.env.RATE_LIMIT_MAX = '5';

    const res = await request(appWith(createRateLimiter())).get('/');

    expect(res.headers.ratelimit).toMatch(/r=4/);
    expect(res.headers['ratelimit-policy']).toMatch(/^"5-in-10min"/);
  });

  it('defaults to 100 requests per 10 minutes', async () => {
    delete process.env.RATE_LIMIT_MAX;

    const res = await request(appWith(createRateLimiter())).get('/');

    expect(res.headers['ratelimit-policy']).toMatch(/^"100-in-10min"/);
  });

  it('refuses to start with an invalid RATE_LIMIT_MAX', () => {
    process.env.RATE_LIMIT_MAX = 'abc';

    expect(() => createRateLimiter()).toThrow('RATE_LIMIT_MAX must be a positive integer');
  });
});
