import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useSesion } from './auth/sesion';
import { Layout } from './components/Layout';
import { Auditoria } from './pages/Auditoria';
import { ClasificacionEditor, ClasificacionPA } from './pages/ClasificacionPA';
import { ComunidadEditor, Comunidades } from './pages/Comunidades';
import { Configuracion } from './pages/Configuracion';
import { EditarVisita } from './pages/EditarVisita';
import { Jornada } from './pages/Jornada';
import { Login } from './pages/Login';
import { OlvideContrasena, RestablecerContrasena } from './pages/RecuperarContrasena';
import { AjusteInventario, EntradaInventario, MedicamentoDetalle } from './pages/Inventario';
import { JornadaDetalle, JornadaEditor, Jornadas } from './pages/Jornadas';
import { MedicamentoEditor, Medicamentos } from './pages/Medicamentos';
import { MedicoDetalle } from './pages/MedicoDetalle';
import { Medicos } from './pages/Medicos';
import { MedicosComparar } from './pages/MedicosComparar';
import { NuevaVisita } from './pages/NuevaVisita';
import { Paciente } from './pages/Paciente';
import { PacienteEditor } from './pages/PacienteEditor';
import { Pacientes } from './pages/Pacientes';
import { CorregirPaciente, RevisionDatos, SepararPaciente, UnirPacientes } from './pages/Revision';
import { RolEditor, Roles } from './pages/Roles';
import { Panel } from './pages/Panel';
import { Reportes } from './pages/Reportes';
import { Donantes } from './pages/Donantes';
import { Metas } from './pages/Metas';
import { MapaBateyes } from './pages/MapaBateyes';
import { BajaPaciente } from './pages/BajaPaciente';
import { CambiarCodigo } from './pages/CambiarCodigo';
import { UsuarioEditor, Usuarios } from './pages/Usuarios';
import { Visitas } from './pages/Visitas';
import { Sincronizacion } from './pages/Sincronizacion';
import { MiCuenta } from './pages/MiCuenta';
import { ConfirmarCorreo } from './pages/ConfirmarCorreo';
import { EnviarResumen } from './pages/EnviarResumen';
import { Entregas } from './pages/Entregas';
import { Reposicion } from './pages/Reposicion';
import { DevolverEntrega } from './pages/DevolverEntrega';
import { PantallaReporteEntregas } from './pages/ReporteEntregas';
import { HojaPreparacion } from './pages/HojaPreparacion';
import { HojaIndicaciones } from './pages/HojaIndicaciones';
import { Planilla } from './pages/Planilla';
import { PacientesDeCifra } from './pages/PacientesDeCifra';
import { EnviarPlanilla } from './pages/EnviarPlanilla';

