import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { devolverEntrega, obtenerEntrega } from '../api/recursos';
import type { DestinoDevolucion, MotivoDevolucion } from '../api/tipos';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Tarjeta, Vacio } from '../components/ui';
import { DESTINOS_DEVOLUCION, MOTIVOS_DEVOLUCION } from '../lib/etiquetas';
import { cn, fecha } from '../lib/formato';
import { useEnLinea } from '../offline/datos';
import { useVolver } from '../lib/navegacion';

/** /entregas/:id/devolver — corregir una entrega o registrar lo que el paciente devolvió. */
export function DevolverEntrega() {
  const id = Number(useParams().id);
  const consulta = useQuery({ queryKey: ['entregas', 'entrega', id], queryFn: () => obtenerEntrega(id) });
  const navegar = useNavigate();
  const volverA = useVolver();
  const cliente = useQueryClient();
  const enLinea = useEnLinea();
  const [motivo, setMotivo] = useState<MotivoDevolucion | ''>('');
  const [destino, setDestino] = useState<DestinoDevolucion>('INVENTARIO');
  const [cantidades, setCantidades] = useState<Record<number, number | ''>>({});
  const [nota, setNota] = useState('');

  const e = consulta.data;
  const guardar = useMutation({
    mutationFn: () =>
      devolverEntrega(id, {
        motivo: motivo as MotivoDevolucion,
        // Una corrección siempre vuelve al inventario: las pastillas nunca salieron.
        destino: motivo === 'CORRECCION' ? 'INVENTARIO' : destino,
        nota: nota.trim() || undefined,
        items: Object.entries(cantidades)
          .filter(([, c]) => Number(c) > 0)
          .map(([itemId, c]) => ({ entregaItemId: Number(itemId), cantidad: Number(c) })),
      }),
    onSuccess: () => {
      for (const k of [['entregas'], ['paciente', e!.patientId], ['medicamentos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(motivo === 'CORRECCION' ? 'Entrega corregida. Lo que faltaba quedó pendiente otra vez.' : destino === 'DESCARTE' ? 'Devolución registrada: las pastillas se descartaron.' : 'Devolución registrada: las pastillas volvieron al inventario.');
      volverA(`/pacientes/${e!.patientId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  if (!e) return <Vacio titulo="Entrega no encontrada" />;
  const devolvibles = e.items.filter((i) => (i.devolvible ?? 0) > 0);
  const nombre = `${e.patient.firstName} ${e.patient.lastName}`.trim();
  const total = Object.values(cantidades).reduce<number>((a, c) => a + (Number(c) || 0), 0);
  const excede = e.items.some((i) => Number(cantidades[i.id] ?? 0) > (i.devolvible ?? 0));

  return (
    <>
      <EncabezadoPagina
        titulo="Devolver o corregir una entrega"
        descripcion={`${nombre} · ${e.patient.patientCode} · ${e.tipo === 'REPOSICION' ? 'reposición' : 'entrega'} del ${fecha(e.fecha)}${e.entregadoPorNombre ? ` · entregó ${e.entregadoPorNombre}` : ''}`}
        volver={{ a: `/pacientes/${e.patientId}`, texto: nombre }}
      />
      {devolvibles.length === 0 ? (
        <Vacio titulo="No queda nada por devolver">Todo lo de esta entrega ya se devolvió o se corrigió.</Vacio>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Tarjeta titulo="¿Qué pasó?">
            <div className="grid gap-2 p-5">
              {(Object.keys(MOTIVOS_DEVOLUCION) as MotivoDevolucion[]).map((m) => (
                <label key={m} className={cn('flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo')}>
                  <input type="radio" name="motivo" className="mt-0.5 accent-tinta" checked={motivo === m} onChange={() => setMotivo(m)} />
                  <span>
                    <span className="font-medium">{MOTIVOS_DEVOLUCION[m].texto}</span>
                    <span className="block text-tenue">{MOTIVOS_DEVOLUCION[m].ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Medicamentos">
            <ul className="divide-y divide-borde">
              {e.items.map((i) => {
                const yaDevueltas = (i.devoluciones ?? []).reduce((a, d) => a + d.cantidad, 0);
                const valor = cantidades[i.id] ?? '';
                return (
                  <li key={i.id} className="flex flex-wrap items-end gap-x-4 gap-y-2 px-5 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-medium">
                        {i.medication?.name} {i.medication?.concentration}
                      </p>
                      <p className="text-xs text-tenue">
                        Entregadas {i.cantidad}
                        {yaDevueltas > 0 && ` · ya devueltas o corregidas ${yaDevueltas}`} · se pueden devolver {i.devolvible}
                      </p>
                    </div>
                    <Campo etiqueta="Cantidad" error={Number(valor) > (i.devolvible ?? 0) ? `Máximo ${i.devolvible}` : undefined} className="w-32">
                      <Entrada
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={i.devolvible}
                        placeholder="0"
                        disabled={!i.devolvible}
                        className="h-10 text-right xl:h-9"
                        value={valor}
                        onChange={(ev) => setCantidades((c) => ({ ...c, [i.id]: ev.target.value === '' ? '' : Math.max(0, Math.floor(Number(ev.target.value))) }))}
                      />
                    </Campo>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>

          {motivo === 'PACIENTE_DEVOLVIO' && (
            <Tarjeta titulo="¿Qué se hace con las pastillas?">
              <div className="grid gap-2 p-5 sm:grid-cols-2">
                {(Object.keys(DESTINOS_DEVOLUCION) as DestinoDevolucion[]).map((d) => (
                  <label key={d} className={cn('flex cursor-pointer gap-3 rounded-lg border px-4 py-3 text-sm', destino === d ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo')}>
                    <input type="radio" name="destino" className="mt-0.5 accent-tinta" checked={destino === d} onChange={() => setDestino(d)} />
                    <span>
                      <span className="font-medium">{DESTINOS_DEVOLUCION[d].texto}</span>
                      <span className="block text-tenue">{DESTINOS_DEVOLUCION[d].ayuda}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Tarjeta>
          )}

          <Tarjeta titulo="Nota">
            <div className="p-5">
              <AreaTexto rows={2} maxLength={500} placeholder="Opcional: qué pasó, quién las trajo…" value={nota} onChange={(ev) => setNota(ev.target.value)} />
            </div>
            <p className="border-t border-borde px-5 py-3 text-sm text-tenue">La entrega original no se borra: la devolución queda aparte, en el kárdex del medicamento y en Auditoría.</p>
          </Tarjeta>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!enLinea && <span className="text-sm text-amber-700">Necesita conexión: cambia el inventario.</span>}
            <Boton variante="secundario" onClick={() => navegar(-1)}>
              Cancelar
            </Boton>
            <Boton icono={<Undo2 className="size-4" />} disabled={!motivo || total === 0 || excede || !enLinea} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
              {motivo === 'CORRECCION' ? 'Corregir la entrega' : 'Registrar devolución'}
            </Boton>
          </div>
        </div>
      )}
    </>
  );
}
