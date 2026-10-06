import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { borrarVisita } from '../api/recursos';
import type { Visita } from '../api/tipos';
import { atendio, fecha, nombreCompleto } from '../lib/formato';
import { useConfirmar } from './confirmar';

/** Confirma y elimina una visita (solo administradores; el backend lo vuelve a verificar). */
export function useEliminarVisita(alTerminar?: () => void) {
  const confirmar = useConfirmar();
  const cliente = useQueryClient();
  const borrar = useMutation({
    mutationFn: borrarVisita,
    onSuccess: (r) => {
      for (const k of [['visitas'], ['paciente'], ['pacientes'], ['jornada'], ['stats'], ['medicamentos'], ['medicos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(r.inventarioDevuelto ? 'Visita eliminada. Los medicamentos entregados volvieron al inventario.' : 'Visita eliminada.');
      alTerminar?.();
    },
    onError: (e) => toast.error(e.message),
  });

  return async (v: Visita) => {
    const ok = await confirmar({
      titulo: `¿Eliminar la visita del ${fecha(v.visitDate)}?`,
      mensaje: (
        <>
          <p>
            {v.patient ? `${nombreCompleto(v.patient)} · ` : ''}Atendió {atendio(v)}.
          </p>
          <p className="mt-2">
            Se borra con sus medicamentos.{' '}
            {v.importada ? 'Como viene del registro histórico, el inventario no cambia.' : 'Las pastillas entregadas vuelven al inventario.'} Queda una copia completa en Auditoría.
          </p>
        </>
      ),
    });
    if (ok) borrar.mutate(v.id);
  };
}
