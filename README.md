# Plutonea | Home Services and Next Deal

React 18, TypeScript, and Vite frontend for the Plutonea API. It has two sections: Home Services and Next Deal. Cars are a category inside Next Deal, and buyers and sellers contact each other through ad-based chats. One OAuth account and profile work across both sections.

## Run locally

1. Apply the backend upgrade script `D:\Applications\DIVIAIX_CHS\PlutoneaAPI\database\migrations\20261026_classifieds_chat_upgrade_idempotent.sql` to a database with EF migrations enabled.
2. Configure Google OAuth and start the API. The development launch profile uses `https://localhost:7085`.
3. Copy `.env.example` to `.env.local`; set `VITE_API_URL` if the API uses another origin.
4. Run:

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## Roles and flows

- Users sign in or create an account using Google OAuth 2.0. The same identity can book Home Services, apply to become a service partner, post Next Deal ads, and chat with buyers or sellers.
- The configured Admin uses the same OAuth button. The admin workspace separates Home Services moderation (service posts, partners, and bookings) from Next Deal ad moderation in distinct tabs.
- Approved partners retain customer booking access. The account menu switches between customer and partner workspaces.
- Next Deal does not take in-app payments. Cars remain a category with structured car details and free test-drive requests.
- Chat threads are available from the Next Deal navigation and profile menu. The frontend refreshes chat threads every few seconds so messages appear without a page reload.
- Guest home-service cart items are kept locally and synchronized after OAuth sign-in. Signed-in cart and bookings use the API.
- The API's development mock payment can complete checkout. Live Razorpay order creation and verification endpoints exist, but the browser checkout handoff is not enabled in this frontend yet.

## Build

```bash
npm run build
```

