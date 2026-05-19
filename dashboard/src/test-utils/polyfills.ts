import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';
// MSW 2.x evaluates sse.ts at module load time and references these globals.
// jsdom vm context doesn't expose Node.js 20 built-ins — assign them explicitly
// so they're in place before server.ts (and msw) are imported by setup.ts.
if (!globalThis.ReadableStream) globalThis.ReadableStream = ReadableStream as never;
if (!globalThis.WritableStream) globalThis.WritableStream = WritableStream as never;
if (!globalThis.TransformStream) globalThis.TransformStream = TransformStream as never;
