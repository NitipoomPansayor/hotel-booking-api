// Isolated browser-test backend. Never connects to the application's .env database.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-browser-test-secret';
delete process.env.EXCHANGE_RATE_API_KEY;
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Hotel = require('../../src/models/Hotel');
const Favorite = require('../../src/models/Favorite');
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
await mongoose.connect(replica.getUri());
await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
await User.create({ name: 'นักเดินทาง', email: 'traveler@example.com', password: 'travel123', tel: '0812345678' });
const hotels = await Hotel.create([
  { name: 'บ้านสวน ริเวอร์ไซด์', address: 'ถนนพระอาทิตย์ เขตพระนคร กรุงเทพมหานคร', tel: '021234567', pricePerNightSatang: 185000 },
  { name: 'เฌอ เชียงใหม่', address: 'นิมมานเหมินท์ อำเภอเมือง เชียงใหม่', tel: '053123456', pricePerNightSatang: 240000 },
  { name: 'ละมุน โฮเทล', address: 'ถนนเพชรเกษม หัวหิน ประจวบคีรีขันธ์', tel: '032123456', pricePerNightSatang: 165000 },
  ...Array.from({ length: 8 }, (_, n) => ({ name: `ที่พักทดสอบ ${n + 1}`, address: 'กรุงเทพมหานคร', tel: '021234567' })),
]);
for (let i = 0; i < 3; i++) {
  const user = await User.create({ name: `Seed ${i}`, email: `seed${i}@example.com`, password: 'travel123', tel: '0812345678' });
  for (let j = 0; j < 3 - i; j++) await Favorite.create({ user: user._id, hotel: hotels[j]._id });
}
const server = app.listen(5000, '127.0.0.1');
const close = async () => { server.close(); await mongoose.disconnect(); await replica.stop(); process.exit(0); };
process.on('SIGTERM', close);
process.on('SIGINT', close);
