# Finance Tracker — Setup Guide

## Step 1: Create a Firebase project (5 min, free)

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it "finance-tracker" → Continue
3. Disable Google Analytics (not needed) → **Create project**

### Enable Google Sign-In
1. In the left sidebar: **Authentication** → **Get started**
2. Click **Google** under Sign-in providers → Enable → add your email as support email → **Save**

### Enable Firestore
1. In the left sidebar: **Firestore Database** → **Create database**
2. Choose **Start in production mode** → pick a region close to you (e.g. asia-southeast1) → **Enable**

### Get your config
1. Click the gear icon → **Project settings**
2. Scroll to **Your apps** → click **</>** (web) → name it "finance-tracker" → **Register app**
3. Copy the `firebaseConfig` object — you'll need these values

## Step 2: Add your Firebase config

In the `finance-tracker` folder, create a file called `.env`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
```

## Step 3: Set Firestore security rules

In Firebase Console → Firestore → **Rules** tab, replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**. This means only you can see your own data.

## Step 4: Run locally

```bash
cd finance-tracker
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Step 5: Deploy to Vercel (free, accessible from any device)

1. Push the folder to a private GitHub repo
2. Go to https://vercel.com → Import the repo
3. In **Environment Variables**, add all 6 VITE_ variables from your .env
4. Click **Deploy** → you'll get a URL like `finance-tracker-abc.vercel.app`

Bookmark this URL on your phone and Mac. On iPhone, tap **Share → Add to Home Screen** to install it like an app.

## Sync across devices

Once deployed to Vercel, your data syncs in real-time via Firebase:
- Open the URL on your iPhone, Mac, or any PC
- Sign in with the same Google account
- All data appears instantly on every device
- Works offline too — changes sync when you reconnect

## Investment prices (optional)

The app supports auto-fetching prices via Alpha Vantage (free, 25 req/day):
1. Sign up at https://www.alphavantage.co/support/#api-key (free)
2. In the app: Investments → tap any holding → paste your API key → tap the refresh icon
