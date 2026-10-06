import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePaciente } from '../api/consultas';
import { darDeBaja } from '../api/recursos';
import type { MotivoBaja } from '../api/tipos';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Tarjeta, Vacio } from '../components/ui';
import { MOTIVOS_BAJA } from '../lib/etiquetas';
import { cn, edadTexto, fecha, nombreCompleto } from '../lib/formato';

const AYUDA: Record<MotivoBaja, string> = {
  FALLECIDO: 'Causa, si se conoce (infarto, ACV, otra enfermedad, accidente…)',
  MUDANZA: 'A dónde se mudó, si se sabe',
  ABANDONO: 'Por qué dejó de venir, si lo dijo',
  TRASLADO: 'A qué programa, clínica u hospital',
  OTRO: 'Explica el motivo',
};

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** /pacientes/:id/baja — registra fallecimiento, mudanza, abandono… con fecha y motivo. */
export function BajaPaciente() {
  const id = Number(useParams().id);
  const consulta = usePaciente(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [motivo, setMotivo] = useState<MotivoBaja | ''>('');
  const [fechaBaja, setFechaBaja] = useState(hoyIso());
  const [detalle, setDetalle] = useState('');

  const guardar = useMutation({
    mutationFn: () => darDeBaja(id, { motivo: motivo as MotivoBaja, fecha: fechaBaja, detalle: detalle.trim() || undefined }),
    onSuccess: () => {
      for (const k of [['paciente'], ['pacientes'], ['jornada'], ['jornadas'], ['stats'], ['auditoria'], ['metas']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(motivo === 'FALLECIDO' ? 'Fallecimiento registrado.' : 'Baja registrada.');
      navegar(`/pacientes/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (consulta.isPending) return <Cargando />;
  const p = consulta.data;
  if (!p) return <Vacio titulo="Paciente no encontrado" />;
  if (p.status !== 'ACTIVE') return <Vacio titulo="Este paciente ya está dado de baja">Si volvió, usa "Reactivar" en su ficha.</Vacio>;
  const ultima = p.clinicalVisits?.[0];

  return (
    <>
      <EncabezadoPagina
        titulo="Dar de baja"
        descripcion={
          <>
            {nombreCompleto(p)} · <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · {p.community?.name}
            {ultima && ` · última visita el ${fecha(ultima.visitDate)}`}
          </>
        }
        volver={{ a: `/pacientes/${id}`, texto: nombreCompleto(p) }}
      />
      <div className="max-w-2xl space-y-4">
        <Tarjeta titulo="Motivo">
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {(Object.keys(MOTIVOS_BAJA) as MotivoBaja[]).map((m) => (
              <label
                key={m}
                className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo')}
              >
                <input type="radio" name="motivo" className="accent-tinta" checked={motivo === m} onChange={() => setMotivo(m)} />
                {MOTIVOS_BAJA[m]}
              </label>
            ))}
          </div>
        </Tarjeta>
        {motivo && (
          <Tarjeta titulo="Detalle">
            <div className="grid gap-4 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Campo etiqueta={motivo === 'FALLECIDO' ? 'Fecha del fallecimiento' : 'Fecha de la baja'} ayuda="Aproximada, si no se sabe el día">
                <Entrada type="date" max={hoyIso()} value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} />
              </Campo>
              <Campo etiqueta={motivo === 'FALLECIDO' ? 'Causa' : 'Detalle'} ayuda={AYUDA[motivo]}>
                <AreaTexto rows={3} maxLength={500} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </Campo>
            </div>
            <p className="border-t border-borde px-5 py-3 text-sm text-tenue">
              Sale de las listas de jornada y de los pendientes de la ronda, pero conserva todo su historial. Si vuelve, se puede reactivar. Queda en Auditoría.
            </p>
          </Tarjeta>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar(-1)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono={<UserX className="size-4" />} disabled={!motivo || !fechaBaja} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
            {motivo === 'FALLECIDO' ? 'Registrar fallecimiento' : 'Dar de baja'}
          </Boton>
        </div>
      </div>
    </>
  );
}
