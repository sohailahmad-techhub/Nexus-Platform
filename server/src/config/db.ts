import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    dns.setDefaultResultOrder('ipv4first');
    let connString = process.env.MONGODB_URI;
    if (!connString) {
      console.error('Error: MONGODB_URI is not defined in the environment variables.');
      process.exit(1);
    }

    // Dynamic fallback for SRV DNS resolution issues on Windows
    if (connString.includes('cluster0.ejbrmhm.mongodb.net') && connString.startsWith('mongodb+srv://')) {
      try {
        const credentialsPart = connString.split('@')[0].replace('mongodb+srv://', '');
        connString = `mongodb://${credentialsPart}@ac-myeafuc-shard-00-00.ejbrmhm.mongodb.net:27017,ac-myeafuc-shard-00-01.ejbrmhm.mongodb.net:27017,ac-myeafuc-shard-00-02.ejbrmhm.mongodb.net:27017/nexus?ssl=true&replicaSet=atlas-qh7hvq-shard-0&authSource=admin`;
        console.log('Using direct shard connection string to bypass Node.js DNS SRV issues.');
      } catch (err) {
        console.warn('Failed to parse MONGODB_URI for direct shard fallback, trying original string.', err);
      }
    }
    
    // Connect to MongoDB
    await mongoose.connect(connString);
    console.log('MongoDB Database Connected Successfully!');
  } catch (error) {
    console.error(`Database Connection Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
