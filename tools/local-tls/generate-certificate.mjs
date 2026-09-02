// Generate a repository-local certificate authority and leaf for the pinned
// local origin, with no machine-level change: nothing is installed into a
// system trust store and no hosts file is edited.
//
// Playwright resolves the hostname with --host-resolver-rules and trusts this
// exact leaf by SPKI pin, so certificate validation stays strict everywhere
// else and no test weakens the production __Host-/Secure cookie contract.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const LOCAL_HOSTNAME = "console.evirion.test"
export const LOCAL_PORT = 3443
export const LOCAL_ORIGIN = `https://${LOCAL_HOSTNAME}:${LOCAL_PORT}`

const here = dirname(fileURLToPath(import.meta.url))
// `.local` is excluded from the authority walk and from git, so generated key
// material can never become a tracked repository file.
export const outputDirectory = join(here, ".local")

const openssl = (args, input) =>
  execFileSync("openssl", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })

const certificateExtensions = `
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:${LOCAL_HOSTNAME}, DNS:localhost, IP:127.0.0.1
`

export const generate = () => {
  rmSync(outputDirectory, { recursive: true, force: true })
  mkdirSync(outputDirectory, { recursive: true })

  const authorityKey = join(outputDirectory, "authority-key.pem")
  const authorityCertificate = join(outputDirectory, "authority.pem")
  const leafKey = join(outputDirectory, "leaf-key.pem")
  const leafRequest = join(outputDirectory, "leaf.csr")
  const leafCertificate = join(outputDirectory, "leaf.pem")
  const extensionsFile = join(outputDirectory, "leaf.ext")

  writeFileSync(extensionsFile, certificateExtensions)

  openssl([
    "genpkey",
    "-algorithm",
    "RSA",
    "-pkeyopt",
    "rsa_keygen_bits:2048",
    "-out",
    authorityKey,
  ])
  openssl([
    "req",
    "-x509",
    "-new",
    "-key",
    authorityKey,
    "-sha256",
    "-days",
    "365",
    "-subj",
    "/CN=Evirion Console local development CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE,pathlen:0",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
    "-out",
    authorityCertificate,
  ])

  openssl([
    "genpkey",
    "-algorithm",
    "RSA",
    "-pkeyopt",
    "rsa_keygen_bits:2048",
    "-out",
    leafKey,
  ])
  openssl([
    "req",
    "-new",
    "-key",
    leafKey,
    "-subj",
    `/CN=${LOCAL_HOSTNAME}`,
    "-out",
    leafRequest,
  ])
  openssl([
    "x509",
    "-req",
    "-in",
    leafRequest,
    "-CA",
    authorityCertificate,
    "-CAkey",
    authorityKey,
    "-CAcreateserial",
    "-days",
    "365",
    "-sha256",
    "-extfile",
    extensionsFile,
    "-out",
    leafCertificate,
  ])

  rmSync(leafRequest, { force: true })
  rmSync(extensionsFile, { force: true })

  const spki = computeSpkiPin(leafCertificate)
  writeFileSync(join(outputDirectory, "spki-pin.txt"), `${spki}\n`)

  return { authorityCertificate, leafCertificate, leafKey, spki }
}

/** Base64 SHA-256 of the leaf SubjectPublicKeyInfo, the form Chromium's
 * --ignore-certificate-errors-spki-list expects. */
export const computeSpkiPin = (leafCertificatePath) => {
  const publicKey = openssl(["x509", "-in", leafCertificatePath, "-pubkey", "-noout"])
  const derPath = join(outputDirectory, "leaf-spki.der")
  execFileSync("openssl", ["pkey", "-pubin", "-outform", "der", "-out", derPath], {
    input: publicKey,
  })
  const digest = execFileSync("openssl", ["dgst", "-sha256", "-binary", derPath])
  rmSync(derPath, { force: true })
  return Buffer.from(digest).toString("base64")
}

export const readMaterial = () => {
  const leafCertificate = join(outputDirectory, "leaf.pem")
  if (!existsSync(leafCertificate)) {
    throw new Error("run `pnpm tls:generate` before starting the local edge")
  }
  return {
    certificate: readFileSync(leafCertificate),
    key: readFileSync(join(outputDirectory, "leaf-key.pem")),
    authority: readFileSync(join(outputDirectory, "authority.pem")),
    spki: readFileSync(join(outputDirectory, "spki-pin.txt"), "utf8").trim(),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { spki } = generate()
  console.log(`local TLS material written to tools/local-tls/.local`)
  console.log(`origin: ${LOCAL_ORIGIN}`)
  console.log(`leaf SPKI pin: ${spki}`)
}
