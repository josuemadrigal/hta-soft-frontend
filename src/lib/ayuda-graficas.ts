/** Explicación de cada gráfica para el botón (i): cómo se lee y qué significa. */
export type AyudaGrafica = { lee: string; significa: string };

const CONTROLADO = 'Un paciente está controlado si su última toma quedó por debajo de 140/90 (Normal o Elevada).';
const CUMPLIMIENTO =
  'El cumplimiento compara las pastillas que el paciente se tomó entre una visita y la siguiente (las que se le dieron menos las que le quedaban) con las que debía tomar en ese tiempo.';

export const AYUDA = {
  visitasYControl: {
    lee: 'Cada barra amarilla es un trimestre: su altura es la cantidad de visitas (escala de la izquierda). La línea negra es el % de pacientes controlados en ese trimestre (escala de la derecha, de 0 a 100%).',
    significa: `Muestra si se está viendo a más gente y si la presión de esa gente mejora. ${CONTROLADO} Lo ideal es que la línea suba con el tiempo.`,
  },
  controlPanel: {
    lee: 'Cada barra es un trimestre: su altura es cuántos pacientes se vieron (escala de la izquierda). La línea negra es el % de esos pacientes que estaban controlados (escala de la derecha).',
    significa: `Resume los últimos dos años de trabajo. ${CONTROLADO} Si la línea sube, el tratamiento está funcionando.`,
  },
  clasificacionCierre: {
    lee: 'Cada fila es una clasificación de la presión, de Normal a Crisis. La barra y el número dicen cuántos pacientes terminaron el periodo en esa clasificación; a la derecha, el % del total.',
    significa: 'Se toma la última toma de cada paciente dentro del periodo. Cuantos más pacientes estén arriba (Normal y Elevada) y menos abajo (grado 2 y Crisis), mejor.',
  },
  comoEstanHoy: {
    lee: 'Cada fila es una clasificación de la presión. La barra y el número dicen cuántos pacientes en seguimiento tienen hoy esa clasificación; a la derecha, el % del total.',
    significa: 'Usa la última toma de cada paciente que vino en los últimos 6 meses. Los de grado 2 y Crisis son los que hay que ver primero en la próxima jornada.',
  },
  presionPromedio: {
    lee: 'Cada punto es el promedio de todas las tomas de un trimestre. La línea negra es la sistólica (el número de arriba) y la amarilla la diastólica (el de abajo), en mmHg.',
    significa: 'Muestra hacia dónde va la presión del grupo. La meta es que la negra quede por debajo de 140 y la amarilla por debajo de 90. Un salto en un trimestre suele deberse a pacientes nuevos que llegan sin tratamiento.',
  },
  clasificacionTrimestre: {
    lee: 'Cada barra es un trimestre y llega siempre al 100%: los colores dicen qué parte de los pacientes vistos ese trimestre quedó en cada clasificación (verde Normal, amarillo Elevada, naranja grado 1, rojo grado 2, rojo oscuro Crisis).',
    significa: 'Permite ver si el grupo mejora aunque cambie la cantidad de pacientes: si el verde y el amarillo crecen y el rojo se achica, la presión del grupo está mejorando. Se usa la última toma de cada paciente en ese trimestre.',
  },
  controlPorBatey: {
    lee: 'Cada fila es un batey, ordenados del más controlado al menos. La barra es el % de sus pacientes controlados; a la derecha, cuántos pacientes se vieron allí en el periodo.',
    significa: `${CONTROLADO} Los bateyes de abajo son los que más apoyo necesitan: más seguimiento, revisar si toman el tratamiento o si les falta medicamento.`,
  },
  cumplimientoMedicamento: {
    lee: 'Cada fila es un medicamento con su concentración. La barra es el cumplimiento promedio de sus recetas (0 a 100%); a la derecha, cuántos pacientes lo recibieron.',
    significa: `${CUMPLIMIENTO} Un medicamento con cumplimiento bajo puede indicar efectos molestos, dosis difíciles de seguir o que se acaba antes de la próxima visita.`,
  },
  distribucionCumplimiento: {
    lee: 'Cada fila es un rango de cumplimiento, de menos de 50% a 95–100%. La barra y el número dicen cuántas recetas cayeron en ese rango.',
    significa: `${CUMPLIMIENTO} Lo ideal es que la mayoría esté en 80% o más. Las recetas en rojo son de pacientes a los que conviene preguntarles por qué no se toman las pastillas.`,
  },
  pastillasTrimestre: {
    lee: 'Cada barra es un trimestre y su altura es el total de pastillas entregadas. Los colores separan cada medicamento; al tocar una barra se ven las cantidades.',
    significa: 'Sirve para planificar compras y donaciones: muestra cuánto de cada medicamento se necesita por trimestre y si la demanda está creciendo.',
  },
  edad: {
    lee: 'Cada fila es un grupo de edad. La barra y el número dicen cuántos pacientes atendidos en el periodo tienen esa edad.',
    significa: 'Muestra a quién se está atendiendo. La presión alta es más frecuente con la edad; muchos pacientes jóvenes con hipertensión merecen atención especial.',
  },
  genero: {
    lee: 'Cada fila es un género. La barra y el número dicen cuántos pacientes atendidos en el periodo son de ese género; a la derecha, el %.',
    significa: 'Ayuda a ver si algún grupo está llegando menos a las jornadas (por ejemplo, los hombres suelen venir menos).',
  },
  habitos: {
    lee: 'Cada fila es un hábito o antecedente. La barra es el % de los pacientes atendidos que lo tienen; entre paréntesis, cuántos son.',
    significa: 'Son factores que suben la presión. Indican qué temas conviene hablar en las charlas: sal, alcohol, tabaco y antecedentes en la familia.',
  },
  planilla: {
    lee: 'Es la planilla de papel que se llenaba a mano, con las mismas columnas y en el mismo orden: una fila por batey y abajo el total. Usa el periodo y el batey de los filtros de arriba. Toca un número para ver los pacientes que lo forman.',
    significa: 'Se cuenta por paciente, no por visita, y para saber si está controlado vale su última toma del periodo. Existentes (en el programa) es la media alta de sus últimas jornadas, como los Esperados de la ronda. Medicamentos, controlados, no controlados y datos dudosos cuentan a todos los evaluados, nuevos incluidos; las dos últimas columnas dicen cuántos son nuevos. Los bateyes sin visitas quedan en blanco.',
  },
  rondaPorBatey: {
    lee: 'Cada fila es un batey, primero los que más faltan. Esperados es la media alta de sus últimas jornadas (el promedio de las que tuvieron más pacientes, para prepararse para un buen día; cuántas, se ajusta en Configuración); la barra es cuántos ya se vieron en esta ronda contra esos esperados, y se pone verde al llegar. Faltan es lo que queda para llegar. Regulares son todos los que todavía vienen, y Dejaron de venir los regulares que llevan más de 6 meses sin venir. Toca un número para ver los pacientes (o, en Esperados, las jornadas que se promediaron).',
    significa: 'Una ronda es el trimestre en que se debe ver a cada paciente una vez. Nunca vienen todos los regulares: por eso se mide contra lo que viene en un buen día. Los que se perdieron más visitas de las que se fijan en Configuración ya no cuentan. Los bateyes de arriba son donde más falta la próxima jornada.',
  },

  visitasPorMedico: {
    lee: 'Cada barra es un médico (los 12 con más visitas): su altura es la cantidad de visitas (escala de la izquierda). El punto negro es el % de sus pacientes controlados (escala de la derecha).',
    significa: `Compara el trabajo de cada médico en el periodo. ${CONTROLADO} El % depende también de los pacientes que le tocaron: uno que atiende a muchos nuevos tendrá un % más bajo al principio.`,
  },
  visitasMedico: {
    lee: 'Cada barra amarilla es un trimestre: su altura es la cantidad de visitas de este médico (escala de la izquierda). La línea negra es el % de sus pacientes controlados (escala de la derecha).',
    significa: `Muestra cómo evoluciona su trabajo en el tiempo. ${CONTROLADO}`,
  },
  comoTerminaronMedico: {
    lee: 'Cada fila es una clasificación de la presión. La barra y el número dicen cuántos pacientes terminaron en esa clasificación según la última toma que les hizo este médico; a la derecha, el %.',
    significa: 'Cuantos más pacientes estén en Normal y Elevada, mejor les fue con su tratamiento.',
  },
  bateyesMedico: {
    lee: 'Cada fila es un batey donde atendió este médico. La barra y el número dicen cuántos pacientes vio allí; a la derecha, el % de ellos que quedó controlado.',
    significa: 'Muestra dónde trabajó más y cómo le fue en cada lugar.',
  },
  medicamentosMedico: {
    lee: 'Cada fila es un medicamento que recetó. La barra es el cumplimiento promedio de esas recetas (0 a 100%); a la derecha, a cuántos pacientes se lo dio.',
    significa: CUMPLIMIENTO,
  },
  compararResumen: {
    lee: 'Cada columna es un médico y cada fila un indicador del periodo. Se pueden comparar uno al lado del otro.',
    significa: `${CONTROLADO} ${CUMPLIMIENTO}`,
  },
  compararControl: {
    lee: 'Cada línea es un médico (su color está en la leyenda). Cada punto es el % de sus pacientes controlados en un trimestre.',
    significa: `${CONTROLADO} Si la línea de un médico sube, a sus pacientes les está yendo mejor. Un hueco en la línea es un trimestre en que no atendió.`,
  },
  compararVisitas: {
    lee: 'Cada grupo de barras es un trimestre y cada color un médico. La altura es cuántas visitas hizo ese médico en ese trimestre.',
    significa: 'Muestra cómo se repartió el trabajo entre los médicos a lo largo del tiempo.',
  },
  compararTerminaron: {
    lee: 'Cada fila es un médico. La barra se divide por colores según cómo terminaron sus pacientes, de Normal (verde) a Crisis (rojo oscuro); el ancho de cada color es el %.',
    significa: 'Se usa la última toma que cada médico le hizo a cada paciente. Más verde y amarillo es mejor.',
  },
  donantesEvolucion: {
    lee: 'Cada barra amarilla es un trimestre: su altura es cuántos pacientes se atendieron. La línea negra es el % de ellos que estaba controlado (escala de la derecha).',
    significa: `Resume el impacto del programa en los últimos dos años. ${CONTROLADO}`,
  },
  donantesCierre: {
    lee: 'Cada fila es una clasificación de la presión. La barra y el número dicen cuántos pacientes terminaron el periodo en esa clasificación; a la derecha, el %.',
    significa: 'Se toma la última toma de cada paciente. Normal y Elevada son pacientes con la presión bajo control.',
  },
  pastillasPorBatey: {
    lee: 'Cada fila es un batey y la barra es el total de pastillas entregadas allí. Los colores separan cómo se entregaron: en la visita, después en la mesa de farmacia o como reposición sin consulta.',
    significa: 'Muestra a dónde va el medicamento. Mucha reposición sin consulta puede indicar pacientes que no están viniendo a ver al médico.',
  },
  evolucionPaciente: {
    lee: 'Cada punto es una toma de presión de este paciente. La línea negra es la sistólica (el número de arriba) y la amarilla la diastólica (el de abajo). Las líneas rojas punteadas marcan 140 y 90.',
    significa: 'Si los puntos quedan por debajo de las líneas rojas, la presión está controlada. Con los botones de arriba se cambia el rango de fechas.',
  },
  meta: {
    lee: 'El número grande es cómo va el indicador este año y al lado, la meta. La barra muestra cuánto falta para llegar; abajo, el valor del año pasado y la flecha dice si mejoró.',
    significa: 'Las metas se fijan al comienzo del año. "A esta altura" es lo que se debería llevar hoy si el avance fuera parejo durante el año.',
  },
} satisfies Record<string, AyudaGrafica>;
