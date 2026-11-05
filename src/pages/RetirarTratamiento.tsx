import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PillBottle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePaciente } from '../api/consultas';
import { retirarTratamiento } from '../api/recursos';
import type { MotivoRetiro } from '../api/tipos';
import { SelectorFecha, ymd } from '../components/SelectorFecha';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Tarjeta, Vacio } from '../components/ui';
import { MOTIVOS_RETIRO } from '../lib/etiquetas';
import { cn, edadTexto, nombreCompleto } from '../lib/formato';

/**
 * /pacientes/:id/retirar-tratamiento — quitarle medicamentos sin registrar una consulta (lo indicó el
 * médico por teléfono, le hizo daño…). Desde esa fecha dejan de salir en Qué llevar, Dejar TX,
 * reposición y entregas pendientes. En una visita se retira quitando el medicamento de la lista.
 */
export function RetirarTratamiento() {
  const id = Number(useParams().id);
  const paciente = usePaciente(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [motivo, setMotivo] = useState<MotivoRetiro | ''>('');
  const [detalle, setDetalle] = useState('');
  const [dia, setDia] = useState(ymd(new Date()));

  const guardar = useMutation({
    mutationFn: () => {
      // Hoy: la hora de ahora. Otro día: al mediodía, para que caiga en ese día en RD.
      const fecha = dia === ymd(new Date()) ? new Date() : new Date(`${dia}T12:00:00`);
      return retirarTratamiento(id, { medicamentos: [...elegidos], motivo: motivo as MotivoRetiro, detalle: detalle.trim() || undefined, fecha: fecha.toISOString() });
    },
    onSuccess: (r) => {
      for (const k of [['paciente'], ['entregas'], ['jornada'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(r.retirados === 1 ? 'Medicamento retirado. Quedó en su historial y en Auditoría.' : `${r.retirados} medicamentos retirados. Quedó en su historial y en Auditoría.`);
      navegar(`/pacientes/${id}`, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  if (paciente.isPending) return <Cargando />;
  const p = paciente.data;
  if (!p) return <Vacio titulo="Paciente no encontrado" />;
  const vigente = p.tratamiento?.recetas ?? [];
  const alternar = (m: number) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });

  return (
    <>
      <EncabezadoPagina
        titulo="Retirar medicamentos"
        descripcion={
          <>
            {nombreCompleto(p)} · <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · {p.community?.name}
          </>
        }
        volver={{ a: `/pacientes/${id}`, texto: nombreCompleto(p) }}
      />
      {!vigente.length ? (
        <Tarjeta>
          <Vacio icono={<PillBottle className="size-8" />} titulo="No tiene medicamentos en su tratamiento">
            No hay nada que retirar.
          </Vacio>
        </Tarjeta>
      ) : (
        <div className="max-w-2xl space-y-4">
          <Tarjeta titulo="¿Cuáles se le retiran?">
            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {vigente.map((r) => (
                <label
                  key={r.medicationId}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm', elegidos.has(r.medicationId) ? 'border-tinta bg-marca-50' : 'border-borde hover:bg-fondo')}
                >
                  <input type="checkbox" className="accent-tinta" checked={elegidos.has(r.medicationId)} onChange={() => alternar(r.medicationId)} />
                  <span>
                    <span className={cn(elegidos.has(r.medicationId) && 'font-medium')}>
                      {r.medication?.name} {r.medication?.concentration}
                    </span>
                    <span className="block text-xs text-tenue">{r.dailyDose} al día</span>
                  </span>
                </label>
              ))}
            </div>
          </Tarjeta>
          <Tarjeta titulo="Por qué">
            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {(Object.keys(MOTIVOS_RETIRO) as MotivoRetiro[]).map((m) => (
                <label key={m} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo')}>
                  <input type="radio" name="motivo" className="accent-tinta" checked={motivo === m} onChange={() => setMotivo(m)} />
                  {MOTIVOS_RETIRO[m]}
                </label>
              ))}
            </div>
            <div className="grid gap-4 border-t border-borde p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Campo etiqueta="Desde cuándo">
                <SelectorFecha corto max={ymd(new Date())} value={dia} onChange={setDia} />
              </Campo>
              <Campo etiqueta="Detalle" ayuda="Opcional: quién lo indicó, qué le pasó…">
                <AreaTexto rows={2} maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
              </Campo>
            </div>
            <p className="border-t border-borde px-5 py-3 text-sm text-tenue">
              Deja de salir en Qué llevar, Dejar TX, reposición y entregas pendientes, hasta que una visita se lo vuelva a recetar. Queda en su historial y en Auditoría, y se puede deshacer.
            </p>
          </Tarjeta>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => navegar(-1)}>
              Cancelar
            </Boton>
            <Boton icono={<PillBottle className="size-4" />} disabled={!elegidos.size || !motivo || !dia} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
              {elegidos.size > 1 ? `Retirar ${elegidos.size} medicamentos` : 'Retirar medicamento'}
            </Boton>
          </div>
        </div>
      )}
    </>
  );
}
