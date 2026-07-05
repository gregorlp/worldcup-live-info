# World Cup Live Info — Azure API Management + OAuth 2.0

Dashboard en vivo del Mundial 2026 construido como excusa para practicar **Azure API Management (APIM)** en un caso real: autenticación OAuth 2.0, seguridad de gateway, políticas y monitoreo.

> El objetivo de este proyecto **no fue construir una app de fútbol**, sino practicar Azure API Management y su integración con Microsoft Entra ID en un escenario productivo.

---

## Arquitectura

```
Navegador (cliente)
      │  Solo ve HTML/JS — ninguna llamada a Azure es visible aquí
      ▼
Next.js (Vercel) — Frontend + BFF (server-side)
      │  1. Verifica si hay token cacheado en memoria (~1h)
      │     → si no, solicita uno nuevo a Microsoft Entra ID
      │       (OAuth 2.0, grant_type=client_credentials)
      │  2. Llama a APIM con:
      │       Authorization: Bearer <token>
      │       Ocp-Apim-Subscription-Key: <key>
      ▼
Azure API Management (gateway)
      │  - Valida subscription key
      │  - Valida JWT (audience, issuer, required-claims por rol)
      │  - Rate limiting (20 req / 60s)
      │  - Named values: tenant ID, app ID, API key (nada hardcodeado)
      │  - Inyecta el header con la API key real hacia el backend
      │  - Log Analytics + KQL: diagnostics y consulta de tráfico
      │  - Ocp-Apim-Trace: debugging visual del flujo de policies
      ▼
football-data.org (API externa)
      → datos del Mundial 2026
```

**Stack:** Next.js · Azure API Management · Microsoft Entra ID · Vercel

---

## Autenticación: OAuth 2.0 client credentials

Este proyecto usa el flujo **client credentials** de OAuth 2.0, pensado para comunicación servicio-a-servicio (sin usuario interactivo):

1. El servidor de Next.js solicita un token a Entra ID:
   ```
   POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=client_credentials
   client_id={client_id}
   client_secret={client_secret}
   scope=api://{app_id}/.default
   ```
   El `scope` debe terminar en **`/.default`**: indica permisos de aplicación (no delegados), que es lo que corresponde en un flujo servicio-a-servicio sin usuario interactivo. Con un scope mal formado, Entra ID no emite el token.
2. Entra ID devuelve un `access_token` (JWT) válido por ~1 hora.
3. Ese token se **cachea en memoria** en el servidor y se reutiliza hasta poco antes de expirar, para no pedir uno nuevo en cada request (reduce llamadas a Entra ID y mejora la latencia).
4. Cada llamada a APIM incluye `Authorization: Bearer <token>` + `Ocp-Apim-Subscription-Key`.

**Seguridad de secretos:** todas las llamadas a Azure ocurren server-side (`import "server-only"` en `lib/azure-token.ts` y `lib/football-api.ts`). El navegador nunca ve el token, el client secret ni la API key — quedan fuera del control de versiones, como variables de entorno.

---

## Policy de APIM (`validate-jwt`)

APIM valida el JWT en el `<inbound>` antes de dejar pasar cualquier request:

```xml
<validate-jwt header-name="Authorization" failed-validation-httpcode="401"
              failed-validation-error-message="Unauthorized. Invalid or missing token."
              require-expiration-time="true" require-scheme="Bearer">
    <openid-config url="https://login.microsoftonline.com/{{entra-tenant-id}}/.well-known/openid-configuration" />
    <audiences>
        <audience>api://{{football-app-id}}</audience>
    </audiences>
    <issuers>
        <issuer>https://sts.windows.net/{{entra-tenant-id}}/</issuer>
    </issuers>
    <required-claims>
        <claim name="roles" match="any">
            <value>API.Read.Football</value>
        </claim>
    </required-claims>
</validate-jwt>
<set-header name="X-Auth-Token" exists-action="override">
    <value>{{football-data-api-key}}</value>
</set-header>
<rate-limit calls="20" renewal-period="60" />
```

Tenant ID, App ID y la API key real están externalizados como **named values** (los dos primeros como *plain*, la key como *secret*) — así el XML de la policy nunca expone datos sensibles, aunque se comparta públicamente.

Tres capas de seguridad distintas, que conviene no confundir:
- **Subscription key** (`Ocp-Apim-Subscription-Key`): identifica al consumidor/producto.
- **JWT (`validate-jwt`)**: valida identidad y autorización real vía Entra ID.
- **"User authorization" del portal** (Settings de la API): es solo una ayuda para que la Test console adquiera tokens automáticamente — no impone seguridad en el gateway.

---

## Pasos de configuración

