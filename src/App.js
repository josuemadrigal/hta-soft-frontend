import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { EnviarPlanilla } from './pages/EnviarPlanilla';
function Protegida({ children }) {
    const { usuario } = useSesion();
    const location = useLocation();
    if (!usuario)
        return _jsx(Navigate, { to: "/login", replace: true, state: { desde: location.pathname } });
    return children;
}
/** El backend responde 403 sin el permiso; aquí solo se evita mostrar pantallas que no se pueden usar. */
function ConPermiso({ permiso, children }) {
    return useSesion().tiene(permiso) ? children : _jsx(Navigate, { to: "/", replace: true });
}
export function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/confirmar-correo", element: _jsx(ConfirmarCorreo, {}) }), _jsx(Route, { path: "/olvide-contrasena", element: _jsx(OlvideContrasena, {}) }), _jsx(Route, { path: "/restablecer-contrasena", element: _jsx(RestablecerContrasena, {}) }), _jsxs(Route, { element: _jsx(Protegida, { children: _jsx(Layout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Panel, {}) }), _jsx(Route, { path: "sincronizacion", element: _jsx(Sincronizacion, {}) }), _jsx(Route, { path: "cuenta", element: _jsx(MiCuenta, {}) }), _jsx(Route, { path: "jornada", element: _jsx(ConPermiso, { permiso: "visitas.registrar", children: _jsx(Jornada, {}) }) }), _jsx(Route, { path: "entregas", element: _jsx(ConPermiso, { permiso: "entregas.registrar", children: _jsx(Entregas, {}) }) }), _jsx(Route, { path: "entregas/:id/devolver", element: _jsx(ConPermiso, { permiso: "entregas.registrar", children: _jsx(DevolverEntrega, {}) }) }), _jsx(Route, { path: "jornadas", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(Jornadas, {}) }) }), _jsx(Route, { path: "jornadas/nueva", element: _jsx(ConPermiso, { permiso: "jornadas.planificar", children: _jsx(JornadaEditor, {}) }) }), _jsx(Route, { path: "jornadas/:id", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(JornadaDetalle, {}) }) }), _jsx(Route, { path: "jornadas/:id/enviar-resumen", element: _jsx(ConPermiso, { permiso: "visitas.registrar", children: _jsx(EnviarResumen, {}) }) }), _jsx(Route, { path: "jornadas/:id/preparacion", element: _jsx(ConPermiso, { permiso: "entregas.registrar", children: _jsx(HojaPreparacion, {}) }) }), _jsx(Route, { path: "jornadas/:id/editar", element: _jsx(ConPermiso, { permiso: "jornadas.planificar", children: _jsx(JornadaEditor, {}) }) }), _jsx(Route, { path: "pacientes", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(Pacientes, {}) }) }), _jsx(Route, { path: "pacientes/nuevo", element: _jsx(ConPermiso, { permiso: "pacientes.editar", children: _jsx(PacienteEditor, {}) }) }), _jsx(Route, { path: "pacientes/:id", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(Paciente, {}) }) }), _jsx(Route, { path: "pacientes/:id/editar", element: _jsx(ConPermiso, { permiso: "pacientes.editar", children: _jsx(PacienteEditor, {}) }) }), _jsx(Route, { path: "pacientes/:id/baja", element: _jsx(ConPermiso, { permiso: "pacientes.editar", children: _jsx(BajaPaciente, {}) }) }), _jsx(Route, { path: "pacientes/:id/codigo", element: _jsx(ConPermiso, { permiso: "datos.revisar", children: _jsx(CambiarCodigo, {}) }) }), _jsx(Route, { path: "pacientes/:id/indicaciones", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(HojaIndicaciones, {}) }) }), _jsx(Route, { path: "pacientes/:id/reposicion", element: _jsx(ConPermiso, { permiso: "entregas.registrar", children: _jsx(Reposicion, {}) }) }), _jsx(Route, { path: "pacientes/:id/visita", element: _jsx(ConPermiso, { permiso: "visitas.registrar", children: _jsx(NuevaVisita, {}) }) }), _jsx(Route, { path: "visitas/:id/editar", element: _jsx(EditarVisita, {}) }), _jsx(Route, { path: "revision", element: _jsx(ConPermiso, { permiso: "datos.revisar", children: _jsx(RevisionDatos, {}) }) }), _jsx(Route, { path: "revision/separar/:id", element: _jsx(ConPermiso, { permiso: "datos.revisar", children: _jsx(SepararPaciente, {}) }) }), _jsx(Route, { path: "revision/corregir/:id", element: _jsx(ConPermiso, { permiso: "datos.revisar", children: _jsx(CorregirPaciente, {}) }) }), _jsx(Route, { path: "revision/unir", element: _jsx(ConPermiso, { permiso: "datos.revisar", children: _jsx(UnirPacientes, {}) }) }), _jsx(Route, { path: "configuracion", element: _jsx(ConPermiso, { permiso: "configuracion.gestionar", children: _jsx(Configuracion, {}) }) }), _jsx(Route, { path: "visitas", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(Visitas, {}) }) }), _jsx(Route, { path: "medicamentos", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(Medicamentos, {}) }) }), _jsx(Route, { path: "medicamentos/nuevo", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(MedicamentoEditor, {}) }) }), _jsx(Route, { path: "medicamentos/entrada", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(EntradaInventario, {}) }) }), _jsx(Route, { path: "medicamentos/:id", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(MedicamentoDetalle, {}) }) }), _jsx(Route, { path: "medicamentos/:id/editar", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(MedicamentoEditor, {}) }) }), _jsx(Route, { path: "medicamentos/:id/ajuste", element: _jsx(ConPermiso, { permiso: "inventario.gestionar", children: _jsx(AjusteInventario, {}) }) }), _jsx(Route, { path: "comunidades", element: _jsx(Comunidades, {}) }), _jsx(Route, { path: "comunidades/nueva", element: _jsx(ConPermiso, { permiso: "comunidades.gestionar", children: _jsx(ComunidadEditor, {}) }) }), _jsx(Route, { path: "comunidades/:id", element: _jsx(ConPermiso, { permiso: "comunidades.gestionar", children: _jsx(ComunidadEditor, {}) }) }), _jsx(Route, { path: "reportes", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(Reportes, {}) }) }), _jsx(Route, { path: "reportes/entregas", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(PantallaReporteEntregas, {}) }) }), _jsx(Route, { path: "reportes/donantes", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(Donantes, {}) }) }), _jsx(Route, { path: "reportes/planilla", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(Planilla, {}) }) }), _jsx(Route, { path: "reportes/planilla/enviar", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(EnviarPlanilla, {}) }) }), _jsx(Route, { path: "metas", element: _jsx(ConPermiso, { permiso: "reportes.ver", children: _jsx(Metas, {}) }) }), _jsx(Route, { path: "mapa", element: _jsx(ConPermiso, { permiso: "pacientes.ver", children: _jsx(MapaBateyes, {}) }) }), _jsx(Route, { path: "clasificacion", element: _jsx(ConPermiso, { permiso: "clasificacion.gestionar", children: _jsx(ClasificacionPA, {}) }) }), _jsx(Route, { path: "clasificacion/nueva", element: _jsx(ConPermiso, { permiso: "clasificacion.gestionar", children: _jsx(ClasificacionEditor, {}) }) }), _jsx(Route, { path: "clasificacion/:id", element: _jsx(ConPermiso, { permiso: "clasificacion.gestionar", children: _jsx(ClasificacionEditor, {}) }) }), _jsx(Route, { path: "usuarios", element: _jsx(ConPermiso, { permiso: "usuarios.gestionar", children: _jsx(Usuarios, {}) }) }), _jsx(Route, { path: "usuarios/nuevo", element: _jsx(ConPermiso, { permiso: "usuarios.gestionar", children: _jsx(UsuarioEditor, {}) }) }), _jsx(Route, { path: "usuarios/:id", element: _jsx(ConPermiso, { permiso: "usuarios.gestionar", children: _jsx(UsuarioEditor, {}) }) }), _jsx(Route, { path: "roles", element: _jsx(ConPermiso, { permiso: "roles.gestionar", children: _jsx(Roles, {}) }) }), _jsx(Route, { path: "roles/nuevo", element: _jsx(ConPermiso, { permiso: "roles.gestionar", children: _jsx(RolEditor, {}) }) }), _jsx(Route, { path: "roles/:id", element: _jsx(ConPermiso, { permiso: "roles.gestionar", children: _jsx(RolEditor, {}) }) }), _jsx(Route, { path: "medicos", element: _jsx(ConPermiso, { permiso: "medicos.ver", children: _jsx(Medicos, {}) }) }), _jsx(Route, { path: "medicos/comparar", element: _jsx(ConPermiso, { permiso: "medicos.ver", children: _jsx(MedicosComparar, {}) }) }), _jsx(Route, { path: "medicos/:id", element: _jsx(ConPermiso, { permiso: "medicos.ver", children: _jsx(MedicoDetalle, {}) }) }), _jsx(Route, { path: "auditoria", element: _jsx(ConPermiso, { permiso: "auditoria.ver", children: _jsx(Auditoria, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }));
}
