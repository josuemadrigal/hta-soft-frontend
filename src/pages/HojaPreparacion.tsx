import { useQuery } from '@tanstack/react-query';
import { List, PackageOpen, Printer, Tags } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { preparacionJornada } from '../api/recursos';
import type { PreparacionJornada } from '../api/tipos';
import { Boton, Cargando, EncabezadoPagina, ErrorCarga, Tarjeta, Vacio } from '../components/ui';
import { cn, nombreCompleto } from '../lib/formato';
import { diaJornada } from './Jornadas';

type Formato = 'lista' | 'etiquetas';
type PacientePrep = PreparacionJornada['pacientes'][number];

const miles = (n: number) => n.toLocaleString('es-DO');
/** "1", "½", "1½": las dosis de media pastilla se leen mejor como fracción. */
const dosis = (n: number) => {
  const entero = Math.floor(n);
  const medio = n - entero === 0.5;
  if (medio) return entero ? `${entero}½` : '½';
  return n.toLocaleString('es-DO');
};

/* ───────────── /jornadas/:id/preparacion ───────────── */

export function HojaPreparacion() {
  const id = Number(useParams().id);
  const consulta = useQuery({ queryKey: ['jornadas', 'preparacion', id], queryFn: () => preparacionJornada(id), enabled: !!id });
  const [formato, setFormato] = useState<Formato>('etiquetas');

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  const d = consulta.data;
  const j = d.jornada;
  const vacia = d.pacientes.length === 0;

  return (
    <>
      <div className="print:hidden">
        <EncabezadoPagina
          titulo="Hoja de preparación"
          descripcion={`${j.community.name} · ${diaJornada(j.fecha, true)}`}
          volver={{ a: `/jornadas/${j.id}`, texto: 'Volver a la jornada' }}
          acciones={
            !vacia && (
              <Boton icono={<Printer className="size-4" />} onClick={() => window.print()}>
                Imprimir
              </Boton>
            )
          }
        />

        {!vacia && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-1 rounded-xl border border-borde bg-marca-50 px-4 py-3 text-sm">
              <p>
                <strong>Cantidades estimadas:</strong> la última receta para 90 días. Al atenderlo se ajusta con las pastillas que le queden.
              </p>
              <p className="text-tenue">
                <Pendiente /> = se le quedó debiendo en su última visita.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-borde bg-superficie p-1" role="radiogroup" aria-label="Qué imprimir">
              {(
                [
                  ['etiquetas', 'Etiquetas', Tags],
                  ['lista', 'Lista', List],
                ] as const
              ).map(([valor, texto, Icono]) => (
                <button
                  key={valor}
                  role="radio"
                  aria-checked={formato === valor}
                  onClick={() => setFormato(valor)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                    formato === valor ? 'bg-marca-500 text-tinta' : 'text-tenue hover:text-tinta',
                  )}
                >
                  <Icono className="size-4" /> {texto}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {vacia ? (
        <Tarjeta>
          <Vacio icono={<PackageOpen className="size-8" />} titulo="No hay bolsitas que preparar">
            Ningún paciente de {j.community.name} tiene receta vigente ni pastillas pendientes para esta jornada.
          </Vacio>
        </Tarjeta>
      ) : (
        // En pantalla se ve como una hoja; al imprimir, el papel es la hoja.
        <div className="rounded-xl border border-borde bg-white p-6 shadow-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {formato === 'lista' ? <Lista d={d} /> : <Etiquetas d={d} />}
        </div>
      )}
    </>
  );
}

function Pendiente() {
  return <span className="inline-block rounded border border-amber-600 px-1 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">Pendiente</span>;
}

function Membrete({ d }: { d: PreparacionJornada }) {
  const j = d.jornada;
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b-2 border-tinta pb-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-tenue uppercase">Light a Candle · Dominican Republic</p>
        <h2 className="text-xl font-bold">Preparación de bolsitas · {j.community.name}</h2>
        <p className="text-sm">{diaJornada(j.fecha, true)}</p>
      </div>
      <p className="text-right text-sm text-tenue">
        {j.responsable && <>Responsable: {nombreCompleto(j.responsable)}<br /></>}
        {d.pacientes.length} {d.pacientes.length === 1 ? 'paciente' : 'pacientes'}
      </p>
    </header>
  );
}

/* Lista para ir marcando cada medicamento metido en la bolsita. */
function Lista({ d }: { d: PreparacionJornada }) {
  const celda = 'border border-tinta/30 px-2 py-1.5 align-top';
  return (
    <div>
      <Membrete d={d} />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-black/5 text-left text-xs uppercase">
            <th className={celda}>Paciente</th>
            <th className={celda}>Casa</th>
            <th className={celda}>Medicamento</th>
            <th className={cn(celda, 'text-right')}>Pastillas/día</th>
            <th className={cn(celda, 'text-right')}>Cantidad</th>
            <th className={cn(celda, 'w-12 text-center')}>Lista</th>
          </tr>
        </thead>
        {/* Un tbody por paciente para que el navegador no lo parta entre dos páginas. */}
        {d.pacientes.map((p) => (
          <tbody key={p.id} className="break-inside-avoid">
            {p.items.map((it, i) => (
              <tr key={`${it.medicamento}-${it.tipo}`}>
                {i === 0 && (
                  <>
                    <td className={celda} rowSpan={p.items.length}>
                      <span className="font-semibold">{p.nombre}</span>
                      <span className="block font-mono text-xs text-tenue">{p.codigo}</span>
                    </td>
                    <td className={celda} rowSpan={p.items.length}>
                      {p.casa ?? '—'}
                    </td>
                  </>
                )}
                <td className={celda}>
                  {it.medicamento} {it.tipo === 'PENDIENTE' && <Pendiente />}
                </td>
                <td className={cn(celda, 'tabular text-right')}>{dosis(it.dosisDiaria)}</td>
                <td className={cn(celda, 'tabular text-right font-semibold')}>{miles(it.cantidad)}</td>
                <td className={cn(celda, 'text-center')}>
                  <span className="inline-block size-4 border-2 border-tinta/70 align-middle" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="mt-6 break-inside-avoid">
        <h3 className="mb-2 text-sm font-bold uppercase">Totales a llevar</h3>
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="bg-black/5 text-left text-xs uppercase">
              <th className={celda}>Medicamento</th>
              <th className={cn(celda, 'text-right')}>Pastillas</th>
            </tr>
          </thead>
          <tbody>
            {d.totales.map((t) => (
              <tr key={t.medicamento}>
                <td className={celda}>{t.medicamento}</td>
                <td className={cn(celda, 'tabular text-right font-semibold')}>{miles(t.pastillas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Etiquetas de ~9×5 cm para recortar y pegar en cada bolsita. */
function Etiquetas({ d }: { d: PreparacionJornada }) {
  const j = d.jornada;
  return (
    <div>
      <p className="mb-4 text-sm text-tenue print:hidden">Recorte por la línea punteada y pegue cada etiqueta en la bolsita del paciente.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(2,minmax(0,9cm))] print:grid-cols-[repeat(2,9cm)] print:gap-[3mm]">
        {d.pacientes.map((p) => (
          <Etiqueta key={p.id} p={p} batey={j.community.name} fecha={diaJornada(j.fecha)} />
        ))}
      </div>
    </div>
  );
}

function Etiqueta({ p, batey, fecha }: { p: PacientePrep; batey: string; fecha: string }) {
  return (
    <article className="flex min-h-[5cm] w-full max-w-[9cm] break-inside-avoid flex-col border-2 border-dashed border-tinta/50 p-3 text-tinta">
      <p className="text-lg leading-tight font-bold">{p.nombre}</p>
      <p className="mt-0.5 text-xs">
        <span className="font-mono font-semibold">{p.codigo}</span>
        {p.casa && <> · Casa {p.casa}</>}
      </p>
      <p className="text-xs text-tenue">
        {batey} · {fecha}
      </p>
      <ul className="mt-2 space-y-1 border-t border-tinta/20 pt-2 text-sm">
        {p.items.map((it) => (
          <li key={`${it.medicamento}-${it.tipo}`} className="leading-snug">
            <span className="font-semibold">{it.medicamento}</span> — <span className="tabular">{miles(it.cantidad)}</span> pastillas — {dosis(it.dosisDiaria)} al día{' '}
            {it.tipo === 'PENDIENTE' && <Pendiente />}
          </li>
        ))}
      </ul>
    </article>
  );
}