Guía paso a paso para replicar este setup desde cero. Todo lo hecho acá funciona con la **suscripción gratuita (Free tier) de Azure** — no se necesita ningún plan de pago.

Separado por dónde ocurre cada paso: **Azure Portal** (infraestructura y seguridad del gateway) vs **Vercel / código** (la aplicación que consume ese gateway).

### 🔷 Azure Portal

#### 1. Microsoft Entra ID — dos App Registrations

Este es el punto que más confunde al principio: hacen falta **dos** App Registrations distintas, con roles distintos. Una representa **a la API** (lo que se protege), la otra representa **al cliente** (quién puede consumirla).

**1.a — App Registration de la API** (ej. `football-data-api`)
- Azure Portal → Microsoft Entra ID → App registrations → **New registration**.
- No necesita redirect URI (es una API, no una app con login interactivo).
- Una vez creada, andá a **Expose an API** → **Add a scope / Application ID URI**. Azure sugiere algo como `api://<APP_ID>`; podés aceptarlo. Este valor es tu **audience** para `validate-jwt`.
- En **App roles** → **Create app role**: definí un rol de tipo *Application* (no *User*), por ejemplo:
  - Display name: `Read Football Data`
  - Value: `API.Read.Football` (este es el valor que después exige la policy `required-claims`)
  - Allowed member types: **Applications**

**1.b — App Registration del cliente** (ej. `football-data-client`)
- Azure Portal → Microsoft Entra ID → App registrations → **New registration**.
- Tampoco necesita redirect URI (usa client credentials, sin usuario interactivo).
- Anotá el **Application (client) ID** y el **Directory (tenant) ID** — ambos están en la página **Overview** de esta app registration.
- **Certificates & secrets** → **New client secret** → copiar el valor inmediatamente (no se vuelve a mostrar).
- **API permissions** → **Add a permission** → **My APIs** → seleccionar `football-data-api` (la del paso 1.a) → **Application permissions** → marcar `API.Read.Football` → **Add permissions**.
- Con el botón **Grant admin consent**, se aprueba el permiso (necesario porque son permisos de aplicación, no delegados).

Con esto, el cliente ya tiene "asignado" el rol, y cuando pida un token, Entra ID va a incluir `"roles": ["API.Read.Football"]` dentro del JWT — que es justo lo que la policy `validate-jwt` va a exigir más adelante.

**Datos que quedan disponibles después de este paso:**
| Dato | De dónde sale | Para qué se usa |
|---|---|---|
| Tenant ID | Overview de cualquiera de las dos apps (es el mismo tenant) | `openid-config`, URL del token, issuer |
| Client ID | Overview de la app *cliente* (1.b) | Pedir el token (`client_id`) |
| Client secret | Certificates & secrets de la app *cliente* (1.b) | Pedir el token (`client_secret`) |
| App ID URI / audience | Expose an API de la app *API* (1.a) | `scope` al pedir el token, y `audience` en `validate-jwt` |
| Rol (`API.Read.Football`) | App roles de la app *API* (1.a) | `required-claims` en `validate-jwt` |

#### 2. Azure API Management — crear la instancia y la API

- Azure Portal → **Create a resource** → buscar **API Management** → Create.
- Elegir el tier **Consumption** (o el que ofrezca el free tier según la región) para no generar costos.
- Una vez provisionada la instancia (puede tardar unos minutos), entrar a ella.
- **APIs** → **Add API** → **OpenAPI** → pegar la URL de la definición OpenAPI de la API pública que estés consumiendo (en este caso, la de football-data.org) o subir el archivo si la ofrecen como spec descargable.
- Azure genera automáticamente todas las operaciones (endpoints) a partir de esa definición.
- **Products** (menú lateral) → crear o usar el product por defecto → asociarle esta API → esto es lo que genera la **Subscription** y su `Ocp-Apim-Subscription-Key`.
- Desde **Subscriptions**, generar (o copiar) la key para usarla después desde el cliente.

#### 3. Policies — diseño y orden

Las policies se escriben en el `<inbound>` de la API (o de una operación puntual) y se ejecutan en el orden en que aparecen. El orden importa:

1. **`validate-jwt`** primero — si el token no es válido, corta acá y no sigue.
2. **`rate-limit`** — throttling para no saturar la API externa.
3. **`set-header`** — recién acá se inyecta la API key real hacia el backend, una vez que ya se validó que quien pide tiene permiso.

