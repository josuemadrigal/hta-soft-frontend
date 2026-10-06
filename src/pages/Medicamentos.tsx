import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarX, PackagePlus, Pill, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAlertasInventario, useMedicamento, useMedicamentos } from '../api/consultas';
import { crearMedicamento, editarMedicamento, type DatosMedicamento } from '../api/recursos';
import type { Medicamento } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, diasHasta, fechaDia } from '../lib/formato';

const miles = (n: number) => n.toLocaleString('es-DO');

/** Estado del medicamento para la tabla. */
function estado(m: Medicamento): { texto: string; color?: string } {
  if (!m.activo) return { texto: 'Inactivo' };
  if ((m.vigente ?? m.currentStock) === 0) return { texto: 'Agotado', color: '#dc2626' };
  if ((m.vigente ?? m.currentStock) < m.stockMinimo) return { texto: 'Bajo el mínimo', color: '#dc2626' };
  if (m.proximoVencimiento && diasHasta(m.proximoVencimiento) <= 90) return { texto: 'Lote por vencer', color: '#b45309' };
  return { texto: 'En orden', color: '#15803d' };
}

export function Medicamentos() {
  const consulta = useMedicamentos();
  const alertas = useAlertasInventario();
  const navegar = useNavigate();
  const puedeGestionar = useSesion().tiene('inventario.gestionar');
  const a = alertas.data;

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario de medicamentos"
        descripcion="Existencias por lote. Al dispensar sale primero el lote que vence antes."
        acciones={
          puedeGestionar && (
            <>
              <Boton variante="secundario" icono={<Plus className="size-4" />} onClick={() => navegar('/medicamentos/nuevo')}>
                Nuevo medicamento
              </Boton>
              <Boton icono={<PackagePlus className="size-4" />} onClick={() => navegar('/medicamentos/entrada')}>
                Registrar entrada
              </Boton>
            </>
          )
        }
      />

      {a && (a.vencidos.length > 0 || a.porVencer.length > 0) && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {a.vencidos.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-red-700">
                <CalendarX className="size-4" /> {a.vencidos.length} {a.vencidos.length === 1 ? 'lote vencido' : 'lotes vencidos'} con existencia
              </p>
              <ul className="space-y-1 text-red-900">
                {a.vencidos.map((l) => (
                  <li key={l.id}>
                    <Link to={`/medicamentos/${l.medicationId}`} className="hover:underline">
                      {l.medication?.name} {l.medication?.concentration} · lote {l.numero ?? `#${l.id}`} · {miles(l.cantidadActual)} u. · venció el {fechaDia(l.vencimiento)}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-red-700">No se dispensan. Retíralos con un ajuste "Vencido".</p>
            </div>
          )}
          {a.porVencer.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-marca-50 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
                <AlertTriangle className="size-4" /> {a.porVencer.length} {a.porVencer.length === 1 ? 'lote vence' : 'lotes vencen'} en los próximos {a.diasAviso} días
              </p>
              <ul className="space-y-1">
                {a.porVencer.map((l) => (
                  <li key={l.id}>
                    <Link to={`/medicamentos/${l.medicationId}`} className="hover:underline">
                      {l.medication?.name} {l.medication?.concentration} · {miles(l.cantidadActual)} u. · vence el {fechaDia(l.vencimiento)} ({diasHasta(l.vencimiento!)} días)
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : consulta.data.length === 0 ? (
          <Vacio icono={<Pill className="size-8" />} titulo="Sin medicamentos">
            Agrega los medicamentos que se entregan a los pacientes.
          </Vacio>
        ) : (
          <Tabla
            columnas={[
              'Medicamento',
              { texto: 'Existencia vigente', className: 'text-right' },
              { texto: 'Mínimo', className: 'text-right' },
              'Próximo vencimiento',
              { texto: 'Lotes', className: 'text-right' },
              'Estado',
            ]}
          >
            {consulta.data.map((m) => {
              const e = estado(m);
              const bajo = (m.vigente ?? m.currentStock) < m.stockMinimo;
              return (
                <tr key={m.id} onClick={() => navegar(`/medicamentos/${m.id}`)} className={cn('cursor-pointer hover:bg-fondo', !m.activo && 'opacity-60')}>
                  <td className="px-5 py-3">
                    <span className="font-medium">{m.name}</span> <span className="text-tenue">{m.concentration}</span>
                  </td>
                  <td className={cn('tabular px-5 py-3 text-right font-medium', bajo && 'text-red-600')}>
                    {miles(m.vigente ?? m.currentStock)}
                    {!!m.vencido && <span className="block text-xs font-normal text-red-600">+{miles(m.vencido)} vencidas</span>}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-tenue">{miles(m.stockMinimo)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {m.proximoVencimiento ? (
                      <>
                        {fechaDia(m.proximoVencimiento)} <span className="text-xs text-tenue">({diasHasta(m.proximoVencimiento)} días)</span>
                      </>
                    ) : (
                      <span className="text-tenue">—</span>
                    )}
                  </td>
                  <td className="tabular px-5 py-3 text-right">{m.lotesActivos ?? 0}</td>
                  <td className="px-5 py-3">
                    <Insignia color={e.color}>{e.texto}</Insignia>
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Tarjeta>
    </>
  );
}

/** /medicamentos/nuevo y /medicamentos/:id/editar (datos; la existencia se mueve con entradas y ajustes) */
export function MedicamentoEditor() {
  const id = Number(useParams().id) || undefined;
  const consulta = useMedicamento(id);
  if (id && consulta.isPending) return <Cargando />;
  if (id && !consulta.data) return <Vacio titulo="Medicamento no encontrado" />;
  return <FormularioMedicamento medicamento={consulta.data ?? undefined} />;
}

function FormularioMedicamento({ medicamento }: { medicamento?: Medicamento }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { register, handleSubmit, formState } = useForm<DatosMedicamento>({
    defaultValues: medicamento
      ? { name: medicamento.name, concentration: medicamento.concentration, stockMinimo: medicamento.stockMinimo, activo: medicamento.activo }
      : { name: '', concentration: '', stockMinimo: 20, activo: true },
  });
  const guardar = useMutation({
    mutationFn: (d: DatosMedicamento) => {
      const datos = { ...d, name: d.name.trim(), concentration: d.concentration.trim(), stockMinimo: Number(d.stockMinimo) };
      return medicamento ? editarMedicamento(medicamento.id, datos) : crearMedicamento(datos);
    },
    onSuccess: (m) => {
      cliente.invalidateQueries({ queryKey: ['medicamentos'] });
      cliente.invalidateQueries({ queryKey: ['stats'] });
      toast.success(medicamento ? 'Medicamento actualizado' : 'Medicamento creado. Registra su primera entrada.');
      navegar(medicamento ? `/medicamentos/${m.id}` : `/medicamentos/entrada?med=${m.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const e = formState.errors;

  return (
    <>
      <EncabezadoPagina
        titulo={medicamento ? `${medicamento.name} ${medicamento.concentration}` : 'Nuevo medicamento'}
        volver={medicamento ? { a: `/medicamentos/${medicamento.id}`, texto: 'Inventario' } : { a: '/medicamentos', texto: 'Inventario' }}
      />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-2xl space-y-4">
        <Tarjeta titulo="Medicamento">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre" error={e.name && 'Requerido'} className="sm:col-span-2">
              <Entrada {...register('name', { required: true, validate: (v) => !!v.trim() })} placeholder="Amlodipina" aria-invalid={!!e.name} />
            </Campo>
            <Campo etiqueta="Concentración" error={e.concentration && 'Requerida'}>
              <Entrada {...register('concentration', { required: true, validate: (v) => !!v.trim() })} placeholder="5 mg" aria-invalid={!!e.concentration} />
            </Campo>
            <Campo etiqueta="Existencia mínima" ayuda="Por debajo se avisa en el panel y en inventario." error={e.stockMinimo && 'Debe ser 0 o más'}>
              <Entrada type="number" min={0} {...register('stockMinimo', { required: true, min: 0, valueAsNumber: true })} />
            </Campo>
            <Casilla etiqueta="Activo (se puede recetar)" className="sm:col-span-2" {...register('activo')} />
          </div>
          {!medicamento && <p className="border-t border-borde px-5 py-3 text-sm text-tenue">La existencia empieza en 0: después de crearlo registras su primera entrada (lote).</p>}
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar(-1)}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </>
  );
}
