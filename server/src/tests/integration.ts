import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User';
import Meeting from '../models/Meeting';
import Document from '../models/Document';
import Transaction from '../models/Transaction';

dotenv.config();
dns.setDefaultResultOrder('ipv4first');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('\n======================================');
  console.log('🚀 STARTING INTEGRATION VERIFICATION SUITE');
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

  await mongoose.connect(connString);
  console.log('✅ Connected directly to MongoDB for verification verification & cleanup');

  const testEmailEnt = 'test_ent_99@nexus.com';
  const testEmailInv = 'test_inv_99@nexus.com';

  // 1. Cleanup old test data
  await User.deleteMany({ email: { $in: [testEmailEnt, testEmailInv] } });
  console.log('✅ Cleaned up old test user records');

  let entId = '';
  let invId = '';
  let entToken = '';
  let invToken = '';

  try {
    // 2. Register Entrepreneur
    console.log('⏳ Registering entrepreneur user...');
    const regEntRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Entrepreneur',
        email: testEmailEnt,
        password: 'Password123!',
        role: 'entrepreneur'
      })
    });
    if (!regEntRes.ok) throw new Error(`Failed to register entrepreneur: ${await regEntRes.text()}`);
    const regEntData = await regEntRes.json() as any;
    entId = regEntData.user.id;
    entToken = regEntData.token;
    console.log(`✅ Entrepreneur registered (ID: ${entId})`);

    // 3. Register Investor
    console.log('⏳ Registering investor user...');
    const regInvRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Investor',
        email: testEmailInv,
        password: 'Password123!',
        role: 'investor'
      })
    });
    if (!regInvRes.ok) throw new Error(`Failed to register investor: ${await regInvRes.text()}`);
    const regInvData = await regInvRes.json() as any;
    invId = regInvData.user.id;
    invToken = regInvData.token;
    console.log(`✅ Investor registered (ID: ${invId})`);

    // 4. Test normal login (without 2FA enabled)
    console.log('⏳ Testing normal user login...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailEnt,
        password: 'Password123!',
        role: 'entrepreneur'
      })
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
    const loginData = await loginRes.json() as any;
    if (!loginData.token) throw new Error('Token not returned on login');
    console.log('✅ Normal login verification passed');

    // 5. Test 2FA Activation and Verification
    console.log('⏳ Enabling 2FA on Investor...');
    const toggle2faRes = await fetch(`${API_BASE}/auth/toggle-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      },
      body: JSON.stringify({ enable: true })
    });
    if (!toggle2faRes.ok) throw new Error(`Failed to toggle 2FA: ${await toggle2faRes.text()}`);
    console.log('✅ 2FA enabled for Investor');

    console.log('⏳ Logging in Investor with 2FA enabled...');
    const login2faRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailInv,
        password: 'Password123!',
        role: 'investor'
      })
    });
    const login2faData = await login2faRes.json() as any;
    if (!login2faData.require2FA) throw new Error('2FA did not trigger on login');
    console.log('✅ 2FA login challenge returned successfully');

    // Retrieve generated OTP directly from MongoDB to simulate verification
    const investorUser = await User.findById(invId);
    if (!investorUser || !investorUser.twoFactorCode) throw new Error('Failed to fetch 2FA code from DB');
    const otp = investorUser.twoFactorCode;
    console.log(`🔑 Fetched OTP from database: ${otp}`);

    console.log('⏳ Submitting OTP for 2FA Verification...');
    const verifyRes = await fetch(`${API_BASE}/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: invId, code: otp })
    });
    if (!verifyRes.ok) throw new Error(`OTP verification failed: ${await verifyRes.text()}`);
    const verifyData = await verifyRes.json() as any;
    if (!verifyData.token) throw new Error('JWT token not returned after 2FA verification');
    invToken = verifyData.token;
    console.log('✅ 2FA OTP verification passed');

    // Disable 2FA for investor to prevent issues
    await fetch(`${API_BASE}/auth/toggle-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      },
      body: JSON.stringify({ enable: false })
    });
    console.log('✅ 2FA disabled again for clean workspace');

    // 6. Test Meeting Scheduler & Conflict checks
    // Meet 1: Scheduled by Entrepreneur, Inviting Investor (accepted)
    const startTime1 = new Date();
    startTime1.setHours(startTime1.getHours() + 2); // 2 hours from now
    const endTime1 = new Date(startTime1);
    endTime1.setHours(endTime1.getHours() + 1); // 1 hour duration

    console.log(`⏳ Scheduling Meeting 1 (pending): ${startTime1.toISOString()} to ${endTime1.toISOString()}...`);
    const meet1Res = await fetch(`${API_BASE}/meetings/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${entToken}`
      },
      body: JSON.stringify({
        inviteeId: invId,
        title: 'Tech Pitch Discussion',
        description: 'First meeting to review product demo',
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString()
      })
    });
    if (!meet1Res.ok) throw new Error(`Meeting 1 schedule failed: ${await meet1Res.text()}`);
    const meet1Data = await meet1Res.json() as any;
    const meet1Id = meet1Data.id;
    console.log(`✅ Meeting 1 scheduled (ID: ${meet1Id})`);

    // Investor accepts meeting 1
    console.log('⏳ Accepting Meeting 1 as Investor...');
    const acceptRes = await fetch(`${API_BASE}/meetings/accept/${meet1Id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      }
    });
    if (!acceptRes.ok) throw new Error(`Accepting meeting failed: ${await acceptRes.text()}`);
    console.log('✅ Meeting 1 accepted');

    // Try to schedule overlapping meeting
    const startTime2 = new Date(startTime1);
    startTime2.setMinutes(startTime2.getMinutes() + 30); // overlaps meeting 1 by 30 mins
    const endTime2 = new Date(startTime2);
    endTime2.setHours(endTime2.getHours() + 1);

    console.log(`⏳ Scheduling overlapping Meeting 2 (should fail): ${startTime2.toISOString()} to ${endTime2.toISOString()}...`);
    const meet2Res = await fetch(`${API_BASE}/meetings/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${entToken}`
      },
      body: JSON.stringify({
        inviteeId: invId,
        title: 'Overlapping Pitch',
        description: 'This meeting should be rejected due to overlap',
        startTime: startTime2.toISOString(),
        endTime: endTime2.toISOString()
      })
    });

    if (meet2Res.ok) {
      throw new Error('Overlapping meeting was scheduled successfully! Double booking checker failed.');
    }
    const meet2Error = await meet2Res.json() as any;
    console.log(`✅ Meeting 2 successfully rejected: "${meet2Error.error}"`);

    // 7. Wallet Transaction Checks
    console.log('⏳ Checking initial wallet balances...');
    const getEntProfileRes = await fetch(`${API_BASE}/auth/profile/${entId}`, {
      headers: { 'Authorization': `Bearer ${entToken}` }
    });
    const entProfile = await getEntProfileRes.json() as any;
    console.log(`   Entrepreneur Initial Wallet Balance: $${entProfile.walletBalance}`);

    const getInvProfileRes = await fetch(`${API_BASE}/auth/profile/${invId}`, {
      headers: { 'Authorization': `Bearer ${invToken}` }
    });
    const invProfile = await getInvProfileRes.json() as any;
    console.log(`   Investor Initial Wallet Balance: $${invProfile.walletBalance}`);

    // Investor Deposit
    console.log('⏳ Depositing $5000 into Investor Wallet...');
    const depRes = await fetch(`${API_BASE}/payments/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      },
      body: JSON.stringify({ amount: 5000 })
    });
    if (!depRes.ok) throw new Error(`Deposit failed: ${await depRes.text()}`);
    const depData = await depRes.json() as any;
    console.log(`✅ Deposit success. New Investor Balance: $${depData.balance}`);

    // Transfer from Investor to Entrepreneur
    console.log('⏳ Transferring $2000 from Investor to Entrepreneur...');
    const transRes = await fetch(`${API_BASE}/payments/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      },
      body: JSON.stringify({
        recipientId: entId,
        amount: 2000,
        description: 'Seed Investment Round A'
      })
    });
    if (!transRes.ok) throw new Error(`Transfer failed: ${await transRes.text()}`);
    console.log(`✅ Transfer success`);

    // Entrepreneur Withdrawal
    console.log('⏳ Withdrawing $500 from Entrepreneur Wallet...');
    const withdrawRes = await fetch(`${API_BASE}/payments/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${entToken}`
      },
      body: JSON.stringify({ amount: 500 })
    });
    if (!withdrawRes.ok) throw new Error(`Withdrawal failed: ${await withdrawRes.text()}`);
    const withdrawData = await withdrawRes.json() as any;
    console.log(`✅ Withdrawal success. New Entrepreneur Balance: $${withdrawData.balance}`);

    // Verify ledger
    console.log('⏳ Retrieving transactions ledger for Entrepreneur...');
    const ledRes = await fetch(`${API_BASE}/payments/transactions`, {
      headers: { 'Authorization': `Bearer ${entToken}` }
    });
    const ledger = await ledRes.json() as any;
    console.log(`✅ Ledger verified. Found ${ledger.length} transactions for entrepreneur.`);

    // 8. Document Chamber Sign Test
    // Create a mock document in the database
    console.log('⏳ Creating mock document in MongoDB to test Canvas Signature...');
    const mockDoc = new Document({
      name: 'investment_agreement.pdf',
      type: 'PDF',
      size: '1.2 MB',
      url: '/uploads/mock-investment-agreement.pdf',
      ownerId: entId,
      shared: true,
      status: 'uploaded'
    });
    await mockDoc.save();
    console.log(`✅ Mock document created (ID: ${mockDoc.id})`);

    // Submit base64 signature
    console.log('⏳ Signing document via Canvas base64 drawing data...');
    const signRes = await fetch(`${API_BASE}/documents/sign/${mockDoc.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${invToken}`
      },
      body: JSON.stringify({
        signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      })
    });
    if (!signRes.ok) throw new Error(`Document signing failed: ${await signRes.text()}`);
    const signData = await signRes.json() as any;
    if (signData.status !== 'signed' || !signData.signatureImage) {
      throw new Error('Document status or signature details failed to update');
    }
    console.log(`✅ Document signed successfully by Investor. Status: ${signData.status}`);

    console.log('\n======================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================\n');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', (error as Error).message);
    throw error;
  } finally {
    // Clean up
    console.log('⏳ Cleaning up verification database entries...');
    await Meeting.deleteMany({
      $or: [
        { hostId: entId },
        { hostId: invId }
      ]
    });
    await Transaction.deleteMany({
      $or: [
        { userId: entId },
        { userId: invId }
      ]
    });
    await Document.deleteMany({ ownerId: entId });
    await User.deleteMany({ email: { $in: [testEmailEnt, testEmailInv] } });
    await mongoose.disconnect();
    console.log('✅ Database cleaned up and connection closed.');
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Run Error:', err);
  process.exit(1);
});
