import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { useResponsables } from '../api/consultas';
import { editarEntrega, obtenerEntrega } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Selector, Tarjeta, Vacio } from '../components/ui';
import { fecha, nombreCompleto } from '../lib/formato';
import { useVolver } from '../lib/navegacion';

const OTRA = 'otra';

/** /entregas/:id/editar — corregir quién entregó (queda en Auditoría con lo que había antes). */
export function EditarEntrega() {
  const id = Number(useParams().id);
  const consulta = useQuery({ queryKey: ['entregas', 'entrega', id], queryFn: () => obtenerEntrega(id) });
  const usuarios = useResponsables();
  const volverA = useVolver();
  const cliente = useQueryClient();
  // Un usuario de la app, u "otra persona" escrita a mano (alguien sin cuenta).
  const [elegido, setElegido] = useState<string | null>(null);
  const [otroNombre, setOtroNombre] = useState<string | null>(null);

  const e = consulta.data;
  const inicial = e ? (e.entregadoPorId ? String(e.entregadoPorId) : e.entregadoPorNombre ? OTRA : '') : '';
  const quien = elegido ?? inicial;
  const nombreOtro = otroNombre ?? (e && !e.entregadoPorId ? (e.entregadoPorNombre ?? '') : '');
  const listo = quien === OTRA ? nombreOtro.trim().length > 1 : !!quien;

  const guardar = useMutation({
    mutationFn: () => editarEntrega(id, quien === OTRA ? { entregadoPorNombre: nombreOtro.trim() } : { entregadoPorId: Number(quien) }),
    onSuccess: () => {
      for (const k of [['entregas'], ['paciente', e!.patientId], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success('Entrega corregida. El cambio quedó en Auditoría.');
      volverA(`/pacientes/${e!.patientId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (consulta.isPending) return <Cargando />;
  if (consulta.isError) return <ErrorCarga error={consulta.error} />;
  if (!e) return <Vacio titulo="Entrega no encontrada" />;
  const nombre = `${e.patient.firstName} ${e.patient.lastName}`.trim();

  return (
    <>
      <EncabezadoPagina
        titulo="Editar entrega"
        descripcion={`${nombre} · ${e.patient.patientCode} · ${e.tipo === 'REPOSICION' ? 'reposición' : 'entrega'} del ${fecha(e.fecha)}`}
        volver={{ a: `/pacientes/${e.patientId}`, texto: nombre }}
      />
      <div className="max-w-xl space-y-4">
        <Tarjeta titulo="Quién entregó">
          <div className="space-y-4 p-5">
            <p className="text-sm text-tenue">
              Ahora dice: <strong className="text-tinta">{e.entregadoPorNombre ?? 'sin registrar'}</strong>.
            </p>
            <Campo etiqueta="Entregó">
              <Selector
                vacio="Elige quién entregó"
                value={quien}
                onChange={(ev) => setElegido(ev.target.value)}
                opciones={[...(usuarios.data ?? []).map((u) => ({ value: u.id, label: nombreCompleto(u) })), { value: OTRA, label: 'Otra persona (sin cuenta en la app)' }]}
              />
            </Campo>
            {quien === OTRA && (
              <Campo etiqueta="Nombre de quien entregó">
                <Entrada value={nombreOtro} maxLength={120} onChange={(ev) => setOtroNombre(ev.target.value)} placeholder="Nombre y apellido" />
              </Campo>
            )}
          </div>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => volverA(`/pacientes/${e.patientId}`)}>
            Cancelar
          </Boton>
          <Boton icono={<Save className="size-4" />} disabled={!listo} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Boton>
        </div>
      </div>
    </>
  );
}
