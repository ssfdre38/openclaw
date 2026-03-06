import { parentPort } from "node:worker_threads";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runExec } from "../process/exec.js";

type Sharp = typeof import("sharp");

// Lazy-loaded modules
let sharpModulePromise: Promise<(buffer: Buffer) => ReturnType<Sharp>> | null = null;

async function loadSharp(): Promise<(buffer: Buffer) => ReturnType<Sharp>> {
  if (!sharpModulePromise) {
    sharpModulePromise = import("sharp")
      .then((mod) => {
        const sharp = (mod as any).default ?? (mod as unknown as Sharp);
        return (buffer: Buffer) => sharp(buffer, { failOnError: false });
      })
      .catch((err) => {
        sharpModulePromise = null;
        throw new Error(`sharp required for image processing: ${String(err)}`);
      });
  }
  return sharpModulePromise;
}

function isBun(): boolean {
  return typeof (process.versions as { bun?: unknown }).bun === "string";
}

function prefersSips(): boolean {
  return (
    process.env.OPENCLAW_IMAGE_BACKEND === "sips" ||
    (process.env.OPENCLAW_IMAGE_BACKEND !== "sharp" && isBun() && process.platform === "darwin")
  );
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-img-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
  }
}

// Task handlers

type ResizeToJpegTask = {
  id: string;
  type: "resize-to-jpeg";
  data: {
    buffer: number[];
    maxSide: number;
    quality: number;
    withoutEnlargement?: boolean;
  };
};

type ResizeToPngTask = {
  id: string;
  type: "resize-to-png";
  data: {
    buffer: number[];
    maxSide: number;
    compressionLevel?: number;
  };
};

type ConvertHeicTask = {
  id: string;
  type: "convert-heic";
  data: {
    buffer: number[];
  };
};

type ImageTask = ResizeToJpegTask | ResizeToPngTask | ConvertHeicTask;

async function sipsResizeToJpeg(buffer: Buffer, maxSide: number, quality: number): Promise<Buffer> {
  return await withTempDir(async (dir) => {
    const input = path.join(dir, "in.jpg");
    const output = path.join(dir, "out.jpg");
    await fs.writeFile(input, buffer);
    
    // Calculate quality as percentage (sips uses 0.0-1.0, we receive 0-100)
    const sipsQuality = quality / 100;
    
    await runExec(
      "/usr/bin/sips",
      [
        "-Z",
        String(maxSide),
        "--setProperty",
        "formatOptions",
        String(sipsQuality),
        input,
        "--out",
        output,
      ],
      {
        timeoutMs: 30_000,
        maxBuffer: 1024 * 1024 * 10,
      }
    );
    return await fs.readFile(output);
  });
}

async function sipsConvertToJpeg(buffer: Buffer): Promise<Buffer> {
  return await withTempDir(async (dir) => {
    const input = path.join(dir, "in.heic");
    const output = path.join(dir, "out.jpg");
    await fs.writeFile(input, buffer);
    await runExec("/usr/bin/sips", ["-s", "format", "jpeg", input, "--out", output], {
      timeoutMs: 20_000,
      maxBuffer: 1024 * 1024,
    });
    return await fs.readFile(output);
  });
}

function readJpegExifOrientation(buffer: Buffer): number | null {
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      if (
        buffer.length > exifStart + 6 &&
        buffer.toString("ascii", exifStart, exifStart + 4) === "Exif" &&
        buffer[exifStart + 4] === 0 &&
        buffer[exifStart + 5] === 0
      ) {
        const tiffStart = exifStart + 6;
        if (buffer.length < tiffStart + 8) {
          return null;
        }

        const bigEndian = buffer[tiffStart] === 0x4d && buffer[tiffStart + 1] === 0x4d;
        const ifdOffset = bigEndian
          ? buffer.readUInt32BE(tiffStart + 4)
          : buffer.readUInt32LE(tiffStart + 4);

        const ifd = tiffStart + ifdOffset;
        if (buffer.length < ifd + 2) {
          return null;
        }

        const numEntries = bigEndian ? buffer.readUInt16BE(ifd) : buffer.readUInt16LE(ifd);
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifd + 2 + i * 12;
          if (buffer.length < entryOffset + 12) {
            break;
          }

          const tag = bigEndian ? buffer.readUInt16BE(entryOffset) : buffer.readUInt16LE(entryOffset);
          if (tag === 0x0112) {
            // Orientation tag
            const value = bigEndian
              ? buffer.readUInt16BE(entryOffset + 8)
              : buffer.readUInt16LE(entryOffset + 8);
            return value;
          }
        }
      }
      return null;
    }

    const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 2 + segmentLength;
  }

  return null;
}

