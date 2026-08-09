# Firebase Authentication

BioBridge uses Firebase Authentication for login/signup while Supabase remains the database/vector backend.

Supported methods:
- Email + password sign up
- Email + password login
- Google login
- Password reset email

The Firebase browser SDK is loaded from the official Firebase CDN in `index.html`, so no `firebase` npm package is required.

Backend requests send the Firebase ID token as:

`Authorization: Bearer <firebase-id-token>`

The Supabase Edge Function verifies that token through Firebase Identity Toolkit and uses the Firebase UID as the document owner key. This prevents one Firebase user from retrieving another user's uploaded documents.
