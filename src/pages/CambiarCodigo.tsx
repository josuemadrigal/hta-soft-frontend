import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { usePaciente } from '../api/consultas';
import { cambiarCodigoPaciente } from '../api/recursos';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Tarjeta, Vacio } from '../components/ui';
import { nombreCompleto } from '../lib/formato';

const FORMATO = /^[A-Z]{1,6}\d{1,8}$/;

/** /pacientes/:id/codigo — caso extremo: el administrador escribe el código exacto. */
export function CambiarCodigo() {
  const id = Number(useParams().id);
  const consulta = usePaciente(id);
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const limpio = codigo.trim().toUpperCase();
  const valido = FORMATO.test(limpio);

  const guardar = useMutation({
    mutationFn: () => cambiarCodigoPaciente(id, limpio),
    onSuccess: (r) => {
      for (const k of [['paciente'], ['pacientes'], ['jornada'], ['auditoria'], ['comunidades']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(`Código cambiado a ${r.patientCode}. El anterior quedó en Auditoría.`);
      navegar(`/pacientes/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (consulta.isPending) return <Cargando />;
  const p = consulta.data;
  if (!p) return <Vacio titulo="Paciente no encontrado" />;
  const prefijo = p.community?.abbreviation;

  return (
    <>
      <EncabezadoPagina titulo="Cambiar el código" descripcion={nombreCompleto(p)} volver={{ a: `/pacientes/${id}`, texto: nombreCompleto(p) }} />
      <form
        className="max-w-xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) guardar.mutate();
        }}
      >
        <Tarjeta titulo="Código">
          <div className="space-y-4 p-5">
            <p className="text-sm">
              Código actual: <span className="font-mono text-lg font-semibold">{p.patientCode}</span>
            </p>
            <Campo
              etiqueta="Código nuevo"
              error={limpio && !valido ? 'Letras y luego números, por ejemplo MG1023' : undefined}
              ayuda={prefijo ? `Los de ${p.community?.name} empiezan por ${prefijo}.` : undefined}
            >
              <Entrada
                autoFocus
                maxLength={14}
                autoComplete="off"
                spellCheck={false}
                className="h-12 font-mono text-xl tracking-wide uppercase"
                placeholder={prefijo ? `${prefijo}1234` : 'MG1234'}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\s/g, ''))}
                aria-invalid={!!limpio && !valido}
              />
            </Campo>
            <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Úsalo solo en un caso extremo, por ejemplo para que coincida con su tarjeta en papel. Si el paciente solo cambió de batey, usa <strong>Regenerar código</strong> en
              su ficha. El código anterior deja de encontrarse en el buscador y el cambio queda en Auditoría.
            </div>
          </div>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar(`/pacientes/${id}`)}>
            Cancelar
          </Boton>
          <Boton type="submit" icono={<Save className="size-4" />} disabled={!valido || limpio === p.patientCode} cargando={guardar.isPending}>
            Guardar código
          </Boton>
        </div>
      </form>
    </>
  );
}
