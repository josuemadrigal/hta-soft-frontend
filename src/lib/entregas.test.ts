import { describe, expect, it } from 'vitest';
import { cantidadPorDias, cantidadSugerida, margenDe, mensajeEntrega } from './entregas';

describe('cantidadPorDias', () => {
  it('multiplica la dosis diaria por los días', () => {
    expect(cantidadPorDias(1, 30)).toBe(30);
    expect(cantidadPorDias(2, 90)).toBe(180);
  });

  it('redondea hacia arriba las medias pastillas', () => {
    expect(cantidadPorDias(0.5, 45)).toBe(23);
  });

  it('sin dosis o sin días no hay nada que dar', () => {
    expect(cantidadPorDias(0, 30)).toBe(0);
    expect(cantidadPorDias(1, 0)).toBe(0);
  });
});

describe('cantidadSugerida', () => {
  it('ofrece lo que falta si alcanza', () => {
    expect(cantidadSugerida(30, 100)).toBe(30);
  });

  it('no pasa de lo que hay', () => {
    expect(cantidadSugerida(30, 12)).toBe(12);
    expect(cantidadSugerida(30, 0)).toBe(0);
  });

  it('sin dato de existencia, ofrece lo que falta', () => {
    expect(cantidadSugerida(30, undefined)).toBe(30);
  });
});

describe('mensajeEntrega', () => {
  it('traduce la falta de inventario', () => {
    expect(mensajeEntrega('Insufficient stock for Losartán 50 mg. Required: 60, Available: 20')).toBe(
      'No hay suficiente Losartán 50 mg: hacen falta 60 y quedan 20. No se entregó nada.',
    );
  });

  it('deja igual los mensajes que ya vienen en español', () => {
    expect(mensajeEntrega('De Losartán solo quedan 10 por entregar')).toBe('De Losartán solo quedan 10 por entregar');
  });
});

describe('cantidadPorDias con margen', () => {
  it('suma los días de margen, como en la visita (90 días + 5 = 95)', () => {
    expect(cantidadPorDias(1, 90, 5)).toBe(95);
    expect(cantidadPorDias(2, 30, 5)).toBe(65);
    expect(cantidadPorDias(1, 90)).toBe(90);
  });
  it('sin margen en la receta, usa los 5 de siempre', () => {
    expect(margenDe({})).toBe(5);
    expect(margenDe({ bufferDays: 0 })).toBe(5); // las importadas del Excel traen 0
    expect(margenDe({ bufferDays: null })).toBe(5);
  });
});
