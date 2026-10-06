import type { Configuracion } from '../api/recursos';
import type { Visita } from '../api/tipos';
import { fecha, num } from './formato';

/**
 * Alertas clínicas: se calculan con la toma de hoy (mientras se escribe) y el historial del
 * paciente. Son ayudas para el médico, no diagnósticos: cada una dice qué revisar.
 */

export type Nivel = 'urgente' | 'aviso' | 'info';
export type Alerta = { clave: string; nivel: Nivel; titulo: string; detalle: string };

export type Umbrales = Pick<Configuracion, 'alertaSubidaSistolica' | 'alertaSubidaDiastolica' | 'alertaCumplimientoMinimo' | 'alertaVisitasCumplimiento' | 'alertaVisitasSinControl'>;
export const UMBRALES_POR_DEFECTO: Umbrales = {
  alertaSubidaSistolica: 20,
  alertaSubidaDiastolica: 10,
  alertaCumplimientoMinimo: 80,
  alertaVisitasCumplimiento: 2,
  alertaVisitasSinControl: 3,
};

/** Datos de la visita que se evalúa (la que se está registrando, o la última). */
export type Toma = {
  s?: number | null;
  d?: number | null;
  fc?: number | null;
  spo2?: number | null;
  temperatura?: number | null;
  peso?: number | null;
  talla?: number | null;
  /** Nombres de los medicamentos que toma (los de hoy o los de la última receta). */
  medicamentos?: string[];
  /** Cumplimiento de hoy por medicamento, si ya se calculó. */
  cumplimientos?: number[];
  fecha?: string;
};

const presionDe = (v: Visita) => {
  const s = v.systolicManual ?? v.systolicAuto;
  const d = v.diastolicManual ?? v.diastolicAuto;
  return s && d ? { s, d } : null;
};
const sinControl = (p: { s: number; d: number }) => p.s >= 140 || p.d >= 90;
const ORDEN: Record<Nivel, number> = { urgente: 0, aviso: 1, info: 2 };

/** Toma de una visita guardada, en el formato que evalúan las alertas. */
export function tomaDe(v: Visita): Toma {
  const p = presionDe(v);
  return {
    s: p?.s,
    d: p?.d,
    fc: v.heartRate,
    spo2: v.oxygenSaturation,
    temperatura: num(v.temperature),
    peso: num(v.weightKg),
    talla: num(v.heightM),
    medicamentos: (v.prescriptions ?? []).map((r) => r.medication?.name ?? ''),
    cumplimientos: (v.prescriptions ?? []).map((r) => num(r.adherencePercentage)).filter((x): x is number => x !== null),
    fecha: v.visitDate,
  };
}

/**
 * @param hoy      la toma que se evalúa
 * @param anteriores visitas previas, de la más reciente a la más vieja (sin incluir la de hoy)
 */
