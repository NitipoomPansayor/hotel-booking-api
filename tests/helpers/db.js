const os = require('os');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let mongod;

const connect = async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  // The MongoDB driver loads `os` via dynamic import(), which Jest's VM sandbox doesn't support.
  // Passing it in explicitly keeps the handshake metadata intact under Jest.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
};

const clear = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
};

const close = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

module.exports = { connect, clear, close };
