// IndexedDB en memoria: jsdom no lo trae y la cola sin internet vive ahí.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
// Sin globals de Vitest, Testing Library no limpia solo entre pruebas.
afterEach(() => cleanup());
