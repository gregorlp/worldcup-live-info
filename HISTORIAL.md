# Historial de desarrollo — World Cup Live Info

> Bitácora técnica del proyecto. Documenta el objetivo, la arquitectura y el
> recorrido completo de desarrollo: decisiones, problemas encontrados y cómo se
> resolvieron.

---

## Objetivo del proyecto

El objetivo principal **no era construir una app de fútbol**, sino **experimentar
con Azure API Management (APIM)** y su integración con autenticación. La app —un
dashboard en vivo del Mundial 2026— es el "escaparate" que consume datos reales a
través del gateway y sirve para validar toda la cadena de seguridad y datos.

**Objetivos de aprendizaje:**

- Configurar y consumir un **API Gateway** (Azure API Management) real.
- Implementar **autenticación OAuth 2.0 (client credentials)** contra Microsoft
  Entra ID.
- Entender las **policies** de APIM (validación de JWT, inyección de token al
  backend, caché, transformación de requests).
- Aplicar buenas prácticas de **seguridad de secretos** (todo server-side).

---

## Arquitectura

```
Navegador (cliente)
      │  (solo HTML/JS de la página; NO ve llamadas a Azure)
      ▼
Next.js (servidor / Server Components)
      │  1. Solicita token OAuth a Entra ID (client credentials)
      │  2. Llama a APIM con: Authorization: Bearer <token>
      │                       Ocp-Apim-Subscription-Key: <key>
      ▼
Azure API Management (gateway)
      │  - Valida subscription key
      │  - Valida el JWT
      │  - Aplica policies (inyección de token real al backend, caché, etc.)
      ▼
API externa football-data.org
```

**Stack:** Next.js · Azure API Management · Microsoft Entra ID · Vercel

**Piezas clave del código:**

- `lib/azure-token.ts` — obtiene y **cachea en memoria** el token Bearer de Entra
  ID (hasta que expira, ~1h). Marcado con `import "server-only"`.
- `lib/football-api.ts` — cliente que llama a APIM con el token + subscription
  key. También `server-only`.
- `lib/bracket.ts` — lógica de construcción del cuadro de eliminatorias.
- `lib/format.ts` — formateo de fechas/horas en zona horaria de Argentina.

---

## Seguridad

- **Todas las llamadas a Azure ocurren en el servidor** (`import "server-only"`).
  En la pestaña Network del navegador **no se ve ninguna** llamada a
  `login.microsoftonline.com` ni a APIM. Es intencional y correcto.
- **Los secretos nunca se suben al repositorio.** Viven como variables de
  entorno en el proyecto de Vercel:
  - `AZURE_TENANT_ID`
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `AZURE_TOKEN_SCOPE`
  - `APIM_SUBSCRIPTION_KEY`
  - (+ la de configuración de football-data)
- **Caché de token**: en vez de pedir un token nuevo en cada request, se reutiliza
  el cacheado hasta poco antes de expirar. Reduce llamadas a Entra ID y mejora la
  latencia.

---

## Pasos de configuración (setup completo)

Orden real en que se armó la infraestructura, capa por capa, con los obstáculos
que hubo que resolver en cada una.

### Paso 1 — Microsoft Entra ID (identidad)

1. **Registrar una aplicación** en Entra ID para representar al cliente (la app
   Next.js).
2. Crear un **client secret** para el flujo *client credentials*.
3. Anotar los datos que luego consume la app:
   - `TENANT_ID`
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - **scope** con formato `api://<APP_ID>/.default`
4. Esto habilita el flujo **OAuth 2.0 client credentials**: la app pide un token
   Bearer a `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`.

> **Obstáculo:** entender que el scope debe terminar en `/.default` (permisos de
> aplicación, no delegados) para el flujo servicio-a-servicio. Con un scope mal
> formado, Entra ID no emite el token.

### Paso 2 — Azure API Management (el gateway)

1. Crear la **instancia de APIM** (`apim-football-data` / `apim-gregor-demo`).
2. **Importar la API** y definir la **Base URL** del gateway.
3. Activar la **subscription** requerida → habilita la key
   `Ocp-Apim-Subscription-Key`, que identifica al consumidor/producto.
4. Añadir la policy **`validate-jwt`** en el `<inbound>`: es la capa que **valida
   y obliga** el token Bearer (issuer + audience del tenant).
5. Configurar el **backend** hacia la API externa football-data, con un
   `set-header` que inyecta la credencial real hacia el backend.
6. Añadir **policy de caché** de respuestas en el gateway.

