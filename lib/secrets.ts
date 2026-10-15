// Henter hemmeligheter fra Azure Key Vault (samme vault som Fabric-notebookene).
// Pålogging via DefaultAzureCredential:
//   - lokalt: `az login` (eller Connect-AzAccount / VS Code-innlogging)
//   - i produksjon: service principal via AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
// Miljøvariabel med samme navn går alltid foran Key Vault (nyttig for testing).
import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'

const VAULT_URL = process.env.AZURE_KEY_VAULT_URL || 'https://heimr.vault.azure.net'
const TTL_MS = 30 * 60 * 1000        // gyldige verdier caches i 30 min
const MISS_TTL_MS = 5 * 60 * 1000    // manglende/feil caches i 5 min, så vi ikke henger på hver request

let client: SecretClient | null = null
function getClient() {
  if (!client) client = new SecretClient(VAULT_URL, new DefaultAzureCredential())
  return client
}

const cache = new Map<string, { at: number; value: string | null }>()
let lastError: string | null = null

/** Hent en hemmelighet. Returnerer null hvis den ikke finnes eller vaulten ikke er tilgjengelig. */
export async function getSecret(name: string): Promise<string | null> {
  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < (hit.value ? TTL_MS : MISS_TTL_MS)) return hit.value

  try {
    const secret = await Promise.race([
      getClient().getSecret(name),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Tidsavbrudd mot Key Vault')), 8000)),
    ])
    const value = secret.value?.trim() || null
    cache.set(name, { at: Date.now(), value })
    lastError = null
    return value
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    // 404 = finnes ikke (helt greit). Andre feil = innlogging/tilgang.
    if (e.statusCode !== 404) {
      lastError = e.message ?? 'Ukjent feil mot Key Vault'
      console.error(`Key Vault (${name}):`, lastError)
    }
    cache.set(name, { at: Date.now(), value: null })
    return null
  }
}

/** Siste feil mot Key Vault (for feilmeldinger i admin) */
export function keyVaultError(): string | null {
  return lastError
}

export const keyVaultUrl = VAULT_URL
