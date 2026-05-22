import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  hostId: string;
  inviteeId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema: Schema = new Schema({
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  inviteeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'canceled'], default: 'pending' }
}, {
  timestamps: true
});

MeetingSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret._id.toString();
    ret.hostId = ret.hostId.toString();
    ret.inviteeId = ret.inviteeId.toString();
    delete ret._id;
  }
});

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
