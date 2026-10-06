import { ClipboardList, Download, Home, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useEliminarVisita } from '../components/eliminarVisita';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useComunidades, useConfigPA, useQuienesAtienden, useVisitas } from '../api/consultas';
import { listarVisitas, type FiltroVisitas } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, InsigniaCategoria, Paginacion, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
import { CATEGORIAS, opciones, TIPOS_VISITA } from '../lib/etiquetas';
import { atendio, cn, decimal, fechaYHora, nombreCompleto, tensionDe } from '../lib/formato';
import { Periodo } from '../components/Periodo';

const num = (v: string | null) => (v ? Number(v) : undefined);

export function Visitas() {
  const navegar = useNavigate();
  // Filtros en la URL: se pueden compartir y "atrás" desde la ficha vuelve al mismo listado.
  const [params, setParams] = useSearchParams();
  const filtro: FiltroVisitas = {
    page: Number(params.get('pagina')) || 1,
    search: params.get('q') ?? undefined,
    communityId: num(params.get('batey')),
    from: params.get('desde') ?? undefined,
    // Hasta el final del día elegido.
    to: params.get('hasta') ? `${params.get('hasta')}T23:59:59` : undefined,
    doctorId: num(params.get('atendio')),
    bpClassificationId: num(params.get('categoria')),
    visitType: params.get('tipo') ?? undefined,
  };
  const [texto, setTexto] = useState(filtro.search ?? '');
  const [exportando, setExportando] = useState(false);

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

  const consulta = useVisitas(filtro);
  const permisos = usePermisosVisita();
  const eliminar = useEliminarVisita();
  const comunidades = useComunidades();
  const configs = useConfigPA();
  const atienden = useQuienesAtienden();
  const hayFiltros = [...params.keys()].some((k) => k !== 'pagina');
  // Cuántos filtros del panel están puestos (el buscador va aparte).
  const activos = ['batey', 'categoria', 'atendio', 'tipo'].filter((k) => params.get(k)).length + (params.get('desde') || params.get('hasta') ? 1 : 0);
  const [masFiltros, setMasFiltros] = useState(activos > 0);

  // Exporta todas las páginas con los filtros actuales.
  const exportar = async () => {
    setExportando(true);
    try {
      const filas = [];
      for (let page = 1; ; page++) {
        const r = await listarVisitas({ ...filtro, page, limit: 200 });
        filas.push(...r.data);
        if (page >= r.meta.lastPage) break;
      }
      descargarCsv(
        filas.map((v) => ({
          fecha: fechaYHora(v.visitDate),
          codigo: v.patient?.patientCode,
          paciente: v.patient && nombreCompleto(v.patient),
          batey: v.patient?.community?.name,
          tipo: TIPOS_VISITA[v.visitType],
          pa: tensionDe(v),
          clasificacion: v.bpClassification && CATEGORIAS[v.bpClassification.categoryName],
          imc: decimal(v.bmi),
          medicamentos: v.prescriptions?.map((p) => `${p.medication?.name} ${p.medication?.concentration} (${p.quantityDispensed})`).join('; '),
          atendio: atendio(v),
          comentario: v.notes,
        })),
        [
          { clave: 'fecha', titulo: 'Fecha' },
          { clave: 'codigo', titulo: 'Código' },
          { clave: 'paciente', titulo: 'Paciente' },
          { clave: 'batey', titulo: 'Batey' },
          { clave: 'tipo', titulo: 'Tipo' },
          { clave: 'pa', titulo: 'PA' },
          { clave: 'clasificacion', titulo: 'Clasificación' },
          { clave: 'imc', titulo: 'IMC' },
          { clave: 'medicamentos', titulo: 'Medicamentos (entregadas)' },
          { clave: 'atendio', titulo: 'Atendió' },
          { clave: 'comentario', titulo: 'Comentario' },
        ],
        'visitas',
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Visitas"
        descripcion="Todas las visitas clínicas, de la más reciente a la más antigua."
        acciones={
          <Boton variante="secundario" icono={<Download className="size-4" />} cargando={exportando} onClick={exportar} disabled={!consulta.data?.meta.total}>
            Exportar CSV
          </Boton>
        }
      />
      <Tarjeta>
        <div className="space-y-3 border-b border-borde p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
              <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Paciente o código" className="pl-9" />
            </div>
            <Boton variante="secundario" icono={<SlidersHorizontal className="size-4" />} onClick={() => setMasFiltros(!masFiltros)} aria-expanded={masFiltros}>
              Filtros{activos > 0 && <Insignia className="ml-0.5 bg-marca-500 text-tinta">{activos}</Insignia>}
            </Boton>
          </div>

          {masFiltros && (
            <div className="space-y-3 rounded-xl bg-fondo p-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
                <Campo etiqueta="Batey">
                  <Selector vacio="Todos" value={filtro.communityId ?? ''} onChange={(e) => cambiar({ batey: e.target.value })} opciones={(comunidades.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                </Campo>
                <Campo etiqueta="Clasificación">
                  <Selector
                    vacio="Toda clasificación"
                    value={filtro.bpClassificationId ?? ''}
                    onChange={(e) => cambiar({ categoria: e.target.value })}
                    opciones={[...(configs.data ?? [])].sort((a, b) => a.priority - b.priority).map((c) => ({ value: c.id, label: CATEGORIAS[c.categoryName] }))}
                  />
                </Campo>
                <Campo etiqueta="Atendió">
                  <Selector vacio="Cualquiera" value={filtro.doctorId ?? ''} onChange={(e) => cambiar({ atendio: e.target.value })} opciones={(atienden.data ?? []).map((u) => ({ value: u.id, label: nombreCompleto(u) }))} />
                </Campo>
                <Campo etiqueta="Tipo de visita">
                  <Selector vacio="Todo tipo" value={filtro.visitType ?? ''} onChange={(e) => cambiar({ tipo: e.target.value })} opciones={opciones(TIPOS_VISITA)} />
                </Campo>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-tinta/80">Periodo</p>
                <Periodo desde={params.get('desde')} hasta={params.get('hasta')} onCambiar={(r) => cambiar({ desde: r.desde, hasta: r.hasta })} />
              </div>
            </div>
          )}

          {hayFiltros && (
            <button
              onClick={() => {
                setTexto('');
                setParams({}, { replace: true });
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
          <Vacio icono={<ClipboardList className="size-8" />} titulo={hayFiltros ? 'Ninguna visita coincide' : 'Sin visitas registradas'}>
            {hayFiltros ? 'Prueba quitando algún filtro.' : 'Las visitas se registran desde la ficha de cada paciente o desde la jornada.'}
          </Vacio>
        ) : (
          <>
            <div className={cn('transition-opacity', consulta.isPlaceholderData && 'opacity-60')}>
              <Tabla columnas={['Fecha', 'Paciente', 'Batey', 'Tipo', 'PA', 'Clasificación', 'IMC', 'Atendió', { texto: '', className: 'w-20' }]}>
                {consulta.data.data.map((v) => (
                  <tr key={v.id} onClick={() => navegar(`/pacientes/${v.patientId}`)} className="cursor-pointer hover:bg-fondo">
                    <td className="px-5 py-3 whitespace-nowrap">{fechaYHora(v.visitDate)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium whitespace-nowrap">{v.patient && nombreCompleto(v.patient)}</p>
                      <p className="font-mono text-xs text-tenue">{v.patient?.patientCode}</p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{v.patient?.community?.name}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {TIPOS_VISITA[v.visitType]}
                        {v.isHomeVisit && (
                          <Insignia>
                            <Home className="size-3" />
                          </Insignia>
                        )}
                      </span>
                    </td>
                    <td className="tabular px-5 py-3 font-mono">{tensionDe(v)}</td>
                    <td className="px-5 py-3">
                      <InsigniaCategoria config={v.bpClassification} />
                    </td>
                    <td className="tabular px-5 py-3">{decimal(v.bmi)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-tenue">
                      {atendio(v)}
                      {v.originalDoctorId && <span className="block text-[11px]">cuenta eliminada</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {permisos.puedeEditar(v) && (
                        <Boton variante="fantasma" className="h-8 px-2" aria-label="Editar visita" title="Editar visita" onClick={() => navegar(`/visitas/${v.id}/editar?volver=${encodeURIComponent(`/visitas?${params.toString()}`)}`)}>
                          <Pencil className="size-4" />
                        </Boton>
                      )}
                      {permisos.puedeEliminar && (
                        <Boton variante="fantasma" className="h-8 px-2 hover:text-red-600" aria-label="Eliminar visita" title="Eliminar visita" onClick={() => eliminar(v)}>
                          <Trash2 className="size-4" />
                        </Boton>
                      )}
                    </td>
                  </tr>
                ))}
              </Tabla>
            </div>
            <Paginacion pagina={filtro.page} ultima={consulta.data.meta.lastPage} total={consulta.data.meta.total} alCambiar={(p) => cambiar({ pagina: p })} />
          </>
        )}
      </Tarjeta>
    </>
  );
}