async function sipsApplyOrientation(buffer: Buffer, orientation: number): Promise<Buffer> {
  const ops: string[] = [];
  switch (orientation) {
    case 2:
      ops.push("-f", "horizontal");
      break;
    case 3:
      ops.push("-r", "180");
      break;
    case 4:
      ops.push("-f", "vertical");
      break;
    case 5:
      ops.push("-r", "270", "-f", "horizontal");
      break;
    case 6:
      ops.push("-r", "90");
      break;
    case 7:
      ops.push("-r", "90", "-f", "horizontal");
      break;
    case 8:
      ops.push("-r", "270");
      break;
    default:
      return buffer;
  }

  return await withTempDir(async (dir) => {
    const input = path.join(dir, "in.jpg");
    const output = path.join(dir, "out.jpg");
    await fs.writeFile(input, buffer);
    await runExec("/usr/bin/sips", [...ops, input, "--out", output], {
      timeoutMs: 20_000,
      maxBuffer: 1024 * 1024,
    });
    return await fs.readFile(output);
  });
}

async function normalizeExifOrientationSips(buffer: Buffer): Promise<Buffer> {
  try {
    const orientation = readJpegExifOrientation(buffer);
    if (!orientation || orientation === 1) {
      return buffer;
    }
    return await sipsApplyOrientation(buffer, orientation);
  } catch {
    return buffer;
  }
}

async function handleResizeToJpeg(task: ResizeToJpegTask): Promise<Buffer> {
  const buffer = Buffer.from(task.data.buffer);
  const { maxSide, quality, withoutEnlargement } = task.data;

  if (prefersSips()) {
    const normalized = await normalizeExifOrientationSips(buffer);
    return await sipsResizeToJpeg(normalized, maxSide, quality);
  }

  const sharp = await loadSharp();
  return await sharp(buffer)
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "inside",
      withoutEnlargement: withoutEnlargement !== false,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

async function handleResizeToPng(task: ResizeToPngTask): Promise<Buffer> {
  const buffer = Buffer.from(task.data.buffer);
  const { maxSide, compressionLevel } = task.data;

  const sharp = await loadSharp();
  return await sharp(buffer)
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: compressionLevel ?? 6 })
    .toBuffer();
}

async function handleConvertHeic(task: ConvertHeicTask): Promise<Buffer> {
  const buffer = Buffer.from(task.data.buffer);

  if (prefersSips()) {
    return await sipsConvertToJpeg(buffer);
  }

  const sharp = await loadSharp();
  return await sharp(buffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// Worker message handler
if (parentPort) {
  parentPort.on("message", async (msg: ImageTask) => {
    try {
      let result: Buffer;

      switch (msg.type) {
        case "resize-to-jpeg":
          result = await handleResizeToJpeg(msg);
          break;
        case "resize-to-png":
          result = await handleResizeToPng(msg);
          break;
        case "convert-heic":
          result = await handleConvertHeic(msg);
          break;
        default:
          parentPort!.postMessage({
            id: msg.id,
            error: `Unknown task type: ${(msg as any).type}`,
          });
          return;
      }

      parentPort!.postMessage({
        id: msg.id,
        result: Array.from(result), // Serialize Buffer as array
      });
    } catch (err) {
      parentPort!.postMessage({
        id: msg.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
