import { describe, expect, it } from 'vitest';
import type { Visita } from '../api/tipos';
import { alertasClinicas, cumplimientoBajo, tomaDe, UMBRALES_POR_DEFECTO, type Toma } from './alertas';

let id = 0;
/** Visita guardada mínima: solo lo que leen las alertas. */
function visita(s: number | null, d: number | null, extra: Partial<Visita> & { cumplimiento?: (number | null)[]; meds?: string[] } = {}): Visita {
  const { cumplimiento = [], meds, ...resto } = extra;
  const nombres = meds ?? cumplimiento.map(() => 'Amlodipino');
  return {
    id: ++id,
    patientId: 1,
    doctorId: 1,
    doctorNombre: null,
    originalDoctorId: null,
    visitDate: '2026-07-01T12:00:00.000Z',
    visitType: 'FOLLOW_UP',
    isHomeVisit: false,
    nextVisitDate: null,
    weightKg: null,
    heightM: null,
    bmi: null,
    systolicManual: s,
    diastolicManual: d,
    systolicAuto: null,
    diastolicAuto: null,
    heartRate: null,
    oxygenSaturation: null,
    temperature: null,
    reason: null,
    notes: null,
    prescriptionText: null,
    bpClassificationId: null,
    prescriptions: nombres.map((name, i) => ({
      id: i,
      visitId: 0,
      medicationId: i,
      dailyDose: 1,
      daysUntilNextVisit: 90,
      bufferDays: 0,
      patientSupplyRemaining: 0,
      totalRequired: 90,
      quantityDispensed: 90,
      adherencePercentage: cumplimiento[i] ?? null,
      medication: { id: i, name, concentration: '5 mg', currentStock: 0, stockMinimo: 0, activo: true },
    })),
    ...resto,
  };
}

const claves = (hoy: Toma, anteriores: Visita[] = [], u = UMBRALES_POR_DEFECTO) => alertasClinicas(hoy, anteriores, u).map((a) => a.clave);

describe('presión de hoy', () => {
  it('crisis desde 180 de sistólica o 110 de diastólica, y es urgente', () => {
    const [a] = alertasClinicas({ s: 180, d: 100 }, []);
    expect(a).toMatchObject({ clave: 'crisis', nivel: 'urgente', titulo: 'Crisis hipertensiva (180/100)' });
    expect(claves({ s: 150, d: 110 })).toContain('crisis');
    expect(claves({ s: 179, d: 109 })).not.toContain('crisis');
  });

  it('presión baja por debajo de 90/60', () => {
    expect(claves({ s: 85, d: 70 })).toEqual(['baja']);
    expect(claves({ s: 100, d: 59 })).toEqual(['baja']);
    expect(claves({ s: 90, d: 60 })).toEqual([]);
  });

  it('sin una de las dos cifras no evalúa la presión', () => {
    expect(claves({ s: 200 })).toEqual([]);
  });
});

describe('comparación con visitas anteriores', () => {
  it('avisa si subió 20 de sistólica o 10 de diastólica desde la última', () => {
    const [a] = alertasClinicas({ s: 150, d: 85 }, [visita(130, 80)]);
    expect(a).toMatchObject({ clave: 'subida', titulo: 'Subió +20/+5 desde la última visita' });
    expect(claves({ s: 135, d: 90 }, [visita(130, 80)])).toEqual(['subida']);
    expect(claves({ s: 149, d: 89 }, [visita(130, 80)])).toEqual([]);
  });

  it('compara con la última visita que tenga presión, no con una sin toma', () => {
    expect(claves({ s: 150, d: 85 }, [visita(null, null), visita(130, 80)])).toContain('subida');
  });

  it('los umbrales vienen de la configuración', () => {
    const u = { ...UMBRALES_POR_DEFECTO, alertaSubidaSistolica: 30 };
    expect(claves({ s: 150, d: 85 }, [visita(130, 80)], u)).toEqual([]);
  });

  it('3 visitas seguidas sin control estando en tratamiento', () => {
    const anteriores = [visita(150, 85, { meds: ['Losartán'] }), visita(145, 92, { meds: ['Losartán'] })];
    expect(claves({ s: 142, d: 80 }, anteriores)).toContain('sin-control');
    // Una controlada en medio corta la racha.
    expect(claves({ s: 142, d: 80 }, [visita(130, 80, { meds: ['Losartán'] }), anteriores[1]])).not.toContain('sin-control');
  });

  it('sin tratamiento no se habla de "sin control a pesar del tratamiento"', () => {
    expect(claves({ s: 150, d: 85 }, [visita(150, 85), visita(150, 85)])).not.toContain('sin-control');
  });
});

