import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

MessageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    ret.senderId = ret.senderId.toString();
    ret.receiverId = ret.receiverId.toString();
    ret.timestamp = ret.createdAt.toISOString();
    delete ret._id;
    delete ret.createdAt;
  }
});

export default mongoose.model<IMessage>('Message', MessageSchema);
