import { describe, expect, it } from 'vitest';
import { paginasVisibles } from './ui';

describe('paginasVisibles', () => {
  it('pocas páginas: todas', () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('al principio, en medio y al final de muchas', () => {
    expect(paginasVisibles(1, 93)).toEqual([1, 2, 3, 4, '…', 93]);
    expect(paginasVisibles(47, 93)).toEqual([1, '…', 46, 47, 48, '…', 93]);
    expect(paginasVisibles(93, 93)).toEqual([1, '…', 90, 91, 92, 93]);
  });
  it('no pone "…" para saltar un solo número', () => {
    expect(paginasVisibles(4, 93)).toEqual([1, 2, 3, 4, 5, '…', 93]);
    expect(paginasVisibles(5, 93)).toEqual([1, '…', 4, 5, 6, '…', 93]);
  });
});
