import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackagePlus, Pencil, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMedicamento, useMedicamentos, useMovimientos } from '../api/consultas';
import { registrarAjuste, registrarEntrada, type DatosEntrada } from '../api/recursos';
import type { Lote, MovimientoInventario, OrigenLote } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Insignia, Paginacion, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, diasHasta, fechaDia, fechaYHora } from '../lib/formato';

const miles = (n: number) => n.toLocaleString('es-DO');
const ORIGENES: Record<OrigenLote, string> = { DONACION: 'Donación', COMPRA: 'Compra', INICIAL: 'Saldo inicial', AJUSTE: 'Ajuste' };
const TIPOS: Record<MovimientoInventario['tipo'], { texto: string; color: string }> = {
  ENTRADA: { texto: 'Entrada', color: '#15803d' },
  SALIDA_VISITA: { texto: 'Dispensado', color: '#1d1b18' },
  DEVOLUCION: { texto: 'Devolución', color: '#2563eb' },
  AJUSTE: { texto: 'Ajuste', color: '#a16207' },
  VENCIDO: { texto: 'Vencido', color: '#dc2626' },
};

function estadoLote(l: Lote) {
  if (l.cantidadActual === 0) return { texto: 'Agotado' };
  if (!l.vencimiento) return { texto: 'Sin vencimiento', color: '#6b665e' };
  const dias = diasHasta(l.vencimiento);
  if (dias < 0) return { texto: 'Vencido', color: '#dc2626' };
  if (dias <= 90) return { texto: `Vence en ${dias} días`, color: '#b45309' };
  return { texto: 'Vigente', color: '#15803d' };
}

