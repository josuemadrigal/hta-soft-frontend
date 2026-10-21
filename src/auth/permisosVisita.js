import { useConfiguracion } from '../api/consultas';
import { useSesion } from './sesion';
/**
 * Lo mismo que aplica el backend: el administrador edita y elimina siempre; el médico corrige solo
 * las visitas que atendió y dentro del plazo configurado (horas desde que se registró).
 */
export function usePermisosVisita() {
    const { usuario, tiene } = useSesion();
    const config = useConfiguracion();
    const horas = config.data?.visitasHorasEdicion ?? 0;
    const admin = tiene('visitas.administrar');
    const limite = (v) => (v.createdAt ? new Date(new Date(v.createdAt).getTime() + horas * 3_600_000) : null);
    return {
        horas,
        puedeEliminar: admin,
        puedeEditar: (v) => {
            if (admin)
                return true;
            if (!tiene('visitas.editar') || (v.originalDoctorId ?? v.doctorId) !== usuario?.id)
                return false;
            const l = limite(v);
            return !!l && l.getTime() > Date.now();
        },
        /** Hasta cuándo puede corregirla el médico (para mostrarlo); null si es administrador. */
        editableHasta: (v) => (admin ? null : limite(v)),
    };
}
