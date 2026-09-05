// The local trusted edge hop.
//
// The baseline fixes exactly one trusted proxy hop whose job is to strip
// inbound Forwarded/X-Forwarded-* and write canonical values. This terminator
// is that hop, so local and end-to-end runs exercise the same trusted-proxy
// contract as staging instead of a weaker direct-to-Next path.
import { createServer } from "node:https"
import { request as httpRequest } from "node:http"

import { LOCAL_HOSTNAME, LOCAL_PORT, readMaterial } from "./generate-certificate.mjs"

const upstreamPort = Number(process.env.CONSOLE_UPSTREAM_PORT ?? 3000)
const upstreamHost = "127.0.0.1"

// Anything a client sends in these is discarded before the application sees
// it; only the edge may state them.
const CLIENT_CONTROLLED_FORWARDING_HEADERS = [
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
]

const { certificate, key } = readMaterial()

const server = createServer({ cert: certificate, key }, (incoming, outgoing) => {
  const headers = { ...incoming.headers }
  for (const name of CLIENT_CONTROLLED_FORWARDING_HEADERS) {
    delete headers[name]
  }

  const clientAddress = incoming.socket.remoteAddress ?? ""
  headers["host"] = `${LOCAL_HOSTNAME}:${LOCAL_PORT}`
  headers["x-forwarded-host"] = `${LOCAL_HOSTNAME}:${LOCAL_PORT}`
  headers["x-forwarded-proto"] = "https"
  headers["x-forwarded-port"] = String(LOCAL_PORT)
  headers["x-forwarded-for"] = clientAddress
  headers["forwarded"] =
    `for="${clientAddress}";host="${LOCAL_HOSTNAME}:${LOCAL_PORT}";proto=https`

  const upstream = httpRequest(
    {
      host: upstreamHost,
      port: upstreamPort,
      method: incoming.method,
      path: incoming.url,
      headers,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(outgoing)
    },
  )

  upstream.on("error", () => {
    outgoing.writeHead(502, { "content-type": "text/plain" })
    outgoing.end("local edge could not reach the Console")
  })

  incoming.pipe(upstream)
})

/**
 * Loopback by default, because nothing outside this machine has any business
 * reaching a development edge. The baseline DAST is the one exception: ZAP runs
 * in a container and cannot reach the host's loopback, so that runner sets this
 * to 0.0.0.0 for the length of the scan and nothing else does.
 */
const bindAddress = process.env.CONSOLE_EDGE_BIND_ADDRESS ?? "127.0.0.1"

server.listen(LOCAL_PORT, bindAddress, () => {
  console.log(`local edge listening on https://${LOCAL_HOSTNAME}:${LOCAL_PORT}`)
  console.log(`bound to ${bindAddress}`)
  console.log(`proxying to http://${upstreamHost}:${upstreamPort}`)
})
