import { Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useConfigPA, usePacientes, useUltimosMedicos } from '../api/consultas';
import type { FiltroPacientes } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Paginacion, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, ESTADOS, GENEROS, opciones } from '../lib/etiquetas';
import { asistencia, SITUACIONES_ASISTENCIA } from '../lib/asistencia';
import { cn, edadTexto, fecha, nombreCompleto } from '../lib/formato';

const ORDENES = [
  { value: 'nombre', label: 'Nombre (A–Z)' },
  { value: 'codigo', label: 'Código' },
  { value: 'ultima-visita', label: 'Última visita (reciente primero)' },
  { value: 'ausencia', label: 'Más tiempo sin venir primero' },
  { value: 'presion', label: 'Presión más alta primero' },
];

export function Pacientes() {
  const navegar = useNavigate();
  const puedeEditar = useSesion().tiene('pacientes.editar');
  // Filtros en la URL: "atrás" desde la ficha vuelve al mismo listado, y se pueden compartir.
  const [params, setParams] = useSearchParams();
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const filtro: FiltroPacientes = {
    page: num('pagina') ?? 1,
    search: params.get('q') ?? undefined,
    communityId: num('batey'),
    gender: params.get('genero') ?? undefined,
    status: params.get('estado') ?? undefined,
    clasificacion: params.get('clasificacion') ?? undefined,
    situacion: (params.get('situacion') as FiltroPacientes['situacion']) ?? undefined,
    ageMin: num('edadMin'),
    ageMax: num('edadMax'),
    medico: num('medico'),
    orden: (params.get('orden') as FiltroPacientes['orden']) ?? 'nombre',
  };
  const [texto, setTexto] = useState(filtro.search ?? '');
  const filtrosExtra = ['genero', 'estado', 'clasificacion', 'situacion', 'edadMin', 'edadMax', 'medico'].filter((k) => params.get(k)).length;
  const [masFiltros, setMasFiltros] = useState(filtrosExtra > 0);

  const cambiar = (cambios: Record<string, string | number | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(cambios)) v ? p.set(k, String(v)) : p.delete(k);
        if (!('pagina' in cambios)) p.delete('pagina');
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    const t = setTimeout(() => texto !== (filtro.search ?? '') && cambiar({ q: texto.trim() }), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const comunidades = useComunidades();
  const configs = useConfigPA();
  const medicos = useUltimosMedicos();
  const consulta = usePacientes(filtro);
  const hayFiltros = [...params.keys()].some((k) => !['pagina', 'orden'].includes(k));

  return (
    <>
      <EncabezadoPagina
        titulo="Pacientes"
        descripcion={consulta.data ? `${consulta.data.meta.total.toLocaleString('es-DO')} pacientes${hayFiltros ? ' con estos filtros' : ''}.` : 'Registro de pacientes por batey.'}
        acciones={
          puedeEditar && (
            <Boton icono={<Plus className="size-4" />} onClick={() => navegar('/pacientes/nuevo')}>
              Nuevo paciente
            </Boton>
          )
        }
      />

      <Tarjeta>
        <div className="space-y-3 border-b border-borde p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
              <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, código, cédula o número de casa" className="pl-9" />
            </div>
            <Selector
              className="w-auto min-w-44"
              vacio="Todos los bateyes"
              value={filtro.communityId ?? ''}
              onChange={(e) => cambiar({ batey: e.target.value })}
              opciones={(comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <Selector className="w-auto" value={filtro.orden} onChange={(e) => cambiar({ orden: e.target.value === 'nombre' ? undefined : e.target.value })} opciones={ORDENES} aria-label="Ordenar" />
            <Boton variante="secundario" icono={<SlidersHorizontal className="size-4" />} onClick={() => setMasFiltros(!masFiltros)} aria-expanded={masFiltros}>
              Filtros{filtrosExtra > 0 && <Insignia className="ml-0.5 bg-marca-500 text-tinta">{filtrosExtra}</Insignia>}
            </Boton>
          </div>

          {masFiltros && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
              <Selector
                vacio="Toda clasificación"
                value={filtro.clasificacion ?? ''}
                onChange={(e) => cambiar({ clasificacion: e.target.value })}
                opciones={[
                  ...[...(configs.data ?? [])].sort((a, b) => a.priority - b.priority).map((c) => ({ value: c.id, label: CATEGORIAS[c.categoryName] })),
                  { value: 'ninguna', label: 'Sin toma válida' },
                ]}
                aria-label="Clasificación de la última toma"
              />
              <Selector
                vacio="Lo atendió (cualquiera)"
                value={filtro.medico ?? ''}
                onChange={(e) => cambiar({ medico: e.target.value })}
                opciones={(medicos.data ?? []).map((m) => ({ value: m.id, label: `${m.nombre} (${m.pacientes})` }))}
                aria-label="Último que lo atendió"
              />
              <Selector vacio="Cualquier asistencia" value={filtro.situacion ?? ''} onChange={(e) => cambiar({ situacion: e.target.value })} opciones={SITUACIONES_ASISTENCIA} aria-label="Asistencia" />
              <Selector vacio="Todos los géneros" value={filtro.gender ?? ''} onChange={(e) => cambiar({ genero: e.target.value })} opciones={opciones(GENEROS)} aria-label="Género" />
              <Selector vacio="Cualquier estado" value={filtro.status ?? ''} onChange={(e) => cambiar({ estado: e.target.value })} opciones={opciones(ESTADOS)} aria-label="Estado" />
              <div className="flex items-center gap-2 text-sm whitespace-nowrap text-tenue">
                Edad
                <Entrada type="number" min={0} max={120} placeholder="de" value={params.get('edadMin') ?? ''} onChange={(e) => cambiar({ edadMin: e.target.value })} />
                <Entrada type="number" min={0} max={120} placeholder="a" value={params.get('edadMax') ?? ''} onChange={(e) => cambiar({ edadMax: e.target.value })} />
              </div>
            </div>
          )}

          {hayFiltros && (
            <button
              onClick={() => {
                setTexto('');
                setParams(filtro.orden !== 'nombre' ? { orden: filtro.orden! } : {}, { replace: true });
              }}
              className="flex items-center gap-1 text-sm font-medium text-marca-700 hover:underline"
            >
              <X className="size-3.5" /> Quitar filtros
            </button>
          )}
        </div>

        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : consulta.data.data.length === 0 ? (
          <Vacio icono={<Users className="size-8" />} titulo={hayFiltros ? 'Ningún paciente coincide' : 'Todavía no hay pacientes'}>
            {hayFiltros && 'Prueba quitando algún filtro.'}
          </Vacio>
        ) : (
          <>
            <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
              <Tabla columnas={['Paciente', 'Código', 'Edad', 'Batey', { texto: 'Última PA', className: 'text-right' }, 'Clasificación', 'Última visita', 'Lo atendió']}>
                {consulta.data.data.map((p) => {
                  const a = p.status === 'ACTIVE' ? asistencia(p.lastVisitDate) : null;
                  return (
                    <tr key={p.id} onClick={() => navegar(`/pacientes/${p.id}`)} className="cursor-pointer hover:bg-fondo">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar persona={p} foto={p.photoUrl} tamano="size-8" />
                          <div className="min-w-0">
                            <p className="font-medium whitespace-nowrap">{nombreCompleto(p)}</p>
                            <p className="text-xs whitespace-nowrap text-tenue">
                              {GENEROS[p.gender]}
                              {p.address && ` · Casa ${p.address}`}
                              {p.status !== 'ACTIVE' && ` · ${ESTADOS[p.status]}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px]">{p.patientCode}</td>
                      <td className="tabular px-5 py-3 whitespace-nowrap">{edadTexto(p)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{p.community?.name}</td>
                      <td className="tabular px-5 py-3 text-right font-mono">{p.lastSystolic && p.lastDiastolic ? `${p.lastSystolic}/${p.lastDiastolic}` : '—'}</td>
                      <td className="px-5 py-3">{p.lastVisitDate ? <InsigniaCategoria config={p.lastBpClassification} /> : <span className="text-tenue">—</span>}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {fecha(p.lastVisitDate)}
                        {a && (a.clave === 'visto' || a.clave === 'sin-venir') && (
                          <span className="block text-xs" style={{ color: a.color }}>
                            {a.clave === 'sin-venir' ? 'No asiste desde entonces' : a.texto}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-tenue">{p.lastDoctorNombre ?? '—'}</td>
                    </tr>
                  );
                })}
              </Tabla>
            </div>
            <Paginacion pagina={filtro.page} ultima={consulta.data.meta.lastPage} total={consulta.data.meta.total} alCambiar={(p) => cambiar({ pagina: p })} />
          </>
        )}
      </Tarjeta>
    </>
  );
}
