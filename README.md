<<<<<<< HEAD
# Campus Marketplace

Expo SDK 57 React Native app for buying and selling items within a campus community.

## Run locally

Expo SDK 57 requires Node 22.13 or newer.

```bash
cp .env.example .env
npm install
npm run web
```

The app runs in demo mode until Firebase values are added to `.env`.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. Enable Google Authentication under Authentication > Sign-in method. Anonymous Authentication remains available for native fallback.
3. Create a Cloud Firestore database.
4. Copy the Web app configuration into `.env` using `.env.example`.
5. Deploy `firestore.rules` with the Firebase CLI or paste them into the Firestore Rules tab.
6. Enable Firebase Storage and deploy `storage.rules`; profile images are stored at `profilePhotos/{uid}` and are limited to the owner's account and images under 5 MB.

The app uses:

- `listings`: public reads, authenticated seller-owned creates and edits.
- `users/{uid}` and `users/{uid}/saved/{listingId}`: owner-only access.
- `conversations`: members-only access, with messages in a subcollection.

The client Firebase configuration is intentionally public. Access control belongs in Authentication, Firestore Rules, and App Check; never put Admin SDK credentials in this app.

## Current product flows

- Explore listings with search and category filters.
- Browse and search without signing in; Google sign-in is required to contact sellers or publish listings.
- Save and unsave listings.
- Open a listing detail view and start a seller conversation.
- Publish a basic listing through the Sell flow.
- Sign in anonymously for a frictionless student account.
- View Saved, Messages, and Profile pages.
=======
