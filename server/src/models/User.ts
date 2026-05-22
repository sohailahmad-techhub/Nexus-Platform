import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'entrepreneur' | 'investor';
  avatarUrl: string;
  bio: string;
  isOnline: boolean;
  twoFactorEnabled: boolean;
  twoFactorCode?: string;
  twoFactorExpires?: Date;
  walletBalance: number;
  // Entrepreneur fields
  startupName?: string;
  pitchSummary?: string;
  fundingNeeded?: string;
  industry?: string;
  location?: string;
  foundedYear?: number;
  teamSize?: number;
  // Investor fields
  investmentInterests?: string[];
  investmentStage?: string[];
  portfolioCompanies?: string[];
  totalInvestments?: number;
  minimumInvestment?: string;
  maximumInvestment?: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['entrepreneur', 'investor'] },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorCode: { type: String, default: null },
  twoFactorExpires: { type: Date, default: null },
  walletBalance: { type: Number, default: 10000 }, // Starting with $10,000 for simulation
  
  // Entrepreneur fields
  startupName: { type: String, default: '' },
  pitchSummary: { type: String, default: '' },
  fundingNeeded: { type: String, default: '' },
  industry: { type: String, default: '' },
  location: { type: String, default: '' },
  foundedYear: { type: Number, default: new Date().getFullYear() },
  teamSize: { type: Number, default: 1 },
  
  // Investor fields
  investmentInterests: { type: [String], default: [] },
  investmentStage: { type: [String], default: [] },
  portfolioCompanies: { type: [String], default: [] },
  totalInvestments: { type: Number, default: 0 },
  minimumInvestment: { type: String, default: '' },
  maximumInvestment: { type: String, default: '' }
}, {
  timestamps: true
});

// Configure JSON transform to map _id to id and remove private fields
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret: any) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.passwordHash;
    delete ret.twoFactorCode;
    delete ret.twoFactorExpires;
  }
});

export default mongoose.model<IUser>('User', UserSchema);