> **Obstáculo:** confundir el radio *User authorization (None / OAuth 2.0)* de
> Settings con el enforcement de seguridad. Ese radio solo afecta a la **Test
> console** (si adquiere el token sola o no); **quien realmente valida el token es
> la policy `validate-jwt`**. La seguridad no depende de ese botón.

Resultado: **doble capa de seguridad** → subscription key (consumidor) +
`validate-jwt` (identidad).

### Paso 3 — La aplicación (Next.js)

1. Cargar las **variables de entorno** en el proyecto Vercel (nunca en el repo):
   `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
   `AZURE_TOKEN_SCOPE`, `APIM_SUBSCRIPTION_KEY`.
2. Escribir el **cliente de token** (`lib/azure-token.ts`, `server-only`): obtiene
   el token y lo **cachea en memoria** hasta poco antes de expirar (~1h).
3. Escribir el **cliente de la API** (`lib/football-api.ts`, `server-only`): manda
   `Authorization: Bearer` + `Ocp-Apim-Subscription-Key` a APIM, con caché de
   Next.js por endpoint (`revalidate`).

> **Obstáculo:** al principio "no se veían" las llamadas a Azure en el navegador.
> No era un error: al ser **server-side**, la pestaña Network del navegador nunca
> las muestra (y así debe ser). Se resolvió agregando logs `[v0]` en la consola
> del **servidor** para observarlas.

### Paso 4 — Monitoreo (Log Analytics / Azure Monitor)

1. Crear un **workspace de Log Analytics**.
2. Conectar los **Diagnostic Logs** de APIM al workspace.
3. Consultar el tráfico con **KQL** / ver métricas en Azure Monitor.

> **Obstáculo #1:** el tráfico no aparecía "al instante". **Metrics** refleja
> datos en ~1–2 min, pero **Log Analytics tarda 2–10 min** en ingerir para
> consultas KQL. No era un fallo, era latencia de ingesta.
>
> **Obstáculo #2:** la caché de la app hacía que no se generara tráfico nuevo en
> APIM. Para forzar llamadas reales se le pega directo al gateway con
> **Bruno / curl / Test console**, activando **Ocp-Apim-Trace** para ver cada
> policy ejecutarse.

---

## Recorrido de desarrollo

### 1. Pruebas de la integración (Bruno / consola de APIM)

- Se validó el flujo en dos pasos, igual que en **Bruno**:
  1. `POST` a `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` con
     `grant_type=client_credentials` → devuelve el `access_token`.
  2. Llamada a APIM con `Authorization: Bearer <token>` +
     `Ocp-Apim-Subscription-Key`.
- En la **Test console de APIM** solo se ejecuta el paso 2, así que el token se
  pega a mano (salvo que se configure un OAuth server en la consola).
- Herramienta útil para demo: **Ocp-Apim-Trace**, que muestra visualmente cada
  policy ejecutándose sobre la petición.

### 2. Zona horaria de Argentina (GMT-3)

**Problema:** los horarios de los partidos se mostraban en UTC (hora del
servidor). Ej.: Ecuador–Alemania salía a las 20:00 en vez de las 17:00.

**Solución:**

- `lib/format.ts`: `formatKickoff` y `formatLongDate` fijan
  `timeZone: "America/Argentina/Buenos_Aires"` y locale `es-AR`.
- `lib/football-api.ts`: `filterTodayMatches` calcula "hoy" según la fecha de
  Argentina, no la del servidor, para no asignar partidos nocturnos al día
  equivocado.

### 3. Nueva sección "Próximos partidos"

**Pedido:** mostrar los partidos de los próximos días.

**Solución:**

- Componente nuevo `components/world-cup/upcoming-matches.tsx` que **agrupa por
  día** con encabezados relativos ("Hoy", "Mañana", o la fecha en GMT-3).
- Helpers `formatDayHeading` y `argentinaDayKey` en `lib/format.ts`.
- Nueva pestaña "Próximos" en `dashboard-tabs.tsx` con su icono.
- `upcomingByDay` en `app/page.tsx` lista partidos futuros excluyendo los de hoy
  y los ya jugados/en vivo.

### 4. Navegación llaves → grupos

**Pedido:** al hacer clic en un país dentro de la sección de llaves, ir a su
grupo.

**Solución:**

- Contexto React `components/world-cup/group-nav.tsx` que expone
  `goToGroup(letter)`.
- `dashboard-tabs.tsx`: pestañas **controladas**; al pedir un grupo cambia a la
  pestaña "Grupos", hace scroll suave al ancla y lo resalta 2s con un anillo.
- `group-standings.tsx`: cada grupo tiene `id="group-X"` con `scroll-mt-24`.
- `bracket-view.tsx`: los equipos de las llaves son botones clicables que extraen
  la letra del grupo de su etiqueta de posición.

### 5. Monitoreo de las llamadas a Azure

**Pregunta:** ¿por qué no se ven las llamadas a Azure en la consola del navegador?

**Explicación:** porque son **server-side**. La consola/Network del navegador solo
muestra lo que sale del navegador. Es lo correcto y seguro.

**Solución para verlas:** se agregaron logs `console.log("[v0] ...")` en
`lib/azure-token.ts` y `lib/football-api.ts` que registran, en la **consola del
servidor**: solicitud/uso de token cacheado, URL de APIM, código de estado y
tiempo de respuesta. Confirmó que el **caché de token funciona** (primera llamada
"solicitando nuevo token", siguientes "usando token cacheado").

### 6. El bug del cuadro de eliminatorias (el más interesante)

Este fue el problema técnico más rico del proyecto, resuelto en varias iteraciones.

**Síntoma inicial:** la sección de llaves no reflejaba los últimos resultados
(Canadá, Brasil, Paraguay habían avanzado, pero no aparecían).

**Causa raíz #1 — proyección obsoleta:** el cuadro se **proyectaba desde la tabla
de grupos** (`projectBracket`) e ignoraba los partidos reales de eliminatorias.
Cuando la fase de grupos terminó y empezaron los cruces, la proyección quedó
desactualizada.

- **Fix:** se reescribió a `buildBracket(matches, standings)`, que lee los
  **partidos reales** por fase (`LAST_32`, `LAST_16`, ...) tomando equipos,
  marcadores y ganador directamente de la API.

**Causa raíz #2 — ganadores por penales:** la API devuelve `score.winner: null`
cuando un partido se decide **por penales**. Por eso Paraguay (que ganó la tanda a
Alemania) no se marcaba como ganador ni avanzaba.

- **Fix:** función `resolveWinner(score)` que, si `winner` es null, deduce el
  ganador comparando la tanda de penales / el marcador. Además se muestra el
  marcador del **tiempo reglamentario** con la tanda aparte (ej. "4-5 pen."),
  calculada como la diferencia entre el marcador final y el reglamentario.

**Causa raíz #3 — solo avanzaba Canadá:** aun con los ganadores bien detectados,
solo Canadá aparecía en octavos, porque la API todavía no había propagado a los
demás a sus llaves.

- **Fix:** se implementó **propagación propia** de ganadores a lo largo del camino
  principal (dieciseisavos → octavos → cuartos → semis → final).

**Causa raíz #4 — Brasil aparecía dos veces:** al propagar, se asumía que los
partidos de cada ronda venían en orden de cuadro y se emparejaban por índice
(`2i / 2i+1`). Pero **la API ordena los partidos por calendario, no por posición
en el cuadro**, así que Brasil (ya asignado por la API a un octavos) también era
colocado por la propagación en otro slot → duplicado.

- **Fix definitivo:** se construye el cuadro **posicionalmente desde
  dieciseisavos** (única ronda que la API entrega en orden de llave, verificado
  por `id`) y cada partido real de la API se enlaza por **coincidencia de
  equipos** (`attachApiMatches`), no por índice. Los cruces futuros vacíos se
  reparten por orden. Los marcadores y penales se alinean **por equipo**, porque
  el orden home/away de la API puede no coincidir con el de la ranura propagada.
- Referencia usada para validar el orden del cuadro: el bracket publicado por
  medios (Olé), donde los cruces consecutivos alimentan la ronda siguiente.

---

## Aprendizajes destacados

- Un **API Gateway** desacopla al cliente del backend: el frontend nunca conoce la
  API real ni sus credenciales; solo habla con APIM.
- **OAuth client credentials** es el flujo correcto para servicio-a-servicio (sin
  usuario interactivo).
- **Cachear el token** es esencial: evita pegarle a Entra ID en cada request.
- Nunca confiar en un solo campo de una API externa: `score.winner` puede venir
  `null` en penales; hubo que **derivar** el ganador.
- El **orden en que una API devuelve datos** (calendario) no tiene por qué
  coincidir con el orden lógico que uno necesita (posición en el cuadro).

---

## Notas pendientes

- Los `console.log("[v0] ...")` de `lib/azure-token.ts` y `lib/football-api.ts`
  siguen presentes (útiles para la demo de monitoreo). Quitar si se desea código
  de producción limpio.
