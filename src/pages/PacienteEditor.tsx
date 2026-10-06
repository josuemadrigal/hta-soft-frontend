import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useComunidades, usePaciente } from '../api/consultas';
import { FormularioPaciente } from '../components/FormularioPaciente';
import { Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { nombreCompleto } from '../lib/formato';

/**
 * /pacientes/nuevo y /pacientes/:id/editar.
 * Desde la jornada llega con ?batey=X: el paciente nuevo queda en ese batey y se pasa directo a su visita.
 */
export function PacienteEditor() {
  const id = Number(useParams().id) || undefined;
  const [params] = useSearchParams();
  const batey = Number(params.get('batey')) || undefined;
  const navegar = useNavigate();
  const paciente = usePaciente(id);
  const comunidades = useComunidades();

  // El <select> de batey necesita sus opciones al montarse.
  if ((id && paciente.isPending) || !comunidades.data) return <Cargando />;
  if (id && !paciente.data) return <Vacio titulo="Paciente no encontrado" />;
  const p = paciente.data ?? undefined;
  const nombreBatey = comunidades.data?.find((c) => c.id === batey)?.name;

  return (
    <>
      <EncabezadoPagina
        titulo={p ? `Editar a ${nombreCompleto(p)}` : nombreBatey ? `Paciente nuevo en ${nombreBatey}` : 'Paciente nuevo'}
        volver={p ? { a: `/pacientes/${p.id}`, texto: nombreCompleto(p) } : batey ? { a: `/jornada?batey=${batey}`, texto: 'Jornada' } : { a: '/pacientes', texto: 'Pacientes' }}
      />
      <FormularioPaciente
        paciente={p}
        comunidadInicial={batey}
        alTerminar={(nuevo) =>
          navegar(
            p ? `/pacientes/${nuevo.id}` : batey ? `/pacientes/${nuevo.id}/visita?volver=${encodeURIComponent(`/jornada?batey=${batey}`)}` : `/pacientes/${nuevo.id}`,
            { replace: true },
          )
        }
      />
    </>
  );
}
