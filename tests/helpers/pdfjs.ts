// pdf.js for Node: the legacy build, running its worker on the main thread.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import type { PdfJsLike } from '../../src/parser/pdf'

;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker

export const pdfjsLib = pdfjs as unknown as PdfJsLike
