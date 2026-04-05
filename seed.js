/**
 * Unified seed script for Janta Exam
 * 
 * Usage:
 *   npm run seed              - Seed fresh data (clears all existing data)
 *   npm run seed -- --preserve - Add data without clearing existing
 *   npm run seed -- --quick    - Only seed categories, plans, users (no questions/tests)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Question = require('./models/Question');
const Test = require('./models/Test');
const MembershipPlan = require('./models/MembershipPlan');
const Category = require('./models/Category');
const Video = require('./models/Video');
const connectDB = require('./config/db');

// Configuration
const CONFIG = {
  preserveExisting: process.argv.includes('--preserve'),
  quickSeed: process.argv.includes('--quick'),
};

// Seed data definitions
const CATEGORIES = [
  { name: 'SSC', slug: 'ssc', description: 'Staff Selection Commission exams', icon: '🏛️', color: '#6c63ff', order: 1 },
  { name: 'Railway', slug: 'railway', description: 'Railway Recruitment Board exams', icon: '🚂', color: '#43e97b', order: 2 },
  { name: 'Banking', slug: 'banking', description: 'IBPS, SBI, RBI Banking exams', icon: '🏦', color: '#38f9d7', order: 3 },
  { name: 'UPSC', slug: 'upsc', description: 'Civil Services Examination', icon: '📜', color: '#f6d365', order: 4 },
  { name: 'Defence', slug: 'defence', description: 'NDA, CDS, AFCAT Defence exams', icon: '⚔️', color: '#f7971e', order: 5 },
  { name: 'State PSC', slug: 'state-psc', description: 'State Public Service Commission', icon: '🗺️', color: '#ff6584', order: 6 },
  { name: 'Teaching', slug: 'teaching', description: 'CTET, TET, KVS Teaching exams', icon: '📖', color: '#a78bfa', order: 7 },
];

const MEMBERSHIP_PLANS = [
  {
    name: 'Free', slug: 'free', description: 'Basic access to get started',
    price: 0, durationDays: 36500,
    features: ['5 free mock tests per month', 'Basic performance analytics', 'Community leaderboard'],
    maxTests: 5, isActive: true, order: 1
  },
  {
    name: 'Monthly Pro', slug: 'monthly-pro', description: 'Full access for one month',
    price: 299, durationDays: 30,
    features: ['Unlimited mock tests', 'Video lectures library', 'Detailed analytics', 'Priority support', 'No ads', 'Download question papers'],
    maxTests: -1, isActive: true, isPopular: true, order: 2
  },
  {
    name: 'Yearly Pro', slug: 'yearly-pro', description: 'Best value — full year access',
    price: 1999, durationDays: 365,
    features: ['Everything in Monthly Pro', '4 months FREE vs monthly', 'Exclusive study materials', 'Live doubt sessions', 'Certificate of completion'],
    maxTests: -1, isActive: true, order: 3
  },
];

const USERS = [
  { name: 'Admin User', email: 'admin@jantaexam.com', password: 'admin123', role: 'admin' },
  { name: 'Ravi Kumar', email: 'teacher@jantaexam.com', password: 'teacher123', role: 'teacher', isActive: true },
  { name: 'Test Student', email: 'user@jantaexam.com', password: 'user123', role: 'user' },
];

const getQuestions = (adminId, teacherId) => ({
  ssc: [
    { text: 'Who was the first Prime Minister of India?', options: { A: 'Sardar Patel', B: 'Jawaharlal Nehru', C: 'Mahatma Gandhi', D: 'Dr. Rajendra Prasad' }, correctAnswer: 'B', explanation: 'Nehru served as PM from 1947 to 1964.', category: 'SSC', subject: 'General Awareness', difficulty: 'Easy', createdBy: adminId },
    { text: 'What is √144?', options: { A: '11', B: '12', C: '13', D: '14' }, correctAnswer: 'B', explanation: '12 × 12 = 144', category: 'SSC', subject: 'Quantitative Aptitude', difficulty: 'Easy', createdBy: teacherId },
    { text: 'Find the odd one: 2, 3, 5, 7, 9, 11', options: { A: '9', B: '3', C: '5', D: '11' }, correctAnswer: 'A', explanation: '9 is not prime (9=3×3)', category: 'SSC', subject: 'Reasoning', difficulty: 'Medium', createdBy: teacherId },
    { text: 'Which gas is most abundant in atmosphere?', options: { A: 'Oxygen', B: 'Carbon Dioxide', C: 'Nitrogen', D: 'Hydrogen' }, correctAnswer: 'C', explanation: 'Nitrogen = ~78%', category: 'SSC', subject: 'General Science', difficulty: 'Easy', createdBy: adminId },
    { text: 'The Constitution of India was adopted on:', options: { A: '15 Aug 1947', B: '26 Jan 1950', C: '26 Nov 1949', D: '30 Jan 1948' }, correctAnswer: 'C', explanation: 'Adopted 26 Nov 1949, enforced 26 Jan 1950', category: 'SSC', subject: 'General Awareness', difficulty: 'Medium', createdBy: adminId },
  ],
  banking: [
    { text: 'What does RBI stand for?', options: { A: 'Reserve Bank of India', B: 'Regional Bank of India', C: 'Rural Bank of India', D: 'Retail Bank of India' }, correctAnswer: 'A', explanation: "RBI is India's central bank.", category: 'Banking', subject: 'Banking Awareness', difficulty: 'Easy', createdBy: teacherId },
    { text: 'SI on ₹5000 at 8% for 3 years?', options: { A: '₹1000', B: '₹1200', C: '₹1500', D: '₹800' }, correctAnswer: 'B', explanation: 'SI = (5000×8×3)/100 = ₹1200', category: 'Banking', subject: 'Quantitative Aptitude', difficulty: 'Easy', createdBy: adminId },
    { text: 'NABARD stands for:', options: { A: 'National Bank for Agriculture and Rural Development', B: 'National Banking and Rural Development', C: 'National Board for Agriculture', D: 'None' }, correctAnswer: 'A', explanation: 'NABARD supports rural credit.', category: 'Banking', subject: 'Banking Awareness', difficulty: 'Medium', createdBy: teacherId },
  ],
});

const getVideos = (creatorId) => [
  { title: 'SSC CGL Complete Reasoning Tricks', description: 'Master all reasoning topics for SSC CGL exam with shortcuts and tricks', category: 'SSC', subject: 'Reasoning', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', duration: 3600, isPremium: false, isActive: true, order: 1, views: 1250, tags: ['reasoning', 'ssc', 'tricks'], createdBy: creatorId },
  { title: 'Banking Awareness Full Course 2024', description: 'Complete banking awareness for IBPS PO, SBI PO and other banking exams', category: 'Banking', subject: 'Banking Awareness', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', duration: 7200, isPremium: true, isActive: true, order: 1, views: 890, tags: ['banking', 'awareness', 'ibps'], createdBy: creatorId },
  { title: 'Quantitative Aptitude Speed Maths', description: 'Learn speed maths techniques to solve quantitative questions in seconds', category: 'SSC', subject: 'Quantitative Aptitude', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration: 5400, isPremium: false, isActive: true, order: 2, views: 2100, tags: ['maths', 'aptitude', 'speed'], createdBy: creatorId },
  { title: 'Railway GK - History of Indian Railways', description: 'Complete history and general knowledge about Indian Railways', category: 'Railway', subject: 'General Awareness', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration: 2700, isPremium: false, isActive: true, order: 1, views: 560, tags: ['railway', 'gk', 'history'], createdBy: creatorId },
  { title: 'UPSC Current Affairs Monthly Digest', description: 'Comprehensive monthly current affairs for UPSC aspirants', category: 'UPSC', subject: 'Current Affairs', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', duration: 9000, isPremium: true, isActive: true, order: 1, views: 3200, tags: ['upsc', 'current affairs', 'monthly'], createdBy: creatorId },
];

// Main seed function
const seed = async () => {
  await connectDB();
  
  console.log(`\n🌱 Seeding mode: ${CONFIG.preserveExisting ? 'preserve existing' : 'fresh'} ${CONFIG.quickSeed ? '(quick)' : ''}\n`);
  
  // Clear data if not preserving
  if (!CONFIG.preserveExisting) {
    await Promise.all([
      User.deleteMany({}),
      Question.deleteMany({}),
      Test.deleteMany({}),
      MembershipPlan.deleteMany({}),
      Category.deleteMany({}),
      Video.deleteMany({}),
    ]);
    console.log('🗑️  Cleared all data');
  }

  // Seed users
  let admin, teacher;
  if (CONFIG.preserveExisting) {
    admin = await User.findOne({ role: 'admin' });
    teacher = await User.findOne({ role: 'teacher' });
  }
  
  if (!admin || !teacher) {
    const users = await User.create(USERS);
    admin = users.find(u => u.role === 'admin');
    teacher = users.find(u => u.role === 'teacher');
    console.log('👤 Users created');
  } else {
    console.log('👤 Using existing users');
  }

  // Seed categories and plans
  if (!CONFIG.preserveExisting) {
    await Category.insertMany(CATEGORIES);
    console.log('📚 Categories created');
    
    await MembershipPlan.insertMany(MEMBERSHIP_PLANS);
    console.log('💳 Plans created');
  }

  // Seed questions, tests, and videos (unless quick mode)
  if (!CONFIG.quickSeed && !CONFIG.preserveExisting) {
    const questions = getQuestions(admin._id, teacher._id);
    const sscQs = await Question.insertMany(questions.ssc);
    const bankQs = await Question.insertMany(questions.banking);
    console.log('❓ Questions created');

    await Test.create([
      { title: 'SSC CGL Tier-1 Mock Test 1', description: 'Complete SSC CGL mock test covering all sections.', category: 'SSC', questions: sscQs.map(q => q._id), totalQuestions: sscQs.length, duration: 60, totalMarks: sscQs.length * 2, marksPerQuestion: 2, negativeMarking: true, negativeMarks: 0.5, difficulty: 'Medium', isActive: true, createdBy: admin._id, instructions: ['Each correct answer = 2 marks', 'Negative marking: -0.5 per wrong answer'] },
      { title: 'Banking Awareness Mock Test', description: 'Test your banking knowledge for IBPS, SBI exams.', category: 'Banking', questions: bankQs.map(q => q._id), totalQuestions: bankQs.length, duration: 30, totalMarks: bankQs.length, marksPerQuestion: 1, negativeMarking: false, difficulty: 'Easy', isActive: true, createdBy: admin._id },
    ]);
    console.log('📝 Tests created');

    await Video.insertMany(getVideos(admin._id));
    console.log('🎥 Videos created');
  }

  console.log('\n✅ Janta Exam database seeded!');
  console.log('🔐 Credentials:');
  console.log('   Admin:   admin@jantaexam.com   / admin123');
  console.log('   Teacher: teacher@jantaexam.com / teacher123');
  console.log('   User:    user@jantaexam.com    / user123');
  
  mongoose.connection.close();
};

seed().catch(err => { console.error(err); process.exit(1); });
