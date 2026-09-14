# Push server

Detta är serversidan för riktiga Web Push-notiser.

## 1. Generera VAPID-nycklar

Lokalt i push-server-mappen:

```bash
npm install
npm run generate-vapid
```

Spara publicKey och privateKey.

- `publicKey` får användas av appen/servern.
- `privateKey` ska bara ligga som hemlig miljövariabel på servern.

## 2. Apps Script

I Apps Script:
Project Settings → Script Properties

Lägg till:

`PUSH_BACKEND_TOKEN`

med samma hemliga värde som du senare sätter på push-servern.

## 3. Cloud Run

Exempel:

```bash
gcloud run deploy min-hjalp-push --source . --region europe-north1 --allow-unauthenticated
```

Lägg sedan in miljövariablerna från `.env.example` i Cloud Run.

## 4. Cloud Scheduler

Skapa ett jobb som anropar:

`POST https://DIN-CLOUD-RUN-URL/tick`

varje minut.

Skicka header:

`x-cron-secret: <ditt CRON_SECRET>`

## 5. Min hjälp

I appen:
Inställningar → Pushnotiser → Push-server URL

Klistra in Cloud Run-URL:n.

Tryck sedan:
`Aktivera push på den här enheten`

och därefter:
`Skicka testnotis`

## Viktigt om lagring

Pushprenumerationen sparas fortfarande i Google Sheets via Apps Script från Version 8.
Cloud Run läser aktiva prenumerationer från Apps Script vid varje tick.

Cloud Run har även en liten minnescache för nyregistrerade enheter, men den är inte tänkt som permanent lagring.
