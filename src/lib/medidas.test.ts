import { describe, expect, it } from 'vitest';
import { ultimasMedidas } from './formato';

describe('ultimasMedidas', () => {
  it('toma el peso y la estatura de la visita más reciente que los tenga', () => {
    const m = ultimasMedidas([
      { visitDate: '2026-07-23', weightKg: null, heightM: null },
      { visitDate: '2026-04-23', weightKg: '68.5', heightM: null },
      { visitDate: '2026-01-23', weightKg: '70', heightM: '1.55' },
    ] as never);
    expect(m.peso).toBe(68.5);
    expect(m.talla).toBe(1.55);
    expect(m.fecha).toBe('2026-04-23');
    expect(m.imc?.toFixed(1)).toBe('28.5');
    expect(m.imcTexto).toBe('sobrepeso');
  });
  it('sin visitas, sin medidas', () => {
    expect(ultimasMedidas([])).toMatchObject({ peso: null, talla: null, imc: null });
  });
});
