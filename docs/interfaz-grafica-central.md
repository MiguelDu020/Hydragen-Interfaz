# Interfaz Gráfica HydraGen Console (Documento Central)

## 1. Propósito (¿por qué se hizo la interfaz?)
La interfaz gráfica se construyó para facilitar la configuración de benchmarks de microservicios sin depender de edición manual de archivos JSON/YAML ni de uso técnico avanzado por consola.  
El objetivo principal es permitir que usuarios con menor experiencia técnica puedan modelar una arquitectura de servicios con drag & drop, configurar sus propiedades y exportar un JSON compatible con HydraGen.

## 2. Objetivo funcional (¿para qué sirve?)
La interfaz permite:
- Crear servicios de forma visual sobre un lienzo.
- Conectar servicios para representar dependencias.
- Configurar parámetros de servicio (protocolos, recursos, endpoints, clústeres, latencias globales).
- Aplicar patrones de resiliencia mediante interacción visual.
- Exportar la configuración final como `application_description.json` compatible con HydraGen.

## 3. Flujo principal de uso
1. Arrastrar un **Service** al canvas.
2. Conectar servicios entre sí.
3. Editar propiedades del servicio desde el panel lateral.
4. Aplicar patrones de resiliencia (Fallback/Bulkhead/Load Shedding) sobre el servicio.
5. Revisar configuración y exportar JSON.

## 4. Relación Diagrama → Código (explicación técnica detallada)

### 4.1 ¿Qué estructura se usa internamente?
Se usa un **grafo dirigido** (no un árbol de decisión).

- **Nodo (Node)**: representa un servicio de microservicio.
- **Arista (Edge)**: representa una llamada/dependencia entre servicios.
- **Dirección**: importa, porque `A -> B` significa que A llama a B.

### 4.2 ¿Por qué grafo y no árbol?
Se eligió grafo porque la arquitectura de microservicios real:
- Tiene dependencias cruzadas.
- Puede tener múltiples consumidores de un mismo servicio.
- No siempre tiene una jerarquía única padre-hijo.
- Puede formar mallas de comunicación (fan-in/fan-out).

Un **árbol** obliga una sola raíz y relaciones jerárquicas estrictas, lo cual no modela bien este dominio.  
Por eso, para benchmark de microservicios, el modelo correcto es **grafo dirigido**.

### 4.3 ¿Cómo se traduce lo visual al modelo?
Cuando el usuario interactúa en canvas:

1. Arrastra **Service**  
   → `EditorComponent` crea un nodo X6 con `node.data` (nombre, protocolo, recursos, endpoints, resiliencia).

2. Conecta nodos  
   → X6 crea una arista dirigida.  
   → Esa arista representa una dependencia `called_services`.

3. Aplica patrón de resiliencia (FB/BH/LS) sobre un nodo  
   → Se actualiza `node.data.resilience_patterns`.

4. Edita propiedades en panel  
   → Se sincroniza `node.data` del nodo seleccionado.

### 4.4 ¿Cómo se pasa del grafo al JSON HydraGen?
`ExporterService.generateConfig()` hace la transformación en 3 pasos:

- Lee `graph.getNodes()` y construye `services[]`.
- Lee `graph.getEdges()` y mapea cada arista a `called_services` del endpoint.
- Ensambla objeto final `HydraGenConfig` con:
  - `settings`
  - `cluster_latencies`
  - `services`

Finalmente `exportToJson()` serializa el objeto a `application_description.json`.

### 4.5 ¿Para qué sirve esta relación Diagrama→Código?
Sirve para garantizar:
- **Trazabilidad**: cada elemento visual tiene representación técnica.
- **Consistencia**: el JSON exportado refleja lo dibujado.
- **Usabilidad**: se evita edición manual compleja.
- **Reproducibilidad**: un diagrama puede reconstruirse y ejecutarse como benchmark.

En resumen: el diagrama no es decorativo; es la entrada formal del generador.

## 5. Patrones de resiliencia integrados
Los patrones soportados visualmente son:
- **Fallback (FB)**
- **Bulkhead (BH)**
- **Load Shedding (LS)**

Al aplicar un patrón sobre un servicio:
- Se activa en `resilience_patterns` del nodo.
- Se visualiza con badges dentro de la tarjeta del servicio.
- Se conserva en la exportación JSON.

## 6. Criterios de diseño visual (UI/UX)
- Tema oscuro consistente.
- Iconografía monocromática (sin emojis de color).
- Tarjetas de servicio legibles y compactas.
- Controles orientados a tareas clave (Service, Example, Preview, Export JSON).
- Interacción de drag & drop como mecanismo principal.

## 7. Alineación con HydraGen
- El esquema exportado mantiene compatibilidad con `HydraGenConfig`.
- Entidad central: `service`.
- Se preservan settings globales, latencias de clúster y estructura de endpoints.

## 8. Alcance técnico actual
- Frontend Angular standalone.
- Canvas con `@antv/x6`.
- Exportación JSON vía `ExporterService`.
- Carga de ejemplo base desde toolbar.

## 9. Resultado esperado del proyecto
Una interfaz usable para:
- Reducir barrera técnica en generación de benchmarks.
- Mejorar trazabilidad entre diseño de arquitectura y configuración final.
- Servir como apoyo académico para la memoria de grado y demostración del proceso de desarrollo.


