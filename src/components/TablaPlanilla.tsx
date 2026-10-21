import type { FilaPlanilla } from '../api/tipos';
import { cn } from '../lib/formato';

type Clave = keyof Omit<FilaPlanilla, 'communityId' | 'batey' | 'fechas'>;

/** Las columnas de la planilla de papel, en su orden y con su texto en inglés y en español (va a los donantes). */
export const COLUMNAS_PLANILLA: { clave: Clave; en: string; es: string; grupo?: 'existentes' | 'nuevos' }[] = [
  { clave: 'evaluados', en: '# of evaluated patients', es: '# de pacientes evaluados' },
  { clave: 'enPrograma', en: '# of existing patients', es: '# de pacientes existentes (en el programa)' },
  { clave: 'conToma', en: '# of BP checks', es: '# de pacientes consultados' },
  { clave: 'existentesConMedicamento', en: '# of existing patients on HTN meds', es: '# de pacientes con medicamentos para HTN', grupo: 'existentes' },
  { clave: 'controlados', en: '# of existing patients on meds showing controlled BP <140/90', es: '# de pacientes con presión controlada <140/90', grupo: 'existentes' },
  { clave: 'noControlados', en: '# of existing patients on meds showing uncontrolled BP >140/90', es: '# de pacientes con presión no controlada >140/90', grupo: 'existentes' },
  { clave: 'datosDudosos', en: '# existing patients with absent or questionable data', es: '# de pacientes con datos ausentes o cuestionables', grupo: 'existentes' },
  { clave: 'nuevos', en: '# of new patients', es: '# de pacientes nuevos', grupo: 'nuevos' },
  { clave: 'nuevosConMedicamento', en: '# of new patients placed on HTN meds', es: '# de pacientes nuevos que recibieron medicamentos para HTN', grupo: 'nuevos' },
];

const CORTA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' });
const fechaDe = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
/** "9 oct", "9 · 16 oct", o "5 días" si son muchas. */
export function textoFechas(fechas: string[]) {
  if (!fechas.length) return '';
  if (fechas.length > 3) return `${fechas.length} días`;
  return fechas.map((f) => CORTA.format(fechaDe(f))).join(' · ');
}

/** La planilla como en el papel: una fila por batey y las 9 columnas en el mismo orden. */
export function TablaPlanilla({ filas, total, vacio }: { filas: FilaPlanilla[]; total?: FilaPlanilla; vacio: string }) {
  return (
    <table className="w-full min-w-[1080px] border-collapse text-sm print:min-w-0 print:text-[11px]">
      <thead>
        <tr className="border-b border-borde align-bottom">
          <th className="px-4 py-3 text-left">
            <span className="block text-xs font-semibold">Batey Name</span>
            <span className="block text-[11px] font-normal text-tenue italic">Nombre del batey</span>
          </th>
          {COLUMNAS_PLANILLA.map((c) => (
            <th key={c.clave} className={cn('w-[9%] px-3 py-3 text-right', c.grupo === 'existentes' && 'bg-fondo', c.grupo === 'nuevos' && 'bg-marca-50', (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde')}>
              <span className="block text-xs leading-tight font-semibold text-balance">{c.en}</span>
              <span className="mt-1 block text-[11px] leading-tight font-normal text-balance text-tenue italic">{c.es}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-borde">
        {filas.map((f) => (
          <Fila key={f.communityId} f={f} />
        ))}
        {filas.length === 0 && (
          <tr>
            <td colSpan={COLUMNAS_PLANILLA.length + 1} className="px-5 py-10 text-center text-tenue">
              {vacio}
            </td>
          </tr>
        )}
      </tbody>
      {total && filas.length > 1 && (
        <tfoot>
          <Fila f={total} total />
        </tfoot>
      )}
    </table>
  );
}

function Fila({ f, total }: { f: FilaPlanilla; total?: boolean }) {
  const vacio = f.evaluados === 0 && !total;
  return (
    <tr className={cn(total ? 'border-t-2 border-tinta/20 bg-fondo font-semibold' : 'hover:bg-fondo/60', vacio && 'text-tenue')}>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="block font-medium">{f.batey}</span>
        {!total && f.fechas.length > 0 && <span className="block text-[11px] text-tenue">{textoFechas(f.fechas)}</span>}
      </td>
      {COLUMNAS_PLANILLA.map((c) => {
        const v = f[c.clave];
        // Lo que no aplica (batey sin visitas) queda en blanco, como en el papel; en el programa siempre se muestra.
        const mostrar = !vacio || c.clave === 'enPrograma';
        return (
          <td
            key={c.clave}
            className={cn(
              'tabular px-3 py-2.5 text-right',
              c.grupo === 'existentes' && 'bg-fondo/60',
              c.grupo === 'nuevos' && 'bg-marca-50/60',
              (c.clave === 'existentesConMedicamento' || c.clave === 'nuevos') && 'border-l border-borde',
              c.clave === 'noControlados' && v > 0 && !vacio && 'text-red-700',
              c.clave === 'controlados' && v > 0 && !vacio && 'text-green-700',
            )}
          >
            {mostrar ? v.toLocaleString('es-DO') : ''}
          </td>
        );
      })}
    </tr>
  );
}
