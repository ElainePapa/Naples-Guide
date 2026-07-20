# Naples Guest Guide

Public digital welcome book for the Naples, FL home. Guests open a link/QR (no login);
the owner signs in (🔑) to edit text, Wi-Fi, codes, videos, and upload photo grids.

- Stack: buildless PWA + Supabase (shared project). Photos in the `guide` storage bucket.
- Setup: run `supabase-guide.sql` once in Supabase.
- Local preview: `python3 serve.py` → http://localhost:8791
