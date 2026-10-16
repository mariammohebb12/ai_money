AI Money: AI Personal Finance App
AI Money is an AI-powered personal finance app for iOS and Android that helps people track spending, savings and bills, and turns their data into clear insights. I built the whole cross-platform experience with React Native, Expo and Supabase.

Features
Expense and bill tracking

Categorize income and expenses
Set custom savings goals
Manage recurring bills
Analytics

Spending breakdowns by category
Date filtering
Automated financial insights on the Home and Analytics screens
AI financial coach

OpenAI-powered coach that answers natural-language questions about your own data, for example "how much did I spend on food?"
Answers are based on the user's real financial records
Tech stack
React Native with Expo
TypeScript
Supabase (PostgreSQL and authentication)
OpenAI API
Challenges and solutions
Secure, real-time relational data with fast AI answers. Financial data is relational and private, and the coach needs it quickly. I designed the database schema around the questions users ask, and kept the Supabase and OpenAI integration layers lean, so screens render smoothly and answers come back fast.

Getting started
bash
npm install
npx expo start
Then press i for the iOS simulator, a for the Android emulator, or scan the QR code with Expo Go.

Database: create a Supabase project and add your Supabase URL and anon key plus your OpenAI key to the app's environment configuration. Demo data is available in seed-demo-data.sql, and undo-seed-demo-data.sql removes it.

Author
Mariam Moheb, mobile and full-stack developer.

Claude finished the response
