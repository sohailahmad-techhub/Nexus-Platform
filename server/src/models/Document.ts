import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  name: string;
  type: string;
  size: string;
  url: string;
  ownerId: string;
  shared: boolean;
  status: 'uploaded' | 'signed';
  signatureImage?: string; // base64 string or file path
  signedById?: string;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema: Schema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g., 'PDF', 'Spreadsheet', 'Document'
  size: { type: String, required: true },
  url: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  shared: { type: Boolean, default: false },
  status: { type: String, enum: ['uploaded', 'signed'], default: 'uploaded' },
  signatureImage: { type: String, default: null },
  signedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  signedAt: { type: Date, default: null }
}, {
  timestamps: true
});

DocumentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    ret.ownerId = ret.ownerId.toString();
    if (ret.signedById) ret.signedById = ret.signedById.toString();
    ret.lastModified = ret.updatedAt.toISOString().split('T')[0];
    delete ret._id;
  }
});

export default mongoose.model<IDocument>('Document', DocumentSchema);
