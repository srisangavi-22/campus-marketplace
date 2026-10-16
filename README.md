# Campus Marketplace

A cross-platform campus marketplace built with React Native and Expo. Students can discover items, publish and manage listings, save favorites, and contact sellers.

**Repository:** [srisangavi-22/campus-marketplace](https://github.com/srisangavi-22/campus-marketplace)

## Project description

Campus Marketplace provides a focused place for students to buy and sell items within their campus community. The project was extended from an existing application as a group assignment; it is not a production service.

## Group members

| Registration No | Group Member Name |
| --- | --- |
| 2023/CSC/041 | Manivannan Nirmalan |
| 2023/CSC/055 | Pathmaraj Gowsihan |
| 2023/CSC/066 | Sriranganathan Sangavi |
| 2023/CSC/083 | Manoharan Aboorva |
| 2023/CSC/089 | Saththiyesvaran Kethursan |

## Features implemented

- **Explore and search:** Search listings and narrow results by category.
- **Price filtering:** Apply preset or custom minimum and maximum prices with input validation.
- **Create listings:** Add an item with listing details, category, price, condition, pickup information, and an image.
- **Manage listings:** View, edit, and delete your listings; adjust inventory and record sales. Listings reflect available or sold-out status.
- **Seller messaging:** Start and continue conversations about listings, with messages synchronized through Firestore.
- **Saved listings:** Save and remove favorites, and view them on the Saved page. Signed-in users' saved listing IDs are stored in Firestore.
- **Authentication and profile:** Sign in with email/password or Google, update profile information, and choose a profile photo.
- **Responsive interface:** Use the same React Native application on the web and on mobile devices.

## Technologies used

- React Native `0.86.2`, Expo SDK `57`
- TypeScript `6`
- React `19`
- React Native Web
- Firebase Authentication, Cloud Firestore, and Firebase Storage
- AsyncStorage for session persistence
- Expo Image Picker for selecting profile and listing images

## How to run the project

### Requirements

- Node.js `22.13` or newer
- npm
- For mobile testing: Expo Go, or Android Studio for Android emulation. Building/running the iOS native app requires macOS and Xcode.

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/srisangavi-22/campus-marketplace.git
cd campus-marketplace
npm install
```

### 2. Configure Firebase (optional for demo mode)

Create a Firebase project and register a web app. Enable the authentication providers the team will use (Email/Password and Google), create a Cloud Firestore database, and enable Firebase Storage if profile or listing image uploads are needed.

Create a `.env` file in the project root with the Firebase web app configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

The optional `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` setting can be used when configuring a separate Google OAuth web client. Configure the matching authorized origins and redirect settings in Google Cloud/Firebase for the platforms you test.

The `.env` file is excluded from Git. Do not commit service-account keys or other private credentials. Firebase client configuration is not a substitute for access control: review and deploy the repository's `firestore.rules` and `storage.rules` to your own Firebase project before using cloud features.

Without the Firebase settings, the app initializes with sample listings and a demo profile. Firebase-backed sign-in, synchronization, messaging, and image storage require a configured Firebase project.

The repository includes Firestore indexes and rules in `firestore.indexes.json` and `firestore.rules`, and Storage rules in `storage.rules`. Configure your Firebase project first, then deploy or apply these rules using the Firebase Console or Firebase CLI. Review the rules against your project before deployment.

### 3. Start the app

**Web browser**

```bash
npm run web
```

After installing dependencies in Step 1, this starts the web app. Open the local URL printed by Expo in the terminal.

**Expo Go on a phone**

```bash
npm run start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Your phone and development computer should be able to reach each other over the network.

**Native emulators**

```bash
npm run android
npm run ios
```

Android requires Android Studio and a configured Android SDK. The iOS command requires macOS with Xcode.

## Brief description of each member's contribution

| Group member | Contribution |
| --- | --- |
| **Manivannan Nirmalan (2023/CSC/041)** | Implemented listing creation and management, seller messaging, inventory updates, and sold-out status. Also improved sold-item status and messaging behavior. |
| **Pathmaraj Gowsihan (2023/CSC/055)** | Improved the UI/UX, layout, listing-card presentation, and mobile/web usability, including saved-listing interaction improvements. |
| **Sriranganathan Sangavi (2023/CSC/066)** | Implemented saved/favorite listings and Firestore persistence; coordinated pull-request reviews, conflict resolution, and integration into `main`. |
| **Manoharan Aboorva (2023/CSC/083)** | Improved authentication and profile management, including sign-in validation. |
| **Saththiyesvaran Kethursan (2023/CSC/089)** | Contributed price-range filtering, search, category filtering, and custom price validation improvements. |
