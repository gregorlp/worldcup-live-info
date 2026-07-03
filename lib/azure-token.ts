import "server-only"

type TokenResponse = {
  token_type: string
  expires_in: number
  ext_expires_in?: number
  access_token: string
}

type CachedToken = {
  accessToken: string
  // Marca de tiempo (ms) en la que el token deja de considerarse válido.
  expiresAt: number
}

// Caché en memoria del token. Persiste entre invocaciones mientras
// el proceso del servidor siga vivo, evitando pedir un token nuevo
// (válido ~1h) en cada request a APIM.
let cached: CachedToken | null = null

// Margen de seguridad: renovamos el token 60s antes de que caduque
// para evitar usar uno que expire en mitad de una llamada.
const EXPIRY_SKEW_MS = 60_000

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`La variable de entorno ${name} no está configurada.`)
  }
  return value
}

/**
 * Normaliza el scope para el flujo Client Credentials. Azure AD exige
 * que el scope sea el Application ID URI del recurso con el sufijo
 * `/.default`. Aceptamos que el usuario configure el valor de varias
 * formas y lo completamos:
 *   - "<guid>"                       -> "api://<guid>/.default"
 *   - "api://<guid>"                 -> "api://<guid>/.default"
 *   - "api://<guid>/.default"        -> sin cambios
 *   - "https://contoso.com/api"      -> "https://contoso.com/api/.default"
 */
function normalizeScope(raw: string): string {
  let scope = raw.trim()
  if (scope.endsWith("/.default")) {
    return scope
  }
  const guidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (guidPattern.test(scope)) {
    scope = `api://${scope}`
  }
  return `${scope.replace(/\/$/, "")}/.default`
}

/**
 * Obtiene un access token de Azure AD (Entra ID) usando el flujo
 * OAuth2 Client Credentials. Cachea el token en memoria y solo
 * solicita uno nuevo cuando el anterior está por caducar.
 */
export async function getAzureAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[v0] Azure token: usando token cacheado (no se llama a Entra ID)")
    return cached.accessToken
  }

  const tenantId = requiredEnv("AZURE_TENANT_ID")
  const clientId = requiredEnv("AZURE_CLIENT_ID")
  const clientSecret = requiredEnv("AZURE_CLIENT_SECRET")
  const scope = normalizeScope(requiredEnv("AZURE_TOKEN_SCOPE"))

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  console.log(`[v0] Azure token: solicitando nuevo token a Entra ID (scope=${scope})`)

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  })

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // El token nunca debe cachearse a nivel de fetch; lo gestionamos nosotros.
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`No se pudo obtener el token de Azure AD (${res.status}). ${detail}`)
  }

  const data = (await res.json()) as TokenResponse
  console.log(`[v0] Azure token: obtenido OK, expira en ${data.expires_in}s`)

  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - EXPIRY_SKEW_MS,
  }

  return cached.accessToken
}
