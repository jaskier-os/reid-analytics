const mongoose = require('mongoose');

const tileCacheSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    index: true,
  },
  cacheKey: {
    type: String,
    required: true,
  },
  data: {
    type: Buffer,
    required: true,
  },
  contentType: {
    type: String,
    default: 'image/png',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

tileCacheSchema.index({ provider: 1, cacheKey: 1 }, { unique: true });
tileCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 }); // 180 days

module.exports = mongoose.model('TileCache', tileCacheSchema);
