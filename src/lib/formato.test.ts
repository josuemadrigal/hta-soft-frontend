import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoriaPA, ConfigPA } from '../api/tipos';
import { atendio, clasificar, colorCumplimiento, decimal, diasHasta, edad, edadTexto, fecha, fechaDia, iniciales, nombreCompleto, num, tensionDe } from './formato';

describe('fechas', () => {
  beforeEach(() => {
    // Las pruebas corren en hora de Santo Domingo (UTC-4, ver vitest.config.ts). Solo Date: nada usa timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 22, 30));
  });
  afterEach(() => vi.useRealTimers());

  it('fecha se muestra en hora local; fechaDia no corre el día de una fecha guardada a medianoche UTC', () => {
    const medianocheUtc = '2026-10-06T00:00:00.000Z';
    // En La Romana eso es el 5 a las 8 p. m.: para un vencimiento sería un día de menos.
    expect(fecha(medianocheUtc)).toMatch(/^05 /);
    expect(fechaDia(medianocheUtc)).toMatch(/^06 /);
    expect(fecha(null)).toBe('—');
    expect(fechaDia(undefined)).toBe('—');
  });

  it('diasHasta cuenta desde hoy local, aunque en UTC ya sea mañana', () => {
    // 22:30 del 6 en La Romana = 02:30 del 7 en UTC.
    expect(diasHasta('2026-10-06')).toBe(0);
    expect(diasHasta('2026-10-07T00:00:00.000Z')).toBe(1);
    expect(diasHasta('2026-10-01')).toBe(-5);
    expect(diasHasta('2026-11-05')).toBe(30);
  });

  it('edad: cumple el día exacto, leyendo la fecha de nacimiento en UTC', () => {
    expect(edad('1960-10-06T00:00:00.000Z')).toBe(66);
    expect(edad('1960-10-07T00:00:00.000Z')).toBe(65);
    expect(edad('1960-11-01T00:00:00.000Z')).toBe(65);
    expect(edad('1960-01-01T00:00:00.000Z')).toBe(66);
  });

  it('edadTexto marca la edad estimada con ~', () => {
    expect(edadTexto({ birthDate: '1960-01-01T00:00:00.000Z' })).toBe('66 años');
    expect(edadTexto({ birthDate: '1960-01-01T00:00:00.000Z', birthDateIsEstimated: true })).toBe('~66 años');
  });
});

describe('nombres', () => {
  it('nombreCompleto no deja espacios sobrantes', () => {
    expect(nombreCompleto({ firstName: 'Ana', lastName: 'Pérez' })).toBe('Ana Pérez');
    expect(nombreCompleto({ firstName: 'Ana', lastName: '' })).toBe('Ana');
  });

  it('iniciales: nombre y apellido, o las dos primeras letras si no hay apellido', () => {
    expect(iniciales({ firstName: 'ana', lastName: 'pérez' })).toBe('AP');
    expect(iniciales({ firstName: 'Mercedes', lastName: '  ' })).toBe('ME');
  });

  it('atendio prefiere el nombre guardado en la visita', () => {
    expect(atendio({ doctorNombre: 'Dra. López', doctor: { firstName: 'Otro', lastName: 'Nombre' } })).toBe('Dra. López');
    expect(atendio({ doctorNombre: null, doctor: { firstName: 'Juan', lastName: 'Díaz' } })).toBe('Juan Díaz');
    expect(atendio({})).toBe('—');
  });
});

describe('números', () => {
  it('num convierte el Decimal de Prisma (texto) y respeta null', () => {
    expect(num('72.50')).toBe(72.5);
    expect(num(0)).toBe(0);
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
  });

  it('decimal formatea o muestra — si no hay número', () => {
    expect(decimal('1.756', 2)).toBe('1.76');
    expect(decimal(30)).toBe('30.0');
    expect(decimal(null)).toBe('—');
    expect(decimal('abc')).toBe('—');
  });

  it('colorCumplimiento: verde ≥ 90, ámbar ≥ 75, rojo debajo', () => {
    expect(colorCumplimiento(90)).toBe('text-green-700');
    expect(colorCumplimiento(89.9)).toBe('text-amber-700');
    expect(colorCumplimiento(75)).toBe('text-amber-700');
    expect(colorCumplimiento(74)).toBe('text-red-600');
  });
});

describe('tensionDe', () => {
  const v = (sm: number | null, sa: number | null, dm: number | null, da: number | null) => ({ systolicManual: sm, systolicAuto: sa, diastolicManual: dm, diastolicAuto: da });

  it('la toma manual manda sobre la automática', () => {
    expect(tensionDe(v(150, 140, 95, 90))).toBe('150/95');
    expect(tensionDe(v(null, 140, null, 90))).toBe('140/90');
    expect(tensionDe(v(150, null, null, 90))).toBe('150/90');
  });

  it('sin una de las dos cifras no hay tensión', () => {
    expect(tensionDe(v(150, null, null, null))).toBe('—');
  });
});

describe('clasificar (réplica de BloodPressureConfigService.classify)', () => {
  let id = 0;
  const cfg = (categoryName: CategoriaPA, s: [number, number], d: [number, number], priority: number): ConfigPA => ({
    id: ++id,
    categoryName,
    systolicMin: s[0],
    systolicMax: s[1],
    diastolicMin: d[0],
    diastolicMax: d[1],
    priority,
    colorHex: '#000000',
  });
  // Rangos ESH del seed del backend (prisma/seed.ts).
  const configs = [
    cfg('NORMAL', [0, 129], [0, 84], 1),
    cfg('ELEVATED', [130, 139], [85, 89], 2),
    cfg('GRADE_1', [140, 159], [90, 99], 3),
    cfg('GRADE_2', [160, 179], [100, 109], 4),
    cfg('CRISIS', [180, 300], [110, 200], 5),
  ];
  const categoria = (s: number, d: number) => clasificar(configs, s, d)?.categoryName;

  it('clasifica por rangos', () => {
    expect(categoria(120, 80)).toBe('NORMAL');
    expect(categoria(135, 80)).toBe('ELEVATED');
    expect(categoria(150, 95)).toBe('GRADE_1');
  });

  it('sistólica y diastólica en categorías distintas: gana la de mayor prioridad', () => {
    expect(categoria(125, 95)).toBe('GRADE_1');
    expect(categoria(165, 80)).toBe('GRADE_2');
    expect(categoria(185, 85)).toBe('CRISIS');
  });

  it('por encima de todos los rangos: la categoría más alta ya superada', () => {
    // Si un administrador recorta el rango de crisis, lo que queda por encima sigue siendo crisis.
    const recortados = configs.map((c) => (c.categoryName === 'CRISIS' ? { ...c, systolicMax: 220, diastolicMax: 130 } : c));
    expect(clasificar(recortados, 240, 140)?.categoryName).toBe('CRISIS');
    // Solo una cifra por encima de todo, la otra normal: sigue siendo crisis.
    expect(clasificar(recortados, 240, 80)?.categoryName).toBe('CRISIS');
  });

  it('sin configuración no clasifica', () => {
    expect(clasificar([], 140, 90)).toBeNull();
  });
});
