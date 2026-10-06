import { useNavigate, useParams, useSearchParams } from 'react-router';
import { usePaciente } from '../api/consultas';
import { FormularioVisita } from '../components/FormularioVisita';
import { Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { edadTexto, nombreCompleto } from '../lib/formato';

/** /pacientes/:id/visita. Con ?volver=/jornada?batey=X regresa a la jornada al guardar. */
export function NuevaVisita() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  // Solo rutas internas: evita que un enlace manipulado mande a otro sitio.
  const pedido = params.get('volver');
  const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${id}`;
  const navegar = useNavigate();
  const paciente = usePaciente(id);

  if (paciente.isPending) return <Cargando />;
  if (!paciente.data) return <Vacio titulo="Paciente no encontrado" />;
  const p = paciente.data;

  return (
    <>
      <EncabezadoPagina
        titulo={`Visita · ${nombreCompleto(p)}`}
        descripcion={
          <>
            <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · {p.community?.name}
          </>
        }
        volver={{ a: volver, texto: volver.startsWith('/jornada') ? 'Jornada' : nombreCompleto(p) }}
      />
      <FormularioVisita paciente={p} alGuardar={() => navegar(volver)} />
    </>
  );
}
