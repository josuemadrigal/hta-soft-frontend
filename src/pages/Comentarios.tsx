import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, MessageSquareText, Search, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { comentariosVisitas, type ComentarioVisita } from '../api/recursos';
import type { Genero } from '../api/tipos';
import { FiltroPeriodo, useFiltroPeriodo } from '../components/FiltroPeriodo';
import { Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { coincide, normalizar } from '../lib/busqueda';
import { descargarCsv } from '../lib/copiar';
import { CATEGORIAS, colorCategoria } from '../lib/etiquetas';
import { cn, edadTexto, fecha, nombreCompleto } from '../lib/formato';

const CUMPLIMIENTO = [
  { value: 'bajo', label: 'Menos de 80%', entra: (c: number | null) => c !== null && c < 80 },
  { value: 'medio', label: '80–94%', entra: (c: number | null) => c !== null && c >= 80 && c < 95 },
  { value: 'alto', label: '95% o más', entra: (c: number | null) => c !== null && c >= 95 },
  { value: 'sin', label: 'Sin dato', entra: (c: number | null) => c === null },
];
const ANTERIOR = { si: 'Vino a la anterior', no: 'No vino a la anterior', primera: 'Primera visita' } as const;
const colorCumplimiento = (c: number | null) => (c === null ? 'text-tenue' : c >= 95 ? 'text-green-700' : c >= 80 ? 'text-amber-700' : 'text-red-600');

/** /reportes/comentarios — los comentarios de las visitas del periodo, con presión, cumplimiento, médico y si vino a la ronda anterior. */
export function Comentarios() {
  const [params] = useSearchParams();
  const filtro = useFiltroPeriodo();
  // Género y edad vienen de Reportes si estaban puestos.
  const consulta = useQuery({
    queryKey: ['reportes', 'comentarios', filtro, params.get('genero'), params.get('edadMin'), params.get('edadMax')],
    queryFn: () =>
      comentariosVisitas({
        from: filtro.from,
        to: filtro.to,
        communityId: filtro.communityId,
        gender: (params.get('genero') as Genero) || undefined,
        ageMin: params.get('edadMin') ? Number(params.get('edadMin')) : undefined,
        ageMax: params.get('edadMax') ? Number(params.get('edadMax')) : undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const atras = new URLSearchParams(params);

  return (
    <>
      <EncabezadoPagina
        titulo="Comentarios de las visitas"
        descripcion="Lo que anotaron los médicos en cada visita, con la presión, el cumplimiento y si el paciente vino a la ronda anterior. Toca una fila para abrir al paciente."
        volver={{ a: `/reportes?${atras}`, texto: 'Reportes' }}
      />
      <FiltroPeriodo />
      {consulta.isPending ? (
        <Cargando forma="lista" texto="Buscando los comentarios…" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} />
      ) : (
        <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
          <Lista todos={consulta.data} sufijo={`${filtro.desde}_${filtro.hasta}`} />
        </div>
      )}
    </>
  );
}

function Lista({ todos, sufijo }: { todos: ComentarioVisita[]; sufijo: string }) {
  const navegar = useNavigate();
  const [buscar, setBuscar] = useState('');
  const [batey, setBatey] = useState('');
  const [medico, setMedico] = useState('');
  const [presion, setPresion] = useState('');
  const [cumplimiento, setCumplimiento] = useState('');
  const [anterior, setAnterior] = useState('');
  const [lugar, setLugar] = useState('');

  const q = buscar.trim();
  const texto = normalizar(q);
  const filas = todos.filter((c) => {
    // El texto busca en el paciente (por palabras, tolerante a errores) o dentro del comentario.
    if (q && !coincide(q, c.paciente) && !normalizar(`${c.comentario ?? ''} ${c.motivo ?? ''}`).includes(texto)) return false;
    if (batey && String(c.batey.id) !== batey) return false;
    if (medico && c.medico !== medico) return false;
    const k = c.categoria;
    if (presion === 'controlados' && !(k === 'NORMAL' || k === 'ELEVATED')) return false;
    if (presion === 'noControlados' && !(k === 'GRADE_1' || k === 'GRADE_2' || k === 'CRISIS')) return false;
    if (presion === 'sinToma' && k) return false;
    if (presion && !['controlados', 'noControlados', 'sinToma'].includes(presion) && k !== presion) return false;
    if (cumplimiento && !CUMPLIMIENTO.find((x) => x.value === cumplimiento)!.entra(c.cumplimiento)) return false;
    if (anterior && c.vinoAnterior !== anterior) return false;
    if (lugar === 'casa' && !c.domicilio) return false;
    if (lugar === 'jornada' && c.domicilio) return false;
    return true;
  });
  // Las opciones salen de la lista, con cuántos tiene cada una.
  const contar = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const bateyes = contar(todos.map((c) => `${c.batey.id}|${c.batey.name}`));
  const medicos = contar(todos.map((c) => c.medico));
  const hayFiltros = !!(q || batey || medico || presion || cumplimiento || anterior || lugar);
  const limpiar = () => {
    setBuscar('');
    setBatey('');
    setMedico('');
    setPresion('');
    setCumplimiento('');
    setAnterior('');
    setLugar('');
  };
  const exportar = () =>
    descargarCsv(
      filas.map((c) => ({
        fecha: fecha(c.fecha),
        codigo: c.paciente.patientCode,
        paciente: nombreCompleto(c.paciente),
        batey: c.batey.name,
        presion: c.presion ?? '',
        clasificacion: c.categoria ? CATEGORIAS[c.categoria] : '',
        cumplimiento: c.cumplimiento ?? '',
        anterior: c.vinoAnterior === 'no' ? `No (${c.rondasSinVenir} rondas sin venir)` : ANTERIOR[c.vinoAnterior],
        medico: c.medico,
        lugar: c.domicilio ? 'Domicilio' : 'Jornada',
        motivo: c.motivo ?? '',
        comentario: c.comentario ?? '',
      })),
      [
        { clave: 'fecha', titulo: 'Fecha' },
        { clave: 'codigo', titulo: 'Código' },
        { clave: 'paciente', titulo: 'Paciente' },
        { clave: 'batey', titulo: 'Batey' },
        { clave: 'presion', titulo: 'Presión' },
        { clave: 'clasificacion', titulo: 'Clasificación' },
        { clave: 'cumplimiento', titulo: 'Cumplimiento %' },
        { clave: 'anterior', titulo: 'Visita anterior' },
        { clave: 'medico', titulo: 'Médico' },
        { clave: 'lugar', titulo: 'Lugar' },
        { clave: 'motivo', titulo: 'Motivo de consulta' },
        { clave: 'comentario', titulo: 'Comentario' },
      ],
      `comentarios-visitas_${sufijo}`,
    );

  return (
    <Tarjeta
      titulo={
        <span className="flex items-center gap-2">
          <MessageSquareText className="size-4" /> {hayFiltros ? `${filas.length} de ${todos.length}` : todos.length.toLocaleString('es-DO')} {todos.length === 1 ? 'comentario' : 'comentarios'}
        </span>
      }
      accion={
        filas.length > 0 && (
          <button onClick={exportar} className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50">
            <Download className="size-3.5" /> CSV
          </button>
        )
      }
    >
      {todos.length === 0 ? (
        <Vacio icono={<MessageSquareText className="size-8" />} titulo="Sin comentarios en este periodo">
          Cambia las fechas o el batey.
        </Vacio>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-borde px-5 py-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tenue" />
              <Entrada placeholder="Buscar paciente o palabra del comentario" aria-label="Buscar" className="pl-8" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            {bateyes.length > 1 && (
              <Selector className="w-48" aria-label="Batey" vacio="Todos los bateyes" value={batey} onChange={(e) => setBatey(e.target.value)} opciones={bateyes.map(([b, n]) => ({ value: b.split('|')[0], label: `${b.split('|')[1]} (${n})` }))} />
            )}
            <Selector className="w-52" aria-label="Médico" vacio="Cualquier médico" value={medico} onChange={(e) => setMedico(e.target.value)} opciones={medicos.map(([m, n]) => ({ value: m, label: `${m} (${n})` }))} />
            <Selector
              className="w-52"
              aria-label="Presión"
              vacio="Cualquier presión"
              value={presion}
              onChange={(e) => setPresion(e.target.value)}
              opciones={[
                { value: 'controlados', label: 'Controlados (< 140/90)' },
                { value: 'noControlados', label: 'No controlados (≥ 140/90)' },
                ...(['NORMAL', 'ELEVATED', 'GRADE_1', 'GRADE_2', 'CRISIS'] as const).map((c) => ({ value: c, label: CATEGORIAS[c] })),
                { value: 'sinToma', label: 'Sin toma' },
              ]}
            />
            <Selector className="w-48" aria-label="Cumplimiento" vacio="Cualquier cumplimiento" value={cumplimiento} onChange={(e) => setCumplimiento(e.target.value)} opciones={CUMPLIMIENTO.map(({ value, label }) => ({ value, label }))} />
            <Selector className="w-52" aria-label="Visita anterior" vacio="Visita anterior: todas" value={anterior} onChange={(e) => setAnterior(e.target.value)} opciones={Object.entries(ANTERIOR).map(([value, label]) => ({ value, label }))} />
            <Selector className="w-40" aria-label="Lugar" vacio="Jornada y casa" value={lugar} onChange={(e) => setLugar(e.target.value)} opciones={[{ value: 'jornada', label: 'En la jornada' }, { value: 'casa', label: 'En su casa' }]} />
            {hayFiltros && (
              <Boton variante="fantasma" icono={<X className="size-4" />} onClick={limpiar}>
                Limpiar
              </Boton>
            )}
          </div>
          <Tabla columnas={['Fecha', 'Paciente', 'Batey', 'Presión', { texto: 'Cumplim.', className: 'text-right' }, 'Visita anterior', 'Médico']}>
            {filas.map((c) => (
              // Dos filas por visita: los datos y, debajo a todo lo ancho, el comentario (lo que se viene a leer).
              <Fragment key={c.visitaId}>
              <tr onClick={() => navegar(`/pacientes/${c.paciente.id}`)} className="cursor-pointer align-top !border-b-0 [&>td]:pb-1">
                <td className="px-5 py-2.5 whitespace-nowrap">
                  {fecha(c.fecha)}
                  {c.domicilio && <span className="block text-xs text-tenue">En su casa</span>}
                </td>
                <td className="px-5 py-2.5">
                  <span className="font-medium whitespace-nowrap">{nombreCompleto(c.paciente)}</span>
                  <span className="block text-xs whitespace-nowrap text-tenue">
                    <span className="font-mono">{c.paciente.patientCode}</span> · {edadTexto(c.paciente)}
                  </span>
                </td>
                <td className="px-5 py-2.5 whitespace-nowrap">{c.batey.name}</td>
                <td className="px-5 py-2.5 whitespace-nowrap">
                  <span className="tabular mr-2 font-mono">{c.presion ?? '—'}</span>
                  {c.categoria && (
                    <Insignia color={colorCategoria(c.categoria)}>
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: colorCategoria(c.categoria) }} />
                      {CATEGORIAS[c.categoria]}
                    </Insignia>
                  )}
                </td>
                <td className={cn('tabular px-5 py-2.5 text-right font-medium', colorCumplimiento(c.cumplimiento))}>{c.cumplimiento === null ? '—' : `${c.cumplimiento}%`}</td>
                <td className="px-5 py-2.5 whitespace-nowrap">
                  {c.vinoAnterior === 'si' ? (
                    <span className="text-green-700">Sí</span>
                  ) : c.vinoAnterior === 'no' ? (
                    <span className="text-red-600">
                      No · {c.rondasSinVenir} {c.rondasSinVenir === 1 ? 'ronda' : 'rondas'} sin venir
                    </span>
                  ) : (
                    <span className="text-tenue">Primera visita</span>
                  )}
                  {c.anterior && <span className="block text-xs text-tenue">Anterior: {fecha(c.anterior)}</span>}
                </td>
                <td className="px-5 py-2.5 whitespace-nowrap">{c.medico}</td>
              </tr>
              <tr onClick={() => navegar(`/pacientes/${c.paciente.id}`)} className="cursor-pointer">
                <td colSpan={7} className="px-5 pt-0 pb-3">
                  <div className="rounded-lg border-l-2 border-marca-500 bg-fondo px-3 py-2 text-sm">
                    {c.comentario && <p className="whitespace-pre-line">{c.comentario}</p>}
                    {c.motivo && <p className="text-xs text-tenue">Motivo de consulta: {c.motivo}</p>}
                  </div>
                </td>
              </tr>
              </Fragment>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-tenue">
                  Nada coincide con los filtros.
                </td>
              </tr>
            )}
          </Tabla>
        </>
      )}
    </Tarjeta>
  );
}
