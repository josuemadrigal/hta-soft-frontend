import { Lock, Trash2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useUsuarios, useVisita } from '../api/consultas';
import type { Paciente, Visita } from '../api/tipos';
import { usePermisosVisita } from '../auth/permisosVisita';
import { useSesion } from '../auth/sesion';
import { useEliminarVisita } from '../components/eliminarVisita';
import { FormularioVisita } from '../components/FormularioVisita';
import { Boton, Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { atendio, edadTexto, fecha, fechaYHora, nombreCompleto } from '../lib/formato';

/** /visitas/:id/editar — médico: las suyas dentro del plazo; administrador: cualquiera. */
export function EditarVisita() {
  const id = Number(useParams().id);
  const consulta = useVisita(id);
  const permisos = usePermisosVisita();
  if (consulta.isPending) return <Cargando />;
  if (!consulta.data) return <Vacio titulo="Visita no encontrada">Puede que se haya eliminado.</Vacio>;
  if (!permisos.puedeEditar(consulta.data)) {
    return (
      <Vacio icono={<Lock className="size-8" />} titulo="No puedes editar esta visita">
        Los médicos corrigen solo las visitas que atendieron, durante {permisos.horas} horas desde que se registraron. Pide a un administrador que la corrija.
      </Vacio>
    );
  }
  return <Formulario visita={consulta.data} />;
}

function Formulario({ visita }: { visita: Visita & { patient: Paciente } }) {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const pedido = params.get('volver');
  const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${visita.patientId}`;
  const { tiene } = useSesion();
  const permisos = usePermisosVisita();
  const esAdmin = permisos.puedeEliminar;
  const usuarios = useUsuarios();
  const eliminar = useEliminarVisita(() => navegar(volver));
  const hasta = permisos.editableHasta(visita);
  const p = visita.patient;
  // Cambiar quién atendió: solo la administración.
  const medicos = esAdmin && tiene('usuarios.gestionar') ? (usuarios.data?.data ?? []).map((u) => ({ value: u.id, label: `${nombreCompleto(u)}${u.isActive ? '' : ' (inactivo)'}` })) : undefined;

  return (
    <>
      <EncabezadoPagina
        titulo={`Editar visita del ${fecha(visita.visitDate)}`}
        descripcion={
          <>
            {nombreCompleto(p)} · <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · atendió {atendio(visita)}
          </>
        }
        volver={{ a: volver, texto: volver.startsWith('/visitas') ? 'Visitas' : nombreCompleto(p) }}
        acciones={
          esAdmin && (
            <Boton variante="secundario" className="hover:text-red-600" icono={<Trash2 className="size-4" />} onClick={() => eliminar({ ...visita, patient: p })}>
              Eliminar visita
            </Boton>
          )
        }
      />
      {hasta && (
        <p className="mb-4 rounded-lg bg-marca-50 px-4 py-2.5 text-sm">
          Puedes corregir esta visita hasta el <strong>{fechaYHora(hasta.toISOString())}</strong>. Después, solo un administrador.
        </p>
      )}
      {/* La misma pantalla que al registrar la visita, con sus datos cargados */}
      {medicos && usuarios.isPending ? <Cargando /> : <FormularioVisita paciente={p} visita={visita} medicos={medicos} alGuardar={() => navegar(volver)} />}
    </>
  );
}
