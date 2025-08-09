import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  caption: { type: String }
}, { _id: false });

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true, index: '2dsphere' },
  address: { type: String, required: true },
}, { _id: false });

const proposalSchema = new mongoose.Schema({
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  delivery_method: { type: String, enum: ['pickup', 'delivery'], required: true },
  delivery_location: locationSchema,
  delivery_charge: { type: Number, default: 0 },
  schedule: { date: Date },
  comments: String,
  attachments: [attachmentSchema]
}, { _id: false });

const historyEntrySchema = new mongoose.Schema({
  by: { type: String, enum: ['buyer', 'seller'], required: true },
  proposal: proposalSchema,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });


const requestSchema = new mongoose.Schema({
  mine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mine', required: true },
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  truck_owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  truck_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
  
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status: {
    type: String,
    enum: ['pending', 'countered', 'accepted', 'rejected', 'canceled', 'in_progress', 'completed'],
    default: 'pending',
    required: true,
  },
  
  last_updated_by: {
    type: String,
    enum: ['buyer', 'seller'],
    required: true,
  },

  current_proposal: {
    type: proposalSchema,
    required: true,
  },
  
  finalized_agreement: {
    type: proposalSchema,
  },

  history: [historyEntrySchema],

  rejection_reason: {
    type: String,
    trim: true,
  },
  cancellation_reason: {
    type: String,
    trim: true,
  },

}, {
  timestamps: true,
});

requestSchema.index({ mine_id: 1, status: 1 });
requestSchema.index({ truck_owner_id: 1, status: 1 });

export default mongoose.model('Request', requestSchema);