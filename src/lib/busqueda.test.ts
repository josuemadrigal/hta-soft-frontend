import { describe, expect, it } from 'vitest';
import { coincide, puntaje } from './busqueda';

// Los mismos casos que el backend (src/common/busqueda.spec.ts): sin internet se encuentra lo mismo.
const p = (firstName: string, lastName: string, patientCode = 'XX1000', address: string | null = null) => ({ firstName, lastName, patientCode, address });

describe('Búsqueda de pacientes', () => {
  const altagracia = p('Altagracia', 'Juan', 'LR0009', '1');
  it('por palabras, sin acentos y tolerante a errores', () => {
    expect(coincide('altagracia juan', altagracia)).toBe(true);
    expect(coincide('juan altagracia', altagracia)).toBe(true);
    expect(coincide('altagracia juan', p('Julia Altagracia', 'Charles'))).toBe(false);
    expect(coincide('PEREZ', p('José', 'Pérez'))).toBe(true);
    expect(coincide('altagrasia', altagracia)).toBe(true);
    expect(coincide('jaun', altagracia)).toBe(true);
    expect(coincide('ernandez', p('Rosa', 'Hernández'))).toBe(true);
    expect(coincide('lr00', altagracia)).toBe(true);
    expect(coincide('ana', p('Ena', 'Luis'))).toBe(false);
  });
  it('lo exacto pesa más', () => {
    expect(puntaje('altagracia', altagracia)!).toBeGreaterThan(puntaje('altagrasia', altagracia)!);
  });
});
