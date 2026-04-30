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

## Environment Variables

Create a `.env.local` at the project root with the following entries:

```bash
# Required — Google Gemini key used for prompt enrichment and the default image backend.
NEXT_PUBLIC_GEMINI_API_KEY="<your-gemini-api-key>"

# Optional — enables the Azure OpenAI gpt-image-2 backend in Step 3 of Footwear VTON.
# If either variable is missing, the UI toggle still renders but generation falls back
# to Gemini with an error message.
NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/openai/deployments/gpt-image-2/images/edits?api-version=2025-04-01-preview
NEXT_PUBLIC_AZURE_OPENAI_KEY="<your-azure-api-key>"
```

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
