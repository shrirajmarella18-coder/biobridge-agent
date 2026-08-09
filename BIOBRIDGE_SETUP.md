# BioBridge AI — Firebase Auth + RAG + Web Research

## Architecture
- Firebase Authentication: Google + email/password login and signup.
- Supabase: database, pgvector and Edge Function backend.
- Supabase `gte-small`: 384-dimension document/query embeddings.
- Groq Llama 3.3 70B: medium/large technical-document generation.
- Tavily: live internet research.

## 1. Firebase setup
1. Create/open a Firebase project.
2. Add a Web app under Project settings.
3. Copy the web config values into `.env` as the `VITE_FIREBASE_*` variables.
4. Firebase Console → Authentication → Sign-in method → enable **Email/Password** and **Google**.
5. Authentication → Settings → Authorized domains: add `localhost` and your Netlify domain.

The frontend uses the Firebase browser SDK loaded from the official Google CDN in `index.html`.

## 2. Supabase secrets
Run: 

```bash
npx supabase login
npx supabase link --project-ref fekibyopqjdmvlgrqiiy
npx supabase secrets set GROQ_API_KEY=YOUR_GROQ_KEY
npx supabase secrets set TAVILY_API_KEY=YOUR_TAVILY_KEY
npx supabase secrets set FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
npx supabase secrets set FIREBASE_WEB_API_KEY=YOUR_FIREBASE_WEB_API_KEY
```

`FIREBASE_WEB_API_KEY` is the browser API key from the Firebase web app config. It is not a service-account private key.

## 3. Database migration
Apply both migrations in `supabase/migrations/` in order. The Firebase migration changes document ownership from Supabase Auth UUIDs to Firebase Auth UIDs and updates `match_chunks()` to filter by Firebase UID.

## 4. Deploy

```bash
npx supabase functions deploy biobridge --no-verify-jwt
npm install
npm run dev
```

## 5. Netlify
Set the same `VITE_FIREBASE_*` and `VITE_SUPABASE_*` values as environment variables. Build command: `npm run build`; publish directory: `dist`.

## 6. What generation does
Every generation attempts both: (a) retrieval from the user's uploaded PDF/DOCX documents and (b) live Tavily web research. Groq receives both evidence sets and is instructed to cite uploaded evidence as `[D1]`, `[D2]` and web evidence as `[W1]`, `[W2]`. Responses are configured for medium-to-large technical outputs.

If Tavily is not configured, the app still works with uploaded-document RAG and Groq, but live web research will be unavailable.

## Official Firebase references
- Firebase web setup: https://firebase.google.com/docs/web/setup
- Email/password authentication: https://firebase.google.com/docs/auth/web/password-auth
- Google authentication: https://firebase.google.com/docs/auth/web/google-signin
