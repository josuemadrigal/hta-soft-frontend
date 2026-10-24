# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: médicos y enfermería en la jornada.** Registran visitas en una tableta, en el batey, mientras los pacientes llegan a la hora que pueden. Toman la presión, el peso y la estatura, recetan y entregan los medicamentos, marcan quién no vino y le dejan el tratamiento con un familiar ("Dejar TX"). Muchas veces sin señal.
- **Secundario: coordinación y administración.** Planifican las jornadas, preparan qué llevar, manejan el inventario y las entregas, revisan los datos (códigos compartidos, duplicados), sacan reportes, la planilla de la jornada y el informe para donantes, y administran usuarios y configuración.
- **Lectores externos: donantes.** No entran a la app: reciben el informe trimestral o anual en PDF y la planilla por correo.

## Product Purpose

Control de la hipertensión de los pacientes de la fundación Light a Candle en los bateyes de La Romana (República Dominicana). Cada paciente se visita una vez por ronda (trimestre); la app reemplaza las hojas de papel y el Excel: ficha del paciente, visitas, medicamentos e inventario, asistencia por ronda y reportes. Éxito: más pacientes vistos en cada ronda, más pacientes con la presión controlada (< 140/90) y que no falte el medicamento.

## Positioning

Hecha para la operación real de las jornadas en los bateyes: funciona sin internet y se sincroniza después; mide la ronda contra lo que de verdad viene a una jornada (la media alta de las últimas jornadas, no todos los registrados); la planilla reproduce el formulario de papel de la fundación; el informe para donantes sale de los mismos datos.

## Operating Context

- Jornadas en la mañana, hasta el mediodía o la 1 p. m.; los pacientes llegan cuando pueden (no hay orden de atención) y cada batey se visita una vez por ronda. No proponer cambiar el horario ni "atender primero" a nadie.
- Uso en tableta táctil, en el batey: a veces al sol o con poca luz; la escritura es con el dedo o con un teclado numérico.
- Sin señal con frecuencia: la lista del batey se descarga antes y lo registrado se envía solo al volver la conexión.
- Personal con poca práctica con computadoras: textos simples, sin términos técnicos; los formularios se llenan de corrido (Enter pasa al siguiente campo).
- Medicamentos fijos (Amlodipina, Atenolol, Enalapril, entre otros), unas 95 pastillas por visita (90 días + margen); el código del paciente usa el prefijo del batey (BN1019).

## Capabilities and Constraints

- Ficha del paciente, visitas (toma manual y automática, peso, estatura, medicamentos, cumplimiento), entregas y reposición sin consulta, inventario por lotes, jornadas y Registro en jornada, ronda por batey, reportes, planilla de la jornada, informe para donantes (PDF), revisión de datos, auditoría con deshacer, usuarios y roles con permisos.
- Reglas configurables: pacientes regulares (visitas que se puede perder), esperados por jornada (media alta), umbrales de alertas clínicas.
- Datos clínicos sensibles: la data real nunca se publica ni se usa en capturas; el informe para donantes solo lleva iniciales, edad y batey.
- Fechas y días en hora de República Dominicana.

## Brand Commitments

- Nombre de la app: **Light a Candle APP**. El logo de Light a Candle Dominican Republic y su amarillo son obligatorios.
- Toda la app en español claro; el inglés solo donde el papel de la fundación o los donantes lo piden (títulos de la planilla).

## Evidence on Hand

- Manual de usuario (fuentes en `hta-soft-backend/docs/manual`), con capturas de la base de demostración `hta_demo` (pacientes inventados).
- Logos en `public/` y en `hta-soft-backend/docs/manual`.
- No hay testimonios, cifras públicas ni casos con nombre para usar en diseño: no inventarlos.

## Product Principles

1. La jornada manda: lo que se hace en el batey, con una tableta y sin señal, tiene que ser rápido y funcionar siempre.
2. Cada número se puede explicar: toda cifra dice cómo se cuenta y abre los pacientes que la forman.
3. Se mide contra la realidad: lo esperado es lo que de verdad viene, no lo ideal.
4. Nada se pierde ni se duplica: lo que se corrige queda en Auditoría y se puede deshacer.
5. Palabras de la fundación, no de sistemas: "Dejar TX", "No vino", "Por ver", "ronda".

## Accessibility & Inclusion

- Pantallas táctiles: blancos de toque de al menos 40 px y números grandes en la toma de presión.
- Contraste suficiente para leer al sol; nada importante solo por color.
- Lenguaje simple para personal con poca práctica con computadoras.