/** /medicamentos/:id — lotes y kárdex */
export function MedicamentoDetalle() {
  const id = Number(useParams().id);
  const consulta = useMedicamento(id);
  const [pagina, setPagina] = useState(1);
  const movimientos = useMovimientos(id, pagina);
  const navegar = useNavigate();
  const puedeGestionar = useSesion().tiene('inventario.gestionar');
  const [verAgotados, setVerAgotados] = useState(false);

  if (consulta.isPending) return <Cargando />;
  if (!consulta.data) return <Vacio titulo="Medicamento no encontrado" />;
  const m = consulta.data;
  const hoy = new Date(new Date().toDateString());
  const vigente = m.lotes.filter((l) => l.cantidadActual > 0 && (!l.vencimiento || new Date(l.vencimiento) >= hoy)).reduce((a, l) => a + l.cantidadActual, 0);
  const lotes = m.lotes.filter((l) => verAgotados || l.cantidadActual > 0);

  return (
    <>
      <EncabezadoPagina
        titulo={`${m.name} ${m.concentration}`}
        volver={{ a: '/medicamentos', texto: 'Inventario' }}
        descripcion={!m.activo ? 'Inactivo: no se puede recetar.' : undefined}
        acciones={
          puedeGestionar && (
            <>
              <Boton variante="secundario" icono={<Pencil className="size-4" />} onClick={() => navegar(`/medicamentos/${id}/editar`)}>
                Editar
              </Boton>
              <Boton icono={<PackagePlus className="size-4" />} onClick={() => navegar(`/medicamentos/entrada?med=${id}`)}>
                Registrar entrada
              </Boton>
            </>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Existencia vigente', miles(vigente), vigente < m.stockMinimo ? 'text-red-600' : ''],
          ['Total en bodega', miles(m.currentStock), ''],
          ['Mínimo', miles(m.stockMinimo), 'text-tenue'],
          ['Lotes con existencia', miles(m.lotes.filter((l) => l.cantidadActual > 0).length), ''],
        ].map(([t, v, c]) => (
          <div key={t} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="text-xs text-tenue">{t}</p>
            <p className={cn('tabular mt-1 text-2xl font-semibold', c)}>{v}</p>
          </div>
        ))}
      </div>

      <Tarjeta
        titulo="Lotes"
        className="mb-4"
        accion={
          <label className="flex items-center gap-2 text-xs text-tenue">
            <input type="checkbox" checked={verAgotados} onChange={(e) => setVerAgotados(e.target.checked)} className="accent-tinta" /> Ver agotados
          </label>
        }
      >
        {lotes.length === 0 ? (
          <Vacio titulo="Sin lotes con existencia">Registra una entrada para cargar existencia.</Vacio>
        ) : (
          <Tabla columnas={['Lote', 'Origen', 'Entrada', 'Vence', { texto: 'Inicial', className: 'text-right' }, { texto: 'Queda', className: 'text-right' }, 'Estado', { texto: '', className: 'w-24' }]}>
            {lotes.map((l) => {
              const e = estadoLote(l);
              return (
                <tr key={l.id} className={cn(l.cantidadActual === 0 && 'opacity-50')}>
                  <td className="px-5 py-3 font-mono text-[13px] whitespace-nowrap">{l.numero ?? `#${l.id}`}</td>
                  <td className="px-5 py-3">
                    {ORIGENES[l.origen]}
                    {l.procedencia && <span className="block text-xs text-tenue">{l.procedencia}</span>}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">{fechaDia(l.fechaEntrada)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{fechaDia(l.vencimiento)}</td>
                  <td className="tabular px-5 py-3 text-right text-tenue">{miles(l.cantidadInicial)}</td>
                  <td className="tabular px-5 py-3 text-right font-medium">{miles(l.cantidadActual)}</td>
                  <td className="px-5 py-3">
                    <Insignia color={e.color}>{e.texto}</Insignia>
                  </td>
                  <td className="px-5 py-2 text-right">
                    {puedeGestionar && l.cantidadActual > 0 && (
                      <Boton variante="fantasma" className="h-8 px-2 text-xs" icono={<SlidersHorizontal className="size-3.5" />} onClick={() => navegar(`/medicamentos/${id}/ajuste?lote=${l.id}`)}>
                        Ajustar
                      </Boton>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Tarjeta>

      <Tarjeta titulo="Kárdex (movimientos)">
        {movimientos.isPending ? (
          <Cargando />
        ) : !movimientos.data?.data.length ? (
          <Vacio titulo="Sin movimientos" />
        ) : (
          <>
            <Tabla columnas={['Fecha', 'Movimiento', 'Lote', { texto: 'Cantidad', className: 'text-right' }, { texto: 'Saldo', className: 'text-right' }, 'Detalle', 'Usuario']}>
              {movimientos.data.data.map((mv) => (
                <tr key={mv.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap">{fechaYHora(mv.createdAt)}</td>
                  <td className="px-5 py-2.5">
                    <Insignia color={TIPOS[mv.tipo].color}>{TIPOS[mv.tipo].texto}</Insignia>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs whitespace-nowrap">{mv.lote?.numero ?? '—'}</td>
                  <td className={cn('tabular px-5 py-2.5 text-right font-medium', mv.cantidad > 0 ? 'text-green-700' : 'text-red-600')}>
                    {mv.cantidad > 0 ? '+' : ''}
                    {miles(mv.cantidad)}
                  </td>
                  <td className="tabular px-5 py-2.5 text-right">{miles(mv.saldo)}</td>
                  <td className="px-5 py-2.5 text-xs text-tenue">{mv.motivo ?? (mv.visitId ? `Visita #${mv.visitId}` : '—')}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-tenue">{mv.userName ?? '—'}</td>
                </tr>
              ))}
            </Tabla>
            <Paginacion pagina={pagina} ultima={movimientos.data.meta.lastPage} total={movimientos.data.meta.total} alCambiar={setPagina} />
          </>
        )}
      </Tarjeta>
    </>
  );
}

type FormEntrada = Omit<DatosEntrada, 'cantidad'> & { cantidad?: number; medicationId: string };

/** /medicamentos/entrada?med=ID — entrada de un lote */
export function EntradaInventario() {
  const [params] = useSearchParams();
  const medicamentos = useMedicamentos();
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, formState, watch, reset } = useForm<FormEntrada>({
    defaultValues: { medicationId: params.get('med') ?? '', origen: 'DONACION', fechaEntrada: hoy, numero: '', vencimiento: '', procedencia: '', nota: '' },
  });
  const origen = watch('origen');
  const guardar = useMutation({
    mutationFn: ({ medicationId, ...d }: FormEntrada) =>
      registrarEntrada(Number(medicationId), {
        ...d,
        cantidad: Number(d.cantidad),
        numero: d.numero?.trim() || undefined,
        vencimiento: d.vencimiento || undefined,
        procedencia: d.procedencia?.trim() || undefined,
        nota: d.nota?.trim() || undefined,
      }),
    onSuccess: (l, d) => {
      cliente.invalidateQueries({ queryKey: ['medicamentos'] });
      cliente.invalidateQueries({ queryKey: ['stats'] });
      cliente.invalidateQueries({ queryKey: ['jornadas'] });
      toast.success(`Entrada registrada: ${miles(l.cantidadInicial)} unidades.`, {
        action: { label: 'Ver medicamento', onClick: () => navegar(`/medicamentos/${d.medicationId}`) },
      });
      // Se queda en la pantalla para cargar la siguiente (una donación suele traer varios).
      reset({ ...d, cantidad: '' as unknown as number, numero: '', vencimiento: '', nota: '' });
    },
    onError: (e) => toast.error(e.message),
  });
  const e = formState.errors;
  if (!medicamentos.data) return <Cargando />;

  return (
    <>
      <EncabezadoPagina titulo="Registrar entrada" descripcion="Cada entrada es un lote con su vencimiento. Después de guardar puedes cargar la siguiente." volver={{ a: '/medicamentos', texto: 'Inventario' }} />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-3xl space-y-4" noValidate>
        <Tarjeta titulo="Lote">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Medicamento" error={e.medicationId && 'Elige uno'} className="sm:col-span-2">
              <Selector
                vacio="Elegir…"
                {...register('medicationId', { required: true })}
                opciones={medicamentos.data.filter((m) => m.activo).map((m) => ({ value: m.id, label: `${m.name} ${m.concentration} (hay ${miles(m.vigente ?? m.currentStock)})` }))}
                aria-invalid={!!e.medicationId}
              />
            </Campo>
            <Campo etiqueta="Cantidad (unidades)" error={e.cantidad && 'Mayor que 0'}>
              <Entrada type="number" min={1} {...register('cantidad', { required: true, min: 1, valueAsNumber: true })} aria-invalid={!!e.cantidad} />
            </Campo>
            <Campo etiqueta="Vencimiento" ayuda="Si no se conoce, déjalo vacío (se dispensará al final).">
              <Entrada type="date" min={hoy} {...register('vencimiento')} />
            </Campo>
            <Campo etiqueta="Número de lote" ayuda="Opcional">
              <Entrada {...register('numero')} />
            </Campo>
            <Campo etiqueta="Fecha de entrada">
              <Entrada type="date" max={hoy} {...register('fechaEntrada')} />
            </Campo>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Procedencia">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Origen">
              <Selector opciones={[{ value: 'DONACION', label: 'Donación' }, { value: 'COMPRA', label: 'Compra' }]} {...register('origen')} />
            </Campo>
            <Campo etiqueta={origen === 'COMPRA' ? 'Proveedor' : 'Donante'} ayuda="Opcional">
              <Entrada {...register('procedencia')} />
            </Campo>
            <Campo etiqueta="Nota" className="sm:col-span-2">
              <AreaTexto rows={2} {...register('nota')} />
            </Campo>
          </div>
        </Tarjeta>
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending} icono={<PackagePlus className="size-4" />}>
            Registrar entrada
          </Boton>
        </div>
      </form>
    </>
  );
}

const MOTIVOS = ['Conteo físico', 'Dañado', 'Perdido', 'Corrección de una entrada', 'Otro'];

/** /medicamentos/:id/ajuste?lote=ID */
export function AjusteInventario() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  const consulta = useMedicamento(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { register, handleSubmit, watch, formState } = useForm<{ loteId: string; tipo: 'AJUSTE' | 'VENCIDO'; sentido: 'resta' | 'suma'; cantidad?: number; motivo: string; detalle: string }>({
    defaultValues: { loteId: params.get('lote') ?? '', tipo: 'AJUSTE', sentido: 'resta', motivo: 'Conteo físico', detalle: '' },
  });
  const [loteId, tipo, sentido, cantidad] = watch(['loteId', 'tipo', 'sentido', 'cantidad']);
  const guardar = useMutation({
    mutationFn: (d: { loteId: string; tipo: 'AJUSTE' | 'VENCIDO'; sentido: 'resta' | 'suma'; cantidad?: number; motivo: string; detalle: string }) =>
      registrarAjuste(id, {
        loteId: Number(d.loteId),
        tipo: d.tipo,
        cantidad: (d.tipo === 'VENCIDO' || d.sentido === 'resta' ? -1 : 1) * Number(d.cantidad),
        motivo: d.tipo === 'VENCIDO' ? `Retiro por vencimiento${d.detalle ? `: ${d.detalle}` : ''}` : `${d.motivo}${d.detalle ? `: ${d.detalle}` : ''}`,
      }),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['medicamentos'] });
      cliente.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Ajuste registrado en el kárdex');
      navegar(`/medicamentos/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  if (consulta.isPending) return <Cargando />;
  if (!consulta.data) return <Vacio titulo="Medicamento no encontrado" />;
  const m = consulta.data;
  const lote = m.lotes.find((l) => l.id === Number(loteId));
  const resta = tipo === 'VENCIDO' || sentido === 'resta';
  const queda = lote && cantidad ? lote.cantidadActual + (resta ? -cantidad : cantidad) : null;

  return (
    <>
      <EncabezadoPagina titulo={`Ajustar ${m.name} ${m.concentration}`} descripcion="Corrige la existencia de un lote. Queda en el kárdex con el motivo y quién lo hizo." volver={{ a: `/medicamentos/${id}`, texto: `${m.name} ${m.concentration}` }} />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-2xl space-y-4">
        <Tarjeta titulo="Ajuste">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Lote" className="sm:col-span-2" error={formState.errors.loteId && 'Elige un lote'}>
              <Selector
                vacio="Elegir…"
                {...register('loteId', { required: true })}
                opciones={m.lotes.filter((l) => l.cantidadActual > 0).map((l) => ({ value: l.id, label: `${l.numero ?? `#${l.id}`} · ${miles(l.cantidadActual)} u. · vence ${fechaDia(l.vencimiento)}` }))}
              />
            </Campo>
            <Campo etiqueta="Tipo">
              <Selector opciones={[{ value: 'AJUSTE', label: 'Ajuste' }, { value: 'VENCIDO', label: 'Retiro por vencimiento' }]} {...register('tipo')} />
            </Campo>
            {tipo === 'AJUSTE' && (
              <Campo etiqueta="Sentido">
                <Selector opciones={[{ value: 'resta', label: 'Restar (faltante, daño…)' }, { value: 'suma', label: 'Sumar (sobrante)' }]} {...register('sentido')} />
              </Campo>
            )}
            <Campo etiqueta="Cantidad" error={formState.errors.cantidad && 'Mayor que 0'} ayuda={queda !== null ? `Al lote le quedarán ${miles(queda)}` : undefined}>
              <Entrada type="number" min={1} {...register('cantidad', { required: true, min: 1, valueAsNumber: true })} />
            </Campo>
            {tipo === 'AJUSTE' && (
              <Campo etiqueta="Motivo">
                <Selector opciones={MOTIVOS.map((x) => ({ value: x, label: x }))} {...register('motivo')} />
              </Campo>
            )}
            <Campo etiqueta="Detalle" className="sm:col-span-2" ayuda="Opcional">
              <Entrada {...register('detalle')} />
            </Campo>
          </div>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar(`/medicamentos/${id}`)}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending} disabled={queda !== null && queda < 0}>
            Registrar ajuste
          </Boton>
        </div>
      </form>
    </>
  );
}
