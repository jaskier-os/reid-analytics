const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['polyline', 'circle', 'rectangle', 'polygon', 'marker']
  },
  geoJSON: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  style: {
    color: String,
    weight: Number,
    opacity: Number,
    fillColor: String,
    fillOpacity: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const LayerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  elements: [ElementSchema],
  createdBy: {
    type: String,
    required: true
  },
  collaborators: [{
    user: {
      type: String
    },
    permission: {
      type: String,
      enum: ['read', 'write', 'admin'],
      default: 'read'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
LayerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-save hook for elements
ElementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Layer', LayerSchema);