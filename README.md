# ZimVault
Create, earn, do campaigns in Zimbabwe in one webapp.

## Local static app

Open the project in any static host and ensure the `index.html` file is served as the root page.

## Production deployment

This repo is set up for a static frontend plus serverless API functions. The recommended deployment is Vercel.

### Required environment variables
Create a `.env.local` file or add these to your hosting dashboard:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYNOW_INTEGRATION_ID`
- `PAYNOW_INTEGRATION_KEY`

### API endpoint

- `/api/paynow-initiate`

This endpoint receives a payment request, initializes a PayNow EcoCash payment, and stores the transaction in Supabase.

### Supabase tables

Recommended tables:

```sql
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  content_id bigint,
  title text,
  buyer_phone text,
  creator_id bigint,
  amount numeric,
  platform_fee numeric,
  creator_payout numeric,
  status text default 'pending',
  reference text
);
```

### Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add the environment variables above.
4. Set the build command to `npm install` and output directory to `.`
5. Deploy.

### Notes

- The frontend uses demo data until real Supabase data is connected.
- The PayNow integration is a production server-side integration; do not expose the secret keys in client-side code.