export function alertasClinicas(hoy: Toma, anteriores: Visita[], u: Umbrales = UMBRALES_POR_DEFECTO): Alerta[] {
  const out: Alerta[] = [];
  const { s, d } = hoy;
  const tomas = anteriores.map((v) => ({ v, p: presionDe(v) })).filter((x): x is { v: Visita; p: { s: number; d: number } } => !!x.p);

  if (s && d) {
    if (s >= 180 || d >= 110) {
      out.push({
        clave: 'crisis',
        nivel: 'urgente',
        titulo: `Crisis hipertensiva (${s}/${d})`,
        detalle: 'Repite la toma en 5 minutos, en reposo. Si se mantiene, o hay dolor de pecho, dolor de cabeza fuerte, visión borrosa, falta de aire o debilidad de un lado del cuerpo: referir de inmediato.',
      });
    } else if (s < 90 || d < 60) {
      out.push({ clave: 'baja', nivel: 'aviso', titulo: `Presión baja (${s}/${d})`, detalle: 'Pregunta por mareos o desmayos. Puede ser exceso de medicamento: valora bajar la dosis.' });
    }

    const ultima = tomas[0];
    if (ultima) {
      const ds = s - ultima.p.s;
      const dd = d - ultima.p.d;
      if (ds >= u.alertaSubidaSistolica || dd >= u.alertaSubidaDiastolica) {
        out.push({
          clave: 'subida',
          nivel: 'aviso',
          titulo: `Subió ${ds > 0 ? `+${ds}` : ds}/${dd > 0 ? `+${dd}` : dd} desde la última visita`,
          detalle: `El ${fecha(ultima.v.visitDate)} tenía ${ultima.p.s}/${ultima.p.d}. Pregunta si dejó el medicamento, por la sal o por el estrés, y repite la toma.`,
        });
      }
    }

    // Varias visitas seguidas sin control estando en tratamiento
    const enTratamiento = (hoy.medicamentos?.length ?? 0) > 0 || anteriores.some((v) => v.prescriptions?.length);
    const n = u.alertaVisitasSinControl;
    const seguidas = [{ s, d }, ...tomas.map((t) => t.p)].slice(0, n);
    if (enTratamiento && seguidas.length >= n && seguidas.every(sinControl)) {
      out.push({
        clave: 'sin-control',
        nivel: 'aviso',
        titulo: `${n} visitas seguidas sin control`,
        detalle: `Sigue en ${seguidas.map((p) => `${p.s}/${p.d}`).join(', ')} a pesar del tratamiento. Si el cumplimiento es bueno, valora subir la dosis o agregar/cambiar el medicamento según el protocolo.`,
      });
    }
  }

  // Cumplimiento bajo varias visitas seguidas (el más bajo de cada visita)
  const minimo = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
  const serie = [minimo(hoy.cumplimientos ?? []), ...anteriores.map((v) => minimo((v.prescriptions ?? []).map((r) => num(r.adherencePercentage)).filter((x): x is number => x !== null)))].filter(
    (x): x is number => x !== null,
  );
  const k = u.alertaVisitasCumplimiento;
  if (serie.length >= k && serie.slice(0, k).every((x) => x < u.alertaCumplimientoMinimo)) {
    out.push({
      clave: 'cumplimiento',
      nivel: 'aviso',
      titulo: k === 1 ? `Cumplimiento bajo (${Math.round(serie[0])}%)` : `Cumplimiento bajo en ${k} visitas seguidas`,
      detalle: `${serie
        .slice(0, k)
        .map((x) => `${Math.round(x)}%`)
        .join(', ')}. Pregunta por qué no toma las pastillas (olvido, efectos, costo, se las comparte) antes de subir la dosis.`,
    });
  }

  // Pulso, saturación y temperatura
  const atenolol = (hoy.medicamentos ?? []).some((m) => /atenolol/i.test(m));
  if (hoy.fc) {
    if (hoy.fc < 50 || (atenolol && hoy.fc < 55)) {
      out.push({ clave: 'fc-baja', nivel: 'aviso', titulo: `Pulso bajo (${hoy.fc} lpm)${atenolol ? ' con atenolol' : ''}`, detalle: atenolol ? 'El atenolol baja el pulso: valora reducir la dosis o cambiarlo, sobre todo si hay mareo o cansancio.' : 'Pregunta por mareos, desmayos o cansancio.' });
    } else if (hoy.fc > 100) {
      out.push({ clave: 'fc-alta', nivel: 'info', titulo: `Pulso rápido (${hoy.fc} lpm)`, detalle: 'Repite la toma en reposo. Si sigue alto, busca fiebre, ansiedad o problemas del corazón.' });
    }
  }
  if (hoy.spo2 && hoy.spo2 < 92) {
    out.push({ clave: 'spo2', nivel: hoy.spo2 < 88 ? 'urgente' : 'aviso', titulo: `Saturación baja (${hoy.spo2}%)`, detalle: 'Revisa que el oxímetro esté bien puesto y repite. Si se confirma, referir.' });
  }
  if (hoy.temperatura && hoy.temperatura >= 38) {
    out.push({ clave: 'fiebre', nivel: 'info', titulo: `Fiebre (${hoy.temperatura} °C)`, detalle: 'Busca la causa; la fiebre puede subir el pulso y la presión.' });
  }

  // Peso
  if (hoy.peso && hoy.talla) {
    const imc = hoy.peso / (hoy.talla * hoy.talla);
    if (imc >= 30) out.push({ clave: 'imc', nivel: 'aviso', titulo: `Obesidad (IMC ${imc.toFixed(1)})`, detalle: 'Consejería de alimentación (menos sal y frituras) y actividad física. Bajar de peso ayuda a bajar la presión.' });
    else if (imc >= 25) out.push({ clave: 'imc', nivel: 'info', titulo: `Sobrepeso (IMC ${imc.toFixed(1)})`, detalle: 'Consejería de alimentación y actividad física.' });
  }
  const pesoAnterior = anteriores.find((v) => num(v.weightKg));
  if (hoy.peso && pesoAnterior) {
    const antes = num(pesoAnterior.weightKg)!;
    if ((antes - hoy.peso) / antes >= 0.05) {
      out.push({
        clave: 'peso-baja',
        nivel: 'info',
        titulo: `Bajó ${(antes - hoy.peso).toFixed(1)} kg`,
        detalle: `Pesaba ${antes} kg el ${fecha(pesoAnterior.visitDate)}. Si no lo buscaba, pregunta por la comida y por síntomas de otra enfermedad.`,
      });
    }
  }

  return out.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
}
