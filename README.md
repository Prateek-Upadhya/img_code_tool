This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment Variables & Vertex AI auth

All Gemini/Veo calls run **server-side** through Vertex AI. No model credential is
ever sent to the browser — the React app calls our own route handlers
(`/api/gemini/*`, `/api/veo/*`), which authenticate to Vertex AI using
server-held credentials (`src/lib/vertex-server.ts`).

Create a `.env.local` at the project root:

```bash
# Required — your Google Cloud project + region (or "global").
GCP_PROJECT_ID="<your-gcp-project-id>"
GCP_LOCATION="global"

# Authentication — the server uses the FIRST that applies:
#   1. ADC (recommended for local dev) — no key material on disk:
#        gcloud auth application-default login
#        gcloud config set project <your-gcp-project-id>
#   2. Service-account JSON inline (best for serverless/Vercel):
#        GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
#   3. Service-account key file path:
#        GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/sa.json"

# Optional — enables the Azure OpenAI gpt-image-2 backend in Step 3 of Footwear VTON.
NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/openai/deployments/gpt-image-2/images/edits?api-version=2025-04-01-preview
NEXT_PUBLIC_AZURE_OPENAI_KEY="<your-azure-api-key>"
```

The service account (or your ADC identity) needs the **Vertex AI User**
(`roles/aiplatform.user`) role on the project. `.env*` is git-ignored, so no
credential is committed. `NEXT_PUBLIC_GEMINI_API_KEY` is no longer used — anything
prefixed `NEXT_PUBLIC_` is bundled into the browser and readable by end users.

> Note: the Azure OpenAI backend still uses `NEXT_PUBLIC_*` keys (client-side) and
> was out of scope for the Vertex migration. Move it behind a route handler too if
> you need the same protection for that path.

Notes on the Azure endpoint:

- The URL path **must** be `/images/edits`, not `/images/generations`. Footwear VTON always carries reference images (product + optional model + optional complementary garments + accessories); `/images/generations` is text-to-image only and rejects image inputs. If you paste a `/generations` URL by mistake, the integration strips and replaces it with `/edits` at runtime.
- Use `api-version=2025-04-01-preview` or newer. `2024-02-01` predates gpt-image-2 and will return a deployment-not-found error.
- The endpoint is deployment-specific — the `gpt-image-2` segment in the path is your Azure OpenAI **deployment name**, not the model slug. Rename if your deployment uses a different identifier.


This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
