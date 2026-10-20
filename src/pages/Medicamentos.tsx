import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarX, Download, PackagePlus, Pill, Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAlertasInventario, useConsumoMedicamentos, useMedicamento, useMedicamentos } from '../api/consultas';
import { crearMedicamento, editarMedicamento, type DatosMedicamento } from '../api/recursos';
import type { Medicamento } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Segmentos, Tabla, Tarjeta, Vacio } from '../components/ui';
import { descargarCsv } from '../lib/copiar';
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

/** Redondea hacia arriba a la decena: los pedidos se hacen en cantidades redondas. */
const redondear = (n: number) => Math.ceil(n / 10) * 10;

/**
 * Cuánto pedir de cada medicamento para cubrir los próximos meses: lo que se entrega por mes × los meses,
 * más el mínimo de reserva, menos lo que hay vigente (sin contar lo vencido).
 */
function PedidoSugerido({ medicamentos }: { medicamentos: Medicamento[] }) {
  const consumo = useConsumoMedicamentos();
  const [meses, setMeses] = useState<'3' | '6' | '12'>('6');
  const h = Number(meses);
  const filas = medicamentos
    .filter((m) => m.activo)
    .map((m) => {
      const porMes = consumo.data?.medicamentos.find((c) => c.medicationId === m.id)?.porMes ?? 0;
      const hay = m.vigente ?? m.currentStock;
      const pedir = Math.max(0, redondear(porMes * h + m.stockMinimo - hay));
      const alcanza = porMes > 0 ? hay / porMes : null;
      return { m, porMes, hay, pedir, alcanza };
    })
    .sort((a, b) => (a.alcanza ?? Infinity) - (b.alcanza ?? Infinity));
  const totalPedir = filas.reduce((a, f) => a + f.pedir, 0);

  const exportar = () =>
    descargarCsv(
      filas.map((f) => ({ medicamento: `${f.m.name} ${f.m.concentration}`, porMes: f.porMes, hay: f.hay, minimo: f.m.stockMinimo, alcanza: f.alcanza === null ? '' : f.alcanza.toFixed(1), pedir: f.pedir })),
      [
        { clave: 'medicamento', titulo: 'Medicamento' },
        { clave: 'porMes', titulo: 'Se entregan al mes' },
        { clave: 'hay', titulo: 'Existencia vigente' },
        { clave: 'minimo', titulo: 'Mínimo de reserva' },
        { clave: 'alcanza', titulo: 'Alcanza para (meses)' },
        { clave: 'pedir', titulo: `Pedir para ${h} meses` },
      ],
      `pedido-sugerido_${h}-meses`,
    );

  return (
    <Tarjeta
      className="mt-4"
      titulo={
        <span className="flex items-center gap-2">
          <ShoppingCart className="size-4" /> Pedido sugerido
        </span>
      }
      accion={
        <div className="flex items-center gap-2">
          <Segmentos
            etiqueta="Cubrir los próximos"
            valor={meses}
            alCambiar={setMeses}
            className="w-64"
            opciones={[
              { value: '3', label: '3 meses' },
              { value: '6', label: '6 meses' },
              { value: '12', label: '12 meses' },
            ]}
          />
          <button type="button" onClick={exportar} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-700 hover:bg-marca-50">
            <Download className="size-3.5" /> CSV
          </button>
        </div>
      }
    >
      {consumo.isPending ? (
        <Cargando forma="lista" texto="Calculando el consumo…" />
      ) : consumo.isError ? (
        <ErrorCarga error={consumo.error} />
      ) : (
        <>
          <Tabla
            columnas={[
              'Medicamento',
              { texto: 'Se entregan al mes', className: 'text-right' },
              { texto: 'Hay vigente', className: 'text-right' },
              { texto: 'Alcanza para', className: 'text-right' },
              { texto: `Pedir para ${h} meses`, className: 'text-right' },
            ]}
          >
            {filas.map((f) => {
              const corto = f.alcanza !== null && f.alcanza < h;
              return (
                <tr key={f.m.id}>
                  <td className="px-5 py-3">
                    <span className="font-medium">{f.m.name}</span> <span className="text-tenue">{f.m.concentration}</span>
                  </td>
                  <td className="tabular px-5 py-3 text-right">{f.porMes ? miles(f.porMes) : <span className="text-tenue">—</span>}</td>
                  <td className="tabular px-5 py-3 text-right">{miles(f.hay)}</td>
                  <td className={cn('tabular px-5 py-3 text-right whitespace-nowrap', corto && 'font-medium text-red-600')}>
                    {f.alcanza === null ? <span className="text-tenue">sin consumo</span> : f.alcanza >= 24 ? 'más de 2 años' : f.alcanza < 1 ? `${Math.round(f.alcanza * 30)} días` : `${f.alcanza.toFixed(1)} meses`}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-base font-semibold">{f.pedir ? miles(f.pedir) : <span className="text-sm font-normal text-tenue">No hace falta</span>}</td>
                </tr>
              );
            })}
          </Tabla>
          <p className="border-t border-borde px-5 py-3 text-xs text-tenue">
            Total a pedir: <strong className="text-tinta">{miles(totalPedir)} pastillas</strong>. Se calcula con lo entregado en los últimos {consumo.data.meses >= 12 ? '12 meses' : `${consumo.data.meses} meses`} (visitas y
            reposiciones): lo de cada mes × {h} meses, más el mínimo de reserva, menos lo que hay vigente. Redondeado a la decena.
          </p>
        </>
      )}
    </Tarjeta>
  );
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

      {puedeGestionar && consulta.data && consulta.data.length > 0 && <PedidoSugerido medicamentos={consulta.data} />}
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
