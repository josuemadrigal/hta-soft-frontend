import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { usePlanilla } from '../api/consultas';
import { destinatariosPlanilla, enviarPlanilla } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, ErrorCarga, Insignia, Tarjeta } from '../components/ui';
import { cn } from '../lib/formato';
import { usePeriodoPanel } from '../lib/periodo-panel';
import { useEnLinea } from '../offline/datos';
import { useVolver } from '../lib/navegacion';

/** Separa lo que se escribió en "Otros correos": por comas, punto y coma, espacios o renglones. */
const separar = (s: string) =>
  s
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
const valido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

/** /reportes/planilla/enviar?desde=&hasta= — la planilla por correo a quien se elija. Nunca sale sola. */
export function EnviarPlanilla() {
  const periodo = usePeriodoPanel();
  const filtro = { from: `${periodo.desde}T00:00:00-04:00`, to: `${periodo.hasta}T23:59:59-04:00` };
  const planilla = usePlanilla(filtro);
  const lista = useQuery({ queryKey: ['reportes', 'planilla', 'destinatarios'], queryFn: destinatariosPlanilla });
  const { usuario } = useSesion();
  const enLinea = useEnLinea();
  const volverA = useVolver();
  const cliente = useQueryClient();
  const volver = `/reportes/planilla?desde=${periodo.desde}${periodo.hasta !== periodo.desde ? `&hasta=${periodo.hasta}` : ''}`;
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [otros, setOtros] = useState('');
  const [nota, setNota] = useState('');
  // Los otros correos de la última vez (los donantes suelen ser los mismos).
  useEffect(() => {
    if (lista.data?.otrosCorreos.length && !otros) setOtros(lista.data.otrosCorreos.join(', '));
  }, [lista.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const correos = separar(otros);
  const malos = correos.filter((c) => !valido(c));
  const total = elegidos.size + correos.length - malos.length;

  const enviar = useMutation({
    mutationFn: () => enviarPlanilla({ ...filtro, periodo: periodo.texto, destinatarios: [...elegidos], correos, nota: nota.trim() || undefined }),
    onSuccess: (r) => {
      cliente.invalidateQueries({ queryKey: ['auditoria'] });
      cliente.invalidateQueries({ queryKey: ['reportes', 'planilla', 'destinatarios'] });
      toast.success(r.simulado ? 'Planilla generada. El servidor no tiene correo configurado: quedó en la consola del backend.' : `Planilla enviada a ${r.para.join(', ')}.`);
      volverA(volver);
    },
    onError: (e) => toast.error(e.message),
  });

  if (lista.isPending) return <Cargando forma="lista" />;
  if (lista.isError) return <ErrorCarga error={lista.error} />;
  const usuarios = lista.data.usuarios;
  const confirmados = usuarios.filter((u) => u.confirmado);
  const alternar = (id: number) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const t = planilla.data?.total;

  return (
    <>
      <EncabezadoPagina titulo="Enviar la planilla por correo" descripcion={`Periodo: ${periodo.texto}`} volver={{ a: volver, texto: 'Planilla de la jornada' }} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Tarjeta
            titulo="Usuarios"
            accion={
              confirmados.length > 1 && (
                <button type="button" className="text-sm text-tenue hover:text-tinta" onClick={() => setElegidos(elegidos.size === confirmados.length ? new Set() : new Set(confirmados.map((u) => u.id)))}>
                  {elegidos.size === confirmados.length ? 'Quitar todos' : 'Elegir todos'}
                </button>
              )
            }
          >
            <ul className="max-h-96 divide-y divide-borde overflow-y-auto">
              {usuarios.map((u) => (
                <li key={u.id}>
                  <label className={cn('flex items-center gap-3 px-5 py-3 text-sm', u.confirmado ? 'cursor-pointer hover:bg-fondo' : 'opacity-60')}>
                    <input type="checkbox" className="size-5 accent-tinta" disabled={!u.confirmado} checked={elegidos.has(u.id)} onChange={() => alternar(u.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {u.nombre} {u.id === usuario?.id && <span className="font-normal text-tenue">(tú)</span>}
                      </span>
                      <span className="block truncate text-xs text-tenue">
                        {u.email} · {u.rol}
                      </span>
                    </span>
                    {!u.confirmado && <Insignia color="#a16207">Correo sin confirmar</Insignia>}
                  </label>
                </li>
              ))}
            </ul>
            {confirmados.length < usuarios.length && (
              <p className="border-t border-borde px-5 py-3 text-sm text-tenue">
                Solo se manda a usuarios con el correo confirmado. Cada persona confirma el suyo desde{' '}
                <Link to="/cuenta" className="underline">
                  Mi cuenta
                </Link>
                .
              </p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Otros correos">
            <div className="space-y-2 p-5">
              <Campo
                etiqueta="Donantes, la directora u otras personas que no usan la app (opcional)"
                error={malos.length ? `Revisa: ${malos.join(', ')}` : undefined}
                ayuda="Sepáralos con comas. La planilla solo lleva cifras por batey, sin nombres ni datos de pacientes. Se recuerdan para la próxima vez."
              >
                <AreaTexto rows={2} value={otros} onChange={(e) => setOtros(e.target.value)} placeholder="nombre@ejemplo.org, otra@ejemplo.org" aria-invalid={malos.length > 0} />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Nota (opcional)">
            <div className="p-5">
              <AreaTexto rows={3} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Va arriba de la planilla: un saludo, lo que pasó en la jornada…" aria-label="Nota" />
            </div>
          </Tarjeta>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => volverA(volver)}>
              Cancelar
            </Boton>
            <Boton
              icono={<Send className="size-4" />}
              disabled={!total || malos.length > 0 || !enLinea || correos.length > 15}
              title={!enLinea ? 'Sin conexión' : undefined}
              cargando={enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              {total > 1 ? `Enviar a ${total} personas` : 'Enviar'}
            </Boton>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Tarjeta titulo="Lo que lleva el correo">
            {planilla.isPending ? (
              <Cargando forma="linea" />
            ) : t ? (
              <ul className="space-y-2 p-5 text-sm">
                {(
                  [
                    ['Bateyes con visitas', planilla.data!.filas.filter((f) => f.evaluados > 0).length],
                    ['Pacientes evaluados', t.evaluados],
                    ['Controlados', t.controlados],
                    ['No controlados', t.noControlados],
                    ['Pacientes nuevos', t.nuevos],
                  ] as const
                ).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-tenue">{k}</span>
                    <strong className="tabular">{v.toLocaleString('es-DO')}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="flex gap-2 border-t border-borde px-5 py-3 text-sm text-tenue">
              <Mail className="mt-0.5 size-4 shrink-0" />
              La tabla por batey en español e inglés, y la planilla completa adjunta en CSV para abrir con Excel.
            </p>
            {!lista.data.correoConfigurado && (
              <p className="border-t border-borde bg-amber-50 px-5 py-3 text-sm text-amber-800">El servidor no tiene correo configurado: la planilla no saldrá (en desarrollo se escribe en la consola).</p>
            )}
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}
