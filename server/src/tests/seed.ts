import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');

async function seedDatabase() {
  console.log('\n======================================');
  console.log('🌱 RUNNING NEXUS DATABASE DEMO SEEDER');
  console.log('======================================\n');

  let connString = process.env.MONGODB_URI;
  if (!connString) {
    console.error('Error: MONGODB_URI not found in env');
    process.exit(1);
  }

  if (connString.includes('cluster0.ejbrmhm.mongodb.net') && connString.startsWith('mongodb+srv://')) {
    const credentialsPart = connString.split('@')[0].replace('mongodb+srv://', '');
    connString = `mongodb://${credentialsPart}@ac-myeafuc-shard-00-00.ejbrmhm.mongodb.net:27017,ac-myeafuc-shard-00-01.ejbrmhm.mongodb.net:27017,ac-myeafuc-shard-00-02.ejbrmhm.mongodb.net:27017/nexus?ssl=true&replicaSet=atlas-qh7hvq-shard-0&authSource=admin`;
  }

  try {
    await mongoose.connect(connString);
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Clear old demo accounts
    await User.deleteMany({
      email: { $in: ['sarah@techwave.io', 'michael@vcinnovate.com'] }
    });
    console.log('✅ Removed existing demo users (if any)');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 2. Create Sarah (Entrepreneur)
    const sarah = new User({
      name: 'Sarah Jenkins',
      email: 'sarah@techwave.io',
      passwordHash,
      role: 'entrepreneur',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      bio: 'Pioneering green energy harvesting technologies. Passionate about climate action and grid resilience through hardware-software co-design.',
      startupName: 'TechWave Energy',
      pitchSummary: 'TechWave Energy manufactures intelligent wave energy converters controlled by local machine learning algorithms that adapt to ocean swells in real-time, providing consistent, sustainable grid power.',
      fundingNeeded: '$2,500,000',
      industry: 'CleanTech',
      location: 'San Francisco, CA',
      foundedYear: 2024,
      teamSize: 8,
      walletBalance: 25000 // Starting balance
    });
    await sarah.save();
    console.log('✅ Seeded Entrepreneur Demo: sarah@techwave.io');

    // 3. Create Michael (Investor)
    const michael = new User({
      name: 'Michael Sterling',
      email: 'michael@vcinnovate.com',
      passwordHash,
      role: 'investor',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      bio: 'Managing Partner at VC Innovate. Specializing in Seed and Series A financing for deep-tech, industrial clean-tech, and high-growth enterprise software startups.',
      investmentInterests: ['CleanTech', 'DeepTech', 'SaaS', 'ClimateTech'],
      investmentStage: ['Seed', 'Series A'],
      portfolioCompanies: ['SolarMax Solutions', 'HydrogenGrid', 'TerraBio'],
      totalInvestments: 14,
      minimumInvestment: '$100,000',
      maximumInvestment: '$5,000,000',
      walletBalance: 850000 // Starting balance
    });
    await michael.save();
    console.log('✅ Seeded Investor Demo: michael@vcinnovate.com');

    console.log('\n======================================');
    console.log('🎉 DEMO ACCOUNTS SEEDED SUCCESSFULLY!');
    console.log('   Use the login buttons in your browser.');
    console.log('======================================\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected database.');
  }
}

seedDatabase();
