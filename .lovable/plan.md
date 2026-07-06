## Doel

Vervang Resend door directe verzending via Microsoft 365 (Graph API) met een Entra app-registratie en client credentials. Mail vertrekt vanuit `schadeformulier@welzeker.be`. Alles binnen Microsoft, geen externe mailprovider.

## Wat IT bij WelZeker eenmalig moet doen

1. In **Microsoft Entra admin center → App registrations → New registration**:
   - Naam: bv. `Lovable Schadeformulier`
   - Single tenant
2. **API permissions → Add → Microsoft Graph → Application permissions**:
   - `Mail.Send` (application, niet delegated)
   - Klik **Grant admin consent**
3. **Certificates & secrets → New client secret** → kopieer de *Value* (eenmalig zichtbaar).
4. Noteer **Application (client) ID** en **Directory (tenant) ID**.
5. (Aanbevolen, principle of least privilege) Beperk de app tot enkel het postvak `schadeformulier@welzeker.be` via een **ApplicationAccessPolicy** in Exchange Online PowerShell:
   ```powershell
   New-DistributionGroup -Name "LovableMailSenders" -Type Security -Members schadeformulier@welzeker.be
   New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId LovableMailSenders@welzeker.be -AccessRight RestrictAccess -Description "Lovable schadeformulier — enkel schadeformulier mailbox"
   ```
   Zonder deze policy kan de app-registratie technisch namens élk postvak sturen.

Daarna geven ze mij drie waarden door, die ik veilig opsla als secrets:
- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`

## Wat ik in de app aanpas

1. **Nieuwe secrets aanvragen** via de secret-tool: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
2. **`src/routes/api/public/send-schade.ts` herschrijven**:
   - Verwijder Resend-gateway call.
   - Haal een OAuth2 access token op bij `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` met `grant_type=client_credentials` en `scope=https://graph.microsoft.com/.default`.
   - POST naar `https://graph.microsoft.com/v1.0/users/schadeformulier@welzeker.be/sendMail` met body:
     ```json
     {
       "message": {
         "subject": "SCHADEFORMULIER <code>",
         "body": { "contentType": "Text", "content": "<exact JSON>" },
         "toRecipients": [{ "emailAddress": { "address": "schadeformulier@welzeker.be" } }]
       },
       "saveToSentItems": true
     }
     ```
   - Onderwerp, ontvanger en body-inhoud blijven exact zoals nu (JSON platte tekst, zelfde sleutels).
   - Fout-afhandeling: 502 bij Graph-fout met status + detail, 500 bij ontbrekende secrets.
3. **Resend-connector loskoppelen** (optioneel) na bevestiging dat Graph werkt, zodat `RESEND_API_KEY` verdwijnt.
4. **`src/routes/index.tsx`** blijft ongewijzigd — de front-end weet niets van de mailroute.

## Volgorde

1. Jij bevestigt dit plan.
2. IT levert de drie waarden aan → ik vraag ze op via de secret-form.
3. Ik herschrijf de send-route en test met een dummy inzending.
4. Na succesvolle test: Resend-connector loskoppelen.

## Aandachtspunten / eerlijke risico's

- **Client secret vervalt**: standaard 6-24 maanden; IT moet dit tijdig verlengen, anders stopt mailverzending. Certificate-based auth zit er niet in vanwege runtime-beperkingen.
- **ApplicationAccessPolicy**: sterk aangeraden. Zonder policy heeft de app-registratie theoretisch `Mail.Send` op elk postvak in de tenant. Met policy: enkel `schadeformulier@welzeker.be`.
- **Verzonden items**: `saveToSentItems: true` zorgt dat een kopie in het postvak Verzonden Items van `schadeformulier@welzeker.be` staat — handig voor audit.
- Bij het uitrollen: 1 sturingsverandering in de backend, geen wijziging aan het formulier zelf.
