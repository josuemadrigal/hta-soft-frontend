import { CalendarDays, FileText, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { usePaciente } from '../api/consultas';
import type { Receta } from '../api/tipos';
import { Cargando, EncabezadoPagina, ErrorCarga, Tarjeta, Vacio, Boton } from '../components/ui';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { DIA_MS, fecha, nombreCompleto, tensionDe } from '../lib/formato';

/* La próxima visita guardada es fecha "pura" (medianoche UTC); la estimada se calcula en hora local. */
const fmtLargoUTC = new Intl.DateTimeFormat('es-DO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtLargo = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "media pastilla", "1 pastilla", "2 pastillas", "1½ pastillas". */
function pastillas(n: number) {
  if (n === 0.5) return 'media pastilla';
  const entero = Math.floor(n);
  const cifra = n - entero === 0.5 ? `${entero}½` : n.toLocaleString('es-DO');
  return `${cifra} ${n === 1 ? 'pastilla' : 'pastillas'}`;
}

const CONSEJOS = [
  'Use poca sal en la comida.',
  'Tome las pastillas todos los días, aunque se sienta bien.',
  'No deje las pastillas sin preguntar al médico.',
  'Venga a la próxima jornada.',
  'Vaya al hospital si tiene dolor de cabeza muy fuerte, dolor en el pecho o le falta el aire.',
];

/* ───────────── /pacientes/:id/indicaciones ───────────── */

export function HojaIndicaciones() {
  const id = Number(useParams().id);
  const consulta = usePaciente(id);
  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const p = consulta.data;
  if (!p)
    return (
      <Vacio titulo="Paciente no encontrado">
        <Link to="/pacientes" className="text-marca-700 hover:underline">
          Volver al listado
        </Link>
      </Vacio>
    );
  // La API devuelve las visitas de la más reciente a la más antigua.
  const v = p.clinicalVisits?.[0];
  const recetas = (v?.prescriptions ?? []).filter((r): r is Receta => !!r.medication);
  const vacia = !v || recetas.length === 0;

  const proxima = v?.nextVisitDate
    ? mayuscula(fmtLargoUTC.format(new Date(v.nextVisitDate)))
    : v
      ? mayuscula(fmtLargo.format(new Date(Date.parse(v.visitDate) + 90 * DIA_MS)))
      : '';
  const categoria = v?.bpClassification;
  const tension = v ? tensionDe(v) : '—';

  return (
    <>
      <div className="print:hidden">
        <EncabezadoPagina
          titulo="Hoja de indicaciones"
          descripcion={`${nombreCompleto(p)} · ${p.patientCode}`}
          volver={{ a: `/pacientes/${p.id}`, texto: 'Volver al paciente' }}
          acciones={
            !vacia && (
              <Boton icono={<Printer className="size-4" />} onClick={() => window.print()}>
                Imprimir
              </Boton>
            )
          }
        />
      </div>

      {vacia ? (
        <Tarjeta>
          <Vacio icono={<FileText className="size-8" />} titulo={v ? 'La última visita no tiene medicamentos' : 'Este paciente no tiene visitas'}>
            La hoja se arma con los medicamentos recetados en la última visita.
          </Vacio>
        </Tarjeta>
      ) : (
        // Pensada para media carta / A5: en pantalla se ve como la hoja que se le entrega.
        <article className="mx-auto max-w-[148mm] rounded-xl border border-borde bg-white p-6 text-tinta shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="border-b-2 border-tinta pb-3">
            <p className="text-xs font-semibold tracking-wide text-tenue uppercase">Light a Candle · Dominican Republic</p>
            <h2 className="mt-1 text-2xl leading-tight font-bold">{nombreCompleto(p)}</h2>
            <p className="mt-0.5 text-sm">
              <span className="font-mono font-semibold">{p.patientCode}</span>
              {p.community?.name && <> · {p.community.name}</>} · Visita del {fecha(v.visitDate)}
            </p>
          </header>

          <section className="mt-4">
            <h3 className="mb-2 text-lg font-bold">Sus medicamentos</h3>
            <table className="w-full border-collapse text-base">
              <tbody>
                {recetas.map((r) => {
                  const debemos = Math.max((r.cantidadIndicada ?? 0) - r.quantityDispensed, 0);
                  return (
                    <tr key={r.id} className="border-y border-tinta/30">
                      <td className="py-2 pr-3 align-top">
                        <span className="block text-lg leading-tight font-bold">{r.medication!.name}</span>
                        <span className="text-sm">{r.medication!.concentration}</span>
                      </td>
                      <td className="py-2 pr-3 align-top text-lg font-semibold">Tome {pastillas(r.dailyDose)} al día</td>
                      <td className="py-2 text-right align-top text-sm whitespace-nowrap">
                        Le entregamos <strong className="tabular text-base">{r.quantityDispensed}</strong>
                        {debemos > 0 && (
                          <span className="block">
                            Le debemos <strong className="tabular">{debemos}</strong>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {tension !== '—' && (
            <p className="mt-4 text-lg">
              Su presión hoy: <strong className="tabular">{tension}</strong>
              {categoria && (
                <span className="font-semibold" style={{ color: colorCategoria(categoria) }}>
                  {' '}
                  ({CATEGORIAS[categoria.categoryName]})
                </span>
              )}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-lg border-2 border-tinta px-4 py-3">
            <CalendarDays className="size-7 shrink-0" />
            <p className="leading-tight">
              <span className="block text-sm font-medium">Próxima visita</span>
              <span className="text-xl font-bold">{proxima}</span>
            </p>
          </div>

          {v.prescriptionText?.trim() && (
            <section className="mt-4">
              <h3 className="mb-1 text-base font-bold">Indicaciones del médico</h3>
              <p className="text-base whitespace-pre-line">{v.prescriptionText.trim()}</p>
            </section>
          )}

          <section className="mt-4 break-inside-avoid">
            <h3 className="mb-1 text-base font-bold">Recuerde</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-base">
              {CONSEJOS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </>
  );
}
