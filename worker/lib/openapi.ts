/**
 * Buyer-attached OpenAPI contract validation + normalization.
 *
 * The spec is the grading contract: the arbiter probes the deliverable
 * against THIS copy (fetched from the hub), never against a spec file in
 * the worker's tarball. Canonical form is OpenAPI 3.x JSON ≤100KB.
 * YAML is intentionally not accepted — the arbiter's verifier JSON-parses
 * the stored string, so normalizing once at create kills the YAML-trap
 * class (spec silently dropped → default-spec fiction → false FAILs).
 */

const MAX_SPEC_BYTES = 100_000;
const MAX_PATHS = 100;

export interface NormalizedSpec {
  /** Canonical JSON string as stored on the bounty record. */
  specJson: string;
  /** sha256 hex of specJson (list views + MCP without the blob). */
  hash: string;
  /** Counted method entries across all paths. */
  endpointCount: number;
}

function countEndpoints(paths: Record<string, unknown>): number {
  let n = 0;
  for (const methods of Object.values(paths)) {
    if (methods && typeof methods === "object") {
      n += Object.keys(methods as Record<string, unknown>).filter((k) =>
        ["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(
          k.toLowerCase()
        )
      ).length;
    }
  }
  return n;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse + validate a buyer-supplied spec. Accepts a JSON string or an
 * already-parsed object. Returns the normalized form or throws with a
 * buyer-facing reason (mapped to HTTP 400 by the caller).
 */
export async function validateAndNormalizeOpenApi(input: unknown): Promise<NormalizedSpec> {
  let doc: unknown;
  if (typeof input === "string") {
    if (input.length > MAX_SPEC_BYTES) {
      throw new Error(`OpenAPI spec exceeds ${MAX_SPEC_BYTES / 1000}KB limit`);
    }
    try {
      doc = JSON.parse(input);
    } catch {
      throw new Error("OpenAPI spec must be valid JSON (OpenAPI 3.x). YAML is not accepted.");
    }
  } else if (input && typeof input === "object") {
    const asJson = JSON.stringify(input);
    if (asJson.length > MAX_SPEC_BYTES) {
      throw new Error(`OpenAPI spec exceeds ${MAX_SPEC_BYTES / 1000}KB limit`);
    }
    doc = input;
  } else {
    throw new Error("OpenAPI spec must be a JSON object or JSON string.");
  }

  const rec = doc as Record<string, unknown>;
  if (typeof rec.openapi !== "string" || !rec.openapi.startsWith("3.")) {
    throw new Error('OpenAPI spec must declare openapi: "3.x".');
  }
  const info = rec.info as Record<string, unknown> | undefined;
  if (!info || typeof info.title !== "string" || !info.title.trim()) {
    throw new Error("OpenAPI spec must include info.title.");
  }
  const paths = rec.paths as Record<string, unknown> | undefined;
  if (!paths || typeof paths !== "object" || Object.keys(paths).length === 0) {
    throw new Error("OpenAPI spec must define at least one path.");
  }
  if (Object.keys(paths).length > MAX_PATHS) {
    throw new Error(`OpenAPI spec exceeds ${MAX_PATHS} paths.`);
  }
  for (const [p, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") {
      throw new Error(`Path "${p}" must map to an operations object.`);
    }
    for (const [method, op] of Object.entries(methods as Record<string, unknown>)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options", "trace"].includes(method.toLowerCase())) continue;
      const operation = op as Record<string, unknown>;
      const responses = operation.responses as Record<string, unknown> | undefined;
      if (!responses || typeof responses !== "object" || Object.keys(responses).length === 0) {
        throw new Error(`${method.toUpperCase()} ${p} must declare at least one response.`);
      }
    }
  }

  const specJson = JSON.stringify(doc);
  return {
    specJson,
    hash: await sha256Hex(specJson),
    endpointCount: countEndpoints(paths),
  };
}
