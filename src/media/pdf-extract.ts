import { WorkerPool } from "./worker-pool.js";

// Global worker pool for PDF processing (lazy init)
let workerPool: WorkerPool | null = null;

function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    workerPool = new WorkerPool({
      size: 2, // 2 workers for PDF processing
    });
  }
  return workerPool;
}

// Graceful shutdown hook (if OpenClaw calls this on exit)
export async function shutdownPdfWorkers(): Promise<void> {
  if (workerPool) {
    await workerPool.shutdown();
    workerPool = null;
  }
}

export type PdfExtractedImage = {
  type: "image";
  data: string;
  mimeType: string;
};

export type PdfExtractedContent = {
  text: string;
  images: PdfExtractedImage[];
};

export async function extractPdfContent(params: {
  buffer: Buffer;
  maxPages: number;
  maxPixels: number;
  minTextChars: number;
  pageNumbers?: number[];
  onImageExtractionError?: (error: unknown) => void;
}): Promise<PdfExtractedContent> {
  const { buffer, maxPages, maxPixels, minTextChars, pageNumbers } = params;

  try {
    // Offload PDF extraction to worker thread
    const pool = getWorkerPool();
    const result = await pool.run<
      {
        buffer: number[];
        maxPages: number;
        maxPixels: number;
        minTextChars: number;
        pageNumbers?: number[];
      },
      PdfExtractedContent
    >("extract-pdf", {
      buffer: Array.from(buffer), // Serialize Buffer as array
      maxPages,
      maxPixels,
      minTextChars,
      pageNumbers,
    });

    return result;
  } catch (err) {
    // Worker failed - log error and return empty
    params.onImageExtractionError?.(err);
    return { text: "", images: [] };
  }
}