function Protegida({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  return children;
}

/** El backend responde 403 sin el permiso; aquí solo se evita mostrar pantallas que no se pueden usar. */
function ConPermiso({ permiso, children }: { permiso: string; children: ReactNode }) {
  return useSesion().tiene(permiso) ? children : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/confirmar-correo" element={<ConfirmarCorreo />} />
      <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route index element={<Panel />} />
        <Route path="sincronizacion" element={<Sincronizacion />} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="jornada" element={<ConPermiso permiso="visitas.registrar"><Jornada /></ConPermiso>} />
        <Route path="entregas" element={<ConPermiso permiso="entregas.registrar"><Entregas /></ConPermiso>} />
        <Route path="entregas/:id/devolver" element={<ConPermiso permiso="entregas.registrar"><DevolverEntrega /></ConPermiso>} />
        <Route path="jornadas" element={<ConPermiso permiso="pacientes.ver"><Jornadas /></ConPermiso>} />
        <Route path="jornadas/nueva" element={<ConPermiso permiso="jornadas.planificar"><JornadaEditor /></ConPermiso>} />
        <Route path="jornadas/:id" element={<ConPermiso permiso="pacientes.ver"><JornadaDetalle /></ConPermiso>} />
        <Route path="jornadas/:id/enviar-resumen" element={<ConPermiso permiso="visitas.registrar"><EnviarResumen /></ConPermiso>} />
        <Route path="jornadas/:id/preparacion" element={<ConPermiso permiso="entregas.registrar"><HojaPreparacion /></ConPermiso>} />
        <Route path="jornadas/:id/editar" element={<ConPermiso permiso="jornadas.planificar"><JornadaEditor /></ConPermiso>} />
        <Route path="pacientes" element={<ConPermiso permiso="pacientes.ver"><Pacientes /></ConPermiso>} />
        <Route path="pacientes/nuevo" element={<ConPermiso permiso="pacientes.editar"><PacienteEditor /></ConPermiso>} />
        <Route path="pacientes/:id" element={<ConPermiso permiso="pacientes.ver"><Paciente /></ConPermiso>} />
        <Route path="pacientes/:id/editar" element={<ConPermiso permiso="pacientes.editar"><PacienteEditor /></ConPermiso>} />
        <Route path="pacientes/:id/baja" element={<ConPermiso permiso="pacientes.editar"><BajaPaciente /></ConPermiso>} />
        <Route path="pacientes/:id/codigo" element={<ConPermiso permiso="datos.revisar"><CambiarCodigo /></ConPermiso>} />
        <Route path="pacientes/:id/indicaciones" element={<ConPermiso permiso="pacientes.ver"><HojaIndicaciones /></ConPermiso>} />
        <Route path="pacientes/:id/reposicion" element={<ConPermiso permiso="entregas.registrar"><Reposicion /></ConPermiso>} />
        <Route path="pacientes/:id/visita" element={<ConPermiso permiso="visitas.registrar"><NuevaVisita /></ConPermiso>} />
        <Route path="visitas/:id/editar" element={<EditarVisita />} />
        <Route path="revision" element={<ConPermiso permiso="datos.revisar"><RevisionDatos /></ConPermiso>} />
        <Route path="revision/separar/:id" element={<ConPermiso permiso="datos.revisar"><SepararPaciente /></ConPermiso>} />
        <Route path="revision/corregir/:id" element={<ConPermiso permiso="datos.revisar"><CorregirPaciente /></ConPermiso>} />
        <Route path="revision/unir" element={<ConPermiso permiso="datos.revisar"><UnirPacientes /></ConPermiso>} />
        <Route path="configuracion" element={<ConPermiso permiso="configuracion.gestionar"><Configuracion /></ConPermiso>} />
        <Route path="visitas" element={<ConPermiso permiso="pacientes.ver"><Visitas /></ConPermiso>} />
        <Route path="medicamentos" element={<ConPermiso permiso="inventario.gestionar"><Medicamentos /></ConPermiso>} />
        <Route path="medicamentos/nuevo" element={<ConPermiso permiso="inventario.gestionar"><MedicamentoEditor /></ConPermiso>} />
        <Route path="medicamentos/entrada" element={<ConPermiso permiso="inventario.gestionar"><EntradaInventario /></ConPermiso>} />
        <Route path="medicamentos/:id" element={<ConPermiso permiso="inventario.gestionar"><MedicamentoDetalle /></ConPermiso>} />
        <Route path="medicamentos/:id/editar" element={<ConPermiso permiso="inventario.gestionar"><MedicamentoEditor /></ConPermiso>} />
        <Route path="medicamentos/:id/ajuste" element={<ConPermiso permiso="inventario.gestionar"><AjusteInventario /></ConPermiso>} />
        <Route path="comunidades" element={<Comunidades />} />
        <Route path="comunidades/nueva" element={<ConPermiso permiso="comunidades.gestionar"><ComunidadEditor /></ConPermiso>} />
        <Route path="comunidades/:id" element={<ConPermiso permiso="comunidades.gestionar"><ComunidadEditor /></ConPermiso>} />
        <Route path="reportes" element={<ConPermiso permiso="reportes.ver"><Reportes /></ConPermiso>} />
        <Route path="reportes/entregas" element={<ConPermiso permiso="reportes.ver"><PantallaReporteEntregas /></ConPermiso>} />
        <Route path="reportes/donantes" element={<ConPermiso permiso="reportes.ver"><Donantes /></ConPermiso>} />
        <Route path="reportes/pacientes" element={<ConPermiso permiso="reportes.ver"><PacientesDeCifra /></ConPermiso>} />
        <Route path="reportes/planilla" element={<ConPermiso permiso="reportes.ver"><Planilla /></ConPermiso>} />
        <Route path="reportes/planilla/enviar" element={<ConPermiso permiso="reportes.ver"><EnviarPlanilla /></ConPermiso>} />
        <Route path="metas" element={<ConPermiso permiso="reportes.ver"><Metas /></ConPermiso>} />
        <Route path="mapa" element={<ConPermiso permiso="pacientes.ver"><MapaBateyes /></ConPermiso>} />
        <Route path="clasificacion" element={<ConPermiso permiso="clasificacion.gestionar"><ClasificacionPA /></ConPermiso>} />
        <Route path="clasificacion/nueva" element={<ConPermiso permiso="clasificacion.gestionar"><ClasificacionEditor /></ConPermiso>} />
        <Route path="clasificacion/:id" element={<ConPermiso permiso="clasificacion.gestionar"><ClasificacionEditor /></ConPermiso>} />
        <Route path="usuarios" element={<ConPermiso permiso="usuarios.gestionar"><Usuarios /></ConPermiso>} />
        <Route path="usuarios/nuevo" element={<ConPermiso permiso="usuarios.gestionar"><UsuarioEditor /></ConPermiso>} />
        <Route path="usuarios/:id" element={<ConPermiso permiso="usuarios.gestionar"><UsuarioEditor /></ConPermiso>} />
        <Route path="roles" element={<ConPermiso permiso="roles.gestionar"><Roles /></ConPermiso>} />
        <Route path="roles/nuevo" element={<ConPermiso permiso="roles.gestionar"><RolEditor /></ConPermiso>} />
        <Route path="roles/:id" element={<ConPermiso permiso="roles.gestionar"><RolEditor /></ConPermiso>} />
        <Route path="medicos" element={<ConPermiso permiso="medicos.ver"><Medicos /></ConPermiso>} />
        <Route path="medicos/comparar" element={<ConPermiso permiso="medicos.ver"><MedicosComparar /></ConPermiso>} />
        <Route path="medicos/:id" element={<ConPermiso permiso="medicos.ver"><MedicoDetalle /></ConPermiso>} />
        <Route path="auditoria" element={<ConPermiso permiso="auditoria.ver"><Auditoria /></ConPermiso>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
