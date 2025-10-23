# Chitrack starter project

# Implementation Guide
Link to the implementation guide: [Implementation Guide](./PRDs/one-page-implementation-guide.MD)
Link to the migration plan: [Migration to React Native App on Expo](./PRDs/migration-plan.md)

## Environment Variables

Copy `.env.example` to `.env.local` and populate the secrets:

- `CTA_TRAIN_API_KEY` – existing CTA train tracker key.
- `CTA_BUS_TRACKER_API_KEY` – server-only key for the CTA Bus Tracker v3 API.
- `CTA_BUS_RTPIDATAFEED` – optional feed identifier (defaults to `ctabus` when omitted).
- Analytics, Supabase, Redis, and Mapbox values follow the same naming as in the example file.


