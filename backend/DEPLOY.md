# Backend Deployment Notes

## Production Requirements

- Use a public HTTPS URL for the backend.
- Store SQLite on a persistent disk, not temporary server storage.
- Set admin and SMTP environment variables from a secret manager or hosting dashboard.

## Files Added

- `.env.example` shows the required environment variables.
- `render.yaml` is a ready deployment example for a Node host with a persistent disk.
- `src/db.js` supports `DB_PATH` so the database can live on mounted storage.

## Minimum Environment Variables

```bash
PORT=4001
DB_PATH=/var/data/hotline.db
ADMIN_USER=admin
ADMIN_PASS=strong-password
FEEDBACK_TO_EMAIL=your@email.com
MAIL_FROM=Hotline App <your@email.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
```

## After Deployment

- Verify `https://your-backend-domain/health`
- Update `mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=https://your-backend-domain
```

- Restart Expo locally before creating production builds.
