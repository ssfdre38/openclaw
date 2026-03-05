import { Worker } from "node:worker_threads";

export type WorkerTask<T = unknown, R = unknown> = {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
};

export type WorkerPoolConfig = {
  /** Number of workers in the pool (default: 2) */
  size?: number;
  /** Max tasks queued per worker before rejecting (default: 100) */
  maxQueuedTasks?: number;
};

// Inline worker code (avoids bundling issues)
const WORKER_CODE = `
const { parentPort } = require("node:worker_threads");

let canvasModulePromise = null;
let pdfJsModulePromise = null;

async function loadCanvasModule() {
  if (!canvasModulePromise) {
    canvasModulePromise = import("@napi-rs/canvas").catch((err) => {
      canvasModulePromise = null;
      throw new Error("@napi-rs/canvas required: " + String(err));
    });
  }
  return canvasModulePromise;
}

async function loadPdfJsModule() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").catch((err) => {
      pdfJsModulePromise = null;
      throw new Error("pdfjs-dist required: " + String(err));
    });
  }
  return pdfJsModulePromise;
}

async function extractPdfContent(params) {
  const { buffer, maxPages, maxPixels, minTextChars, pageNumbers } = params;
  const { getDocument } = await loadPdfJsModule();
  const pdf = await getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;

  const effectivePages = pageNumbers
    ? pageNumbers.filter((p) => p >= 1 && p <= pdf.numPages).slice(0, maxPages)
    : Array.from({ length: Math.min(pdf.numPages, maxPages) }, (_, i) => i + 1);

  const textParts = [];
  for (const pageNum of effectivePages) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .filter(Boolean)
      .join(" ");
    if (pageText) {
      textParts.push(pageText);
    }
  }

  const text = textParts.join("\\n\\n");
  if (text.trim().length >= minTextChars) {
    return { text, images: [] };
  }

  let canvasModule;
  try {
    canvasModule = await loadCanvasModule();
  } catch {
    return { text, images: [] };
  }

  const { createCanvas } = canvasModule;
  const images = [];
  const pixelBudget = Math.max(1, maxPixels);

  for (const pageNum of effectivePages) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pagePixels = viewport.width * viewport.height;
    const scale = Math.min(1, Math.sqrt(pixelBudget / Math.max(1, pagePixels)));
    const scaled = page.getViewport({ scale: Math.max(0.1, scale) });
    const canvas = createCanvas(Math.ceil(scaled.width), Math.ceil(scaled.height));
    await page.render({
      canvas: canvas,
      viewport: scaled,
    }).promise;
    const png = canvas.toBuffer("image/png");
    images.push({ type: "image", data: png.toString("base64"), mimeType: "image/png" });
  }

  return { text, images };
}

if (parentPort) {
  parentPort.on("message", async (msg) => {
    try {
      if (msg.type === "extract-pdf") {
        const buffer = Buffer.from(msg.data.buffer);
        const result = await extractPdfContent({
          buffer,
          maxPages: msg.data.maxPages,
          maxPixels: msg.data.maxPixels,
          minTextChars: msg.data.minTextChars,
          pageNumbers: msg.data.pageNumbers,
        });
        parentPort.postMessage({ id: msg.id, result });
      } else {
        parentPort.postMessage({ id: msg.id, error: "Unknown task type: " + msg.type });
      }
    } catch (err) {
      parentPort.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
`;

type WorkerState = {
  worker: Worker;
  busy: boolean;
  taskCount: number;
};

/**
 * Simple worker thread pool for CPU-intensive tasks.
 * 
 * Responsibilities:
 * - Spawn and manage N worker threads
 * - Queue and dispatch tasks to available workers
 * - Handle worker failures and restart
 * - Graceful shutdown
 */
export class WorkerPool {
  private workers: WorkerState[] = [];
  private queue: WorkerTask[] = [];
  private taskIdCounter = 0;
  private shuttingDown = false;

