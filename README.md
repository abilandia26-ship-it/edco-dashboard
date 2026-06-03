# Dashboard de Avance EDCO

Visualizador web para el seguimiento del ciclo de vida de programas de Educación Continua.

## Funcionalidades

- Carga de archivo CSV.
- Resumen ejecutivo del portafolio.
- Gráficos por etapa, facultad, riesgo y cumplimiento.
- Tabla maestra de programas.
- Heatmap de hitos operativos.
- Ranking de cuellos de botella.
- Alertas automáticas.

## Formato de datos

El dashboard espera un archivo CSV con columnas como:

- Facultad
- Programa
- Ciclo
- Etapa
- Fecha de Inicio
- Fecha de Fin
- Precio
- Ficha marketing
- Creación del Código y Siglas
- Creación de la Cohorte
- Ajuste Pauta Plantilla Júpiter
- Aprobación de Tarifa
- Salesforce
- Creacion de BECA
- Creación de los Artes
- Activación de Pauta
- Seguimiento Admisiones
- Aprobación Docente DGGA
- Certificados
- Meta de estudiantes
- Estudiantes Documentados

## Valores de hitos

- 0 = Pendiente
- 1 = En proceso
- 2 = Completado

## Uso

1. Exportar el archivo Excel como CSV UTF-8.
2. Abrir el dashboard.
3. Cargar el CSV.
4. Revisar indicadores, gráficos, tabla, heatmap y alertas.

## Publicación

Este proyecto se publica en GitHub Pages mediante GitHub Actions.