```xml
<inbound>
    <base />
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401"
                  failed-validation-error-message="Unauthorized. Invalid or missing token."
                  require-expiration-time="true" require-scheme="Bearer">
        <openid-config url="https://login.microsoftonline.com/{{entra-tenant-id}}/.well-known/openid-configuration" />
        <audiences>
            <audience>api://{{football-app-id}}</audience>
        </audiences>
        <issuers>
            <issuer>https://sts.windows.net/{{entra-tenant-id}}/</issuer>
        </issuers>
        <required-claims>
            <claim name="roles" match="any">
                <value>API.Read.Football</value>
            </claim>
        </required-claims>
    </validate-jwt>
    <set-header name="X-Auth-Token" exists-action="override">
        <value>{{football-data-api-key}}</value>
    </set-header>
    <rate-limit calls="20" renewal-period="60" />
</inbound>
```

Antes de escribir la policy, crear los **named values** (menú lateral de APIM → Named values → + Add):
- `entra-tenant-id` (plain) — el Tenant ID.
- `football-app-id` (plain) — el App ID URI de la app-API (paso 1.a).
- `football-data-api-key` (**secret**) — la API key real de football-data.org.

#### 4. Monitoreo

- APIM → **Diagnostic settings** (o "Monitoring" según la versión del portal) → crear un **workspace de Log Analytics** si no existe uno, y conectarlo.
- Con el workspace conectado, desde **Logs** (dentro de APIM o del workspace) se pueden correr consultas **KQL** sobre el tráfico real.
- Para debugging puntual de una request, usar **Ocp-Apim-Trace**: en la Test console de una operación, activar el toggle "Trace" antes de mandar el request — la respuesta incluye una pestaña **Trace** con cada policy ejecutándose paso a paso.

> **Obstáculos reales encontrados:**
> - El tráfico no aparece al instante: **Metrics** refleja datos en ~1–2 min, pero **Log Analytics tarda entre 2 y 10 min** en ingerir para que las consultas KQL lo muestren. No es un fallo, es latencia de ingesta normal.
> - La **caché de la app** (Next.js) hacía que no se generara tráfico nuevo hacia APIM en cada request, lo que dificultaba ver movimiento en los logs. Para forzar tráfico real y generar trace, conviene pegarle directo al gateway con Bruno, curl o la Test console.

#### 5. Testing del flujo en el propio portal

- APIs → tu API → una operación → pestaña **Test**.
- La subscription key se completa sola si seleccionás el product/subscription arriba.
- El token **no** se completa solo (salvo que configures un servidor OAuth 2.0 en APIM): hay que pegarlo a mano en un header `Authorization: Bearer <token>`, obtenido antes con el POST del paso siguiente.

### 🔶 Vercel / código de la aplicación

#### 6. Validación externa del flujo (antes de integrar código)

Con Bruno, Postman o curl, replicar el flujo completo en dos pasos, para confirmar que la configuración de Azure funciona antes de escribir código:

```
POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id={client_id}
client_secret={client_secret}
scope=api://{app_id}/.default
```

Con el `access_token` de la respuesta, llamar a APIM:
```
GET https://{tu-instancia}.azure-api.net/{tu-api}/{operacion}
Authorization: Bearer {access_token}
Ocp-Apim-Subscription-Key: {subscription_key}
```

#### 7. Integración con Next.js
- `lib/azure-token.ts`: obtiene y cachea el token en memoria (server-side).
- `lib/football-api.ts`: cliente que llama a APIM con token + subscription key (server-side).
- Ambos archivos marcados `import "server-only"` para garantizar que nunca se ejecuten en el navegador.

#### 8. Configuración en Vercel
- Variables de entorno del proyecto:
  ```
  AZURE_TENANT_ID
  AZURE_CLIENT_ID
  AZURE_CLIENT_SECRET
  AZURE_TOKEN_SCOPE
  APIM_SUBSCRIPTION_KEY
  FOOTBALL_DATA_API_KEY
  ```
- Deploy del frontend + BFF en Vercel, consumiendo APIM como único punto de entrada a datos externos.

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TOKEN_SCOPE=
APIM_SUBSCRIPTION_KEY=
FOOTBALL_DATA_API_KEY=
```

Ninguna de estas credenciales debe subirse al repositorio.

---

## Aprendizajes clave

- Un **API Gateway** desacopla al cliente del backend: el frontend nunca conoce la API real ni sus credenciales, solo habla con APIM.
- **OAuth 2.0 client credentials** es el flujo correcto para comunicación servicio-a-servicio.
- **Cachear el token** evita llamadas innecesarias a Entra ID y mejora la latencia.
- **Named values** permiten compartir policies (y hasta el repo) sin exponer tenant IDs, App IDs o API keys.
- La **Test console de APIM** no es lo mismo que un cliente externo real: sin un OAuth 2.0 server configurado, el token hay que pegarlo a mano — el flujo real lo arma el cliente (en este caso, el servidor de Next.js).