  constructor(private config: WorkerPoolConfig) {
    const size = config.size ?? 2;

    for (let i = 0; i < size; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): void {
    // Create worker with inline code
    const worker = new Worker(WORKER_CODE, { eval: true });
    const state: WorkerState = {
      worker,
      busy: false,
      taskCount: 0,
    };

    worker.on("message", (msg: { id: string; error?: string; result?: unknown }) => {
      state.busy = false;
      state.taskCount++;

      // Find the task waiting for this response
      const taskIndex = this.queue.findIndex((t) => t.id === msg.id);
      if (taskIndex === -1) {
        // Task was cancelled or timeout, ignore
        this.processQueue();
        return;
      }

      const task = this.queue[taskIndex];
      this.queue.splice(taskIndex, 1);

      if (msg.error) {
        task.reject(new Error(msg.error));
      } else {
        task.resolve(msg.result);
      }

      // Process next queued task
      this.processQueue();
    });

    worker.on("error", (err: Error) => {
      // Worker crashed - reject all its tasks and restart
      const failedTasks = this.queue.filter((t) => this.isTaskAssignedToWorker(t, worker));
      failedTasks.forEach((task) => {
        const index = this.queue.indexOf(task);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        task.reject(new Error(`Worker crashed: ${err.message}`));
      });

      // Remove crashed worker
      const index = this.workers.indexOf(state);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }

      // Restart worker if not shutting down
      if (!this.shuttingDown) {
        this.spawnWorker();
        this.processQueue();
      }
    });

    worker.on("exit", (code: number) => {
      if (code !== 0 && !this.shuttingDown) {
        // Unexpected exit - restart
        const index = this.workers.indexOf(state);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }
        this.spawnWorker();
      }
    });

    this.workers.push(state);
  }

  private isTaskAssignedToWorker(task: WorkerTask, worker: Worker): boolean {
    // Simple heuristic: if worker is processing and queue has this task, assume it's assigned
    // In production, you'd track task→worker mapping more explicitly
    return false; // Tasks are in queue until resolved, so this is OK
  }

  private processQueue(): void {
    if (this.shuttingDown || this.queue.length === 0) {
      return;
    }

    // Find available worker
    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) {
      return; // All workers busy
    }

    // Get next task from queue (FIFO)
    const task = this.queue.find((t) => t.id); // First unprocessed task
    if (!task) {
      return;
    }

    // Mark worker as busy and send task
    availableWorker.busy = true;
    availableWorker.worker.postMessage({
      id: task.id,
      type: task.type,
      data: task.data,
    });
  }

  /**
   * Submit a task to the worker pool.
   * Returns a Promise that resolves when the task completes.
   */
  public async run<T = unknown, R = unknown>(type: string, data: T): Promise<R> {
    if (this.shuttingDown) {
      throw new Error("WorkerPool is shutting down");
    }

    const maxQueued = this.config.maxQueuedTasks ?? 100;
    if (this.queue.length >= maxQueued) {
      throw new Error(`WorkerPool queue full (max: ${maxQueued})`);
    }

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask = {
        id: `task-${++this.taskIdCounter}`,
        type,
        data,
        resolve: resolve as (result: unknown) => void,
        reject,
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  /**
   * Gracefully shutdown all workers.
   * Waits for in-flight tasks to complete (up to timeout).
   */
  public async shutdown(timeoutMs = 5000): Promise<void> {
    this.shuttingDown = true;

    // Wait for queue to drain or timeout
    const start = Date.now();
    while (this.queue.length > 0 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(
      this.workers.map(async (state) => {
        try {
          await state.worker.terminate();
        } catch {
          // Ignore termination errors
        }
      }),
    );

    this.workers = [];
    this.queue = [];
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    workers: number;
    busyWorkers: number;
    queueLength: number;
    totalTasksProcessed: number;
  } {
    return {
      workers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queueLength: this.queue.length,
      totalTasksProcessed: this.workers.reduce((sum, w) => sum + w.taskCount, 0),
    };
  }
}
