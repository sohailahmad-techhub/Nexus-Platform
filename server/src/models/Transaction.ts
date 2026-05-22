import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  amount: number;
  status: 'Pending' | 'Completed' | 'Failed';
  recipientId?: string;
  description: string;
  createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'transfer'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  description: { type: String, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

TransactionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret._id.toString();
    ret.userId = ret.userId.toString();
    if (ret.recipientId) ret.recipientId = ret.recipientId.toString();
    ret.timestamp = ret.createdAt.toISOString();
    delete ret._id;
    delete ret.createdAt;
  }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
