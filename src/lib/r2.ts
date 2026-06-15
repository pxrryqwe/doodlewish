import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
  // Don't throw at import time — the diag route surfaces the missing config
  // and individual handlers throw on first use so dev doesn't crash.
  if (process.env.NODE_ENV === "production") {
    throw new Error("R2 env vars missing (R2_ACCOUNT_ID / ACCESS_KEY / SECRET / BUCKET / PUBLIC_BASE_URL)");
  }
}

let _client: S3Client | null = null;
function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
  return _client;
}

export const R2_BUCKET = bucket ?? "";

export function publicUrlFor(key: string): string {
  // Route through our same-origin image proxy so the canvas can load
  // these images CORS-clean (R2 public buckets don't always send the
  // right CORS headers, and that breaks `useImage("anonymous")` plus
  // `stage.toBlob()` on canvases that contain stickers).
  return `/api/img/${key}`;
}

export async function presignPut(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSec = 60
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return await getSignedUrl(client(), cmd, { expiresIn: expiresInSec });
}

export async function getObject(key: string): Promise<{
  body: Uint8Array;
  contentType: string | undefined;
} | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
    if (!res.Body) return null;
    // res.Body is a ReadableStream in Node 18+; collect to a Uint8Array.
    const stream = res.Body as unknown as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };
    if (typeof stream.transformToByteArray === "function") {
      const body = await stream.transformToByteArray();
      return { body, contentType: res.ContentType };
    }
    // Fallback for older SDKs
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const body = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      body.set(c, o);
      o += c.byteLength;
    }
    return { body, contentType: res.ContentType };
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function putObject(
  key: string,
  contentType: string,
  body: Buffer | Uint8Array
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
      Body: body,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  // R2 supports the batch DeleteObjects op but to keep things simple and avoid
  // an extra import we fire them in parallel; volumes here are tiny (≤ a few
  // dozen per gift).
  await Promise.allSettled(keys.map((k) => deleteObject(k)));
}

export async function r2Health(): Promise<{ ok: boolean; error?: string }> {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { ok: false, error: "missing env" };
  }
  try {
    // Cheapest "is the bucket reachable" probe: try to head an obviously
    // non-existent key. 404 = healthy; auth/network errors = unhealthy.
    const probeKey = `_health/${Date.now()}.txt`;
    await client().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: probeKey })
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