describe('cumplimiento', () => {
  it('bajo en 2 visitas seguidas (cuenta el medicamento peor tomado)', () => {
    const a = alertasClinicas({ cumplimientos: [95, 60] }, [visita(null, null, { cumplimiento: [70, 100] })]);
    expect(a).toEqual([expect.objectContaining({ clave: 'cumplimiento', titulo: 'Cumplimiento bajo en 2 visitas seguidas' })]);
    expect(a[0].detalle).toMatch(/^60%, 70%\./);
  });

  it('una visita buena corta la racha', () => {
    expect(claves({ cumplimientos: [60] }, [visita(null, null, { cumplimiento: [85] })])).toEqual([]);
  });

  it('las recetas sin cumplimiento (primera vez) no cuentan', () => {
    expect(claves({ cumplimientos: [60] }, [visita(null, null, { cumplimiento: [null] }), visita(null, null, { cumplimiento: [50] })])).toEqual(['cumplimiento']);
  });
});

describe('signos vitales', () => {
  it('pulso bajo: el umbral sube con atenolol', () => {
    expect(claves({ fc: 52 })).toEqual([]);
    expect(alertasClinicas({ fc: 52, medicamentos: ['Atenolol 50 mg'] }, [])[0].titulo).toBe('Pulso bajo (52 lpm) con atenolol');
    expect(claves({ fc: 48 })).toEqual(['fc-baja']);
    expect(claves({ fc: 101 })).toEqual(['fc-alta']);
  });

  it('saturación: aviso por debajo de 92, urgente por debajo de 88', () => {
    expect(alertasClinicas({ spo2: 90 }, [])[0].nivel).toBe('aviso');
    expect(alertasClinicas({ spo2: 87 }, [])[0].nivel).toBe('urgente');
    expect(claves({ spo2: 92 })).toEqual([]);
  });

  it('fiebre desde 38 °C', () => {
    expect(claves({ temperatura: 38 })).toEqual(['fiebre']);
    expect(claves({ temperatura: 37.9 })).toEqual([]);
  });
});

describe('peso', () => {
  it('IMC: sobrepeso desde 25, obesidad desde 30', () => {
    expect(alertasClinicas({ peso: 90, talla: 1.7 }, [])[0].titulo).toBe('Obesidad (IMC 31.1)');
    expect(alertasClinicas({ peso: 70, talla: 1.65 }, [])[0]).toMatchObject({ nivel: 'info', titulo: 'Sobrepeso (IMC 25.7)' });
    expect(claves({ peso: 60, talla: 1.7 })).toEqual([]);
  });

  it('bajó 5 % o más desde el último peso registrado', () => {
    const anteriores = [visita(null, null), visita(null, null, { weightKg: '80' })];
    expect(alertasClinicas({ peso: 76 }, anteriores)[0]).toMatchObject({ clave: 'peso-baja', titulo: 'Bajó 4.0 kg' });
    expect(claves({ peso: 76.5 }, anteriores)).toEqual([]);
  });
});

it('ordena: urgente, luego aviso, luego info', () => {
  const niveles = alertasClinicas({ s: 190, d: 100, fc: 110, spo2: 90, temperatura: 39 }, []).map((a) => a.nivel);
  expect(niveles).toEqual(['urgente', 'aviso', 'info', 'info']);
});

describe('tomaDe', () => {
  it('convierte una visita guardada (Decimal en texto, manual sobre automática)', () => {
    const v = visita(null, null, { systolicAuto: 140, diastolicAuto: 90, diastolicManual: 85, weightKg: '72.5', heightM: '1.70', temperature: '36.8', heartRate: 70, cumplimiento: [80, null] });
    expect(tomaDe(v)).toMatchObject({ s: 140, d: 85, fc: 70, peso: 72.5, talla: 1.7, temperatura: 36.8, medicamentos: ['Amlodipino', 'Amlodipino'], cumplimientos: [80] });
  });
});

describe('cumplimientoBajo (lista de la jornada)', () => {
  it('avisa con las últimas visitas bajo el mínimo, con los umbrales de Configuración', () => {
    expect(cumplimientoBajo([60, 70, 100])).toBe(true);
    expect(cumplimientoBajo([60, 90])).toBe(false);
    expect(cumplimientoBajo([60])).toBe(false);
    expect(cumplimientoBajo([60], { ...UMBRALES_POR_DEFECTO, alertaVisitasCumplimiento: 1 })).toBe(true);
  });
});
