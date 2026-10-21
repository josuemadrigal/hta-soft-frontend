import { describe, expect, it } from 'vitest';
import { colorCategoria, conQuien, MOTIVOS_BAJA, opciones, PARENTESCOS_OPCIONES } from './etiquetas';
describe('colorCategoria', () => {
    it('usa el color configurado si es uno de verdad', () => {
        expect(colorCategoria({ categoryName: 'GRADE_1', colorHex: '#123ABC' })).toBe('#123ABC');
    });
    it('el negro del seed no distingue nada: usa el color por defecto de la categoría', () => {
        expect(colorCategoria({ categoryName: 'CRISIS', colorHex: '#000000' })).toBe('#7f1d1d');
        expect(colorCategoria({ categoryName: 'NORMAL', colorHex: '#000' })).toBe('#15803d');
        expect(colorCategoria({ categoryName: 'NORMAL', colorHex: '' })).toBe('#15803d');
    });
    it('acepta la clave de la categoría y cae en gris si no hay', () => {
        expect(colorCategoria('GRADE_2')).toBe('#dc2626');
        expect(colorCategoria(null)).toBe('#a8a29e');
        expect(colorCategoria(undefined)).toBe('#a8a29e');
    });
});
it('opciones convierte un mapa de etiquetas en opciones de selector, en el mismo orden', () => {
    const o = opciones(MOTIVOS_BAJA);
    expect(o[0]).toEqual({ value: 'FALLECIDO', label: 'Falleció' });
    expect(o.map((x) => x.value)).toEqual(Object.keys(MOTIVOS_BAJA));
});
describe('conQuien', () => {
    it('con nombre, sin nombre y sin nada', () => {
        expect(conQuien('Rosa', 'HIJO')).toBe('Rosa (hijo/a)');
        expect(conQuien(null, 'HIJO')).toBe('su hijo/a');
        expect(conQuien('', 'VECINO')).toBe('un vecino/a');
        expect(conQuien(null, 'OTRO')).toBe('otra persona');
        expect(conQuien(null, null)).toBe('alguien');
    });
    it('ya no se ofrece Padre/Madre, pero se sigue mostrando en lo anterior', () => {
        expect(PARENTESCOS_OPCIONES).not.toContain('PADRE');
        expect(conQuien('Luis', 'PADRE')).toBe('Luis (padre/madre)');
    });
});
