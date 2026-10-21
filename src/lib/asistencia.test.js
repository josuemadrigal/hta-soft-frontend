import { describe, expect, it } from 'vitest';
import { asistencia } from './asistencia';
// Mismo "hoy" que las pruebas del backend (common/asistencia.spec.ts): 6 de octubre de 2026.
// Ronda T4 desde el 1 de octubre; corte de 6 meses: 6 de abril; un año: 6 de octubre de 2025.
const ahora = new Date(2026, 9, 6, 10);
// Sin "Z": se lee en hora local, igual que una visita registrada ese día en la tablet.
const clave = (iso, hoy = ahora) => asistencia(iso, hoy).clave;
describe('asistencia', () => {
    it('sin visitas', () => {
        expect(asistencia(null, ahora)).toEqual({ clave: 'sin-visitas', texto: 'Sin visitas' });
        expect(clave(undefined)).toBe('sin-visitas');
        expect(clave('')).toBe('sin-visitas');
    });
    it('vino en esta ronda (desde el primer día del trimestre)', () => {
        expect(asistencia('2026-10-02T12:00:00', ahora)).toMatchObject({ clave: 'visto', texto: 'Visto en la ronda' });
        expect(clave('2026-10-01T00:00:00')).toBe('visto');
    });
    it('vino antes de la ronda pero dentro de 6 meses: pendiente', () => {
        expect(asistencia('2026-09-30T23:59:00', ahora)).toMatchObject({ clave: 'le-toca', texto: 'Pendiente' });
        expect(clave('2026-05-10T12:00:00')).toBe('le-toca');
        // El día del corte todavía cuenta como pendiente.
        expect(clave('2026-04-06T00:00:00')).toBe('le-toca');
    });
    it('más de 6 meses sin venir: dice desde cuándo', () => {
        const a = asistencia('2026-04-05T12:00:00', ahora);
        expect(a.clave).toBe('sin-venir');
        expect(a.masDeUnAno).toBe(false);
        expect(a.color).toBe('#9a3412');
        expect(a.texto).toMatch(/^No asiste desde abr.* 2026$/);
    });
    it('más de un año sin venir: se marca aparte (color apagado)', () => {
        const a = asistencia('2025-10-05T12:00:00', ahora);
        expect(a).toMatchObject({ clave: 'sin-venir', masDeUnAno: true, color: '#6b665e' });
        expect(asistencia('2025-10-06T12:00:00', ahora).masDeUnAno).toBe(false);
    });
    it('la ronda es el trimestre calendario (en febrero empieza el 1 de enero)', () => {
        const febrero = new Date(2026, 1, 15);
        expect(clave('2026-01-01T08:00:00', febrero)).toBe('visto');
        expect(clave('2025-12-31T08:00:00', febrero)).toBe('le-toca');
        expect(clave('2025-08-14T08:00:00', febrero)).toBe('sin-venir');
    });
    it('el corte de 6 meses no se pasa de mes en días 29–31 (31 ago → 28 feb)', () => {
        const fin = new Date(2026, 7, 31, 10);
        expect(clave('2026-03-01T12:00:00', fin)).toBe('le-toca');
        expect(clave('2026-02-27T12:00:00', fin)).toBe('sin-venir');
    });
});
