/* Utilidades compartidas de texto y reglas de pregunta (index, question-runner y admin).
 *
 * El PDF de origen contiene secuencias UTF-8 mal decodificadas ("mojibake"), p. ej.
 * una viñeta "•" (E2 80 A2) aparece como  ג € ¢  y los guiones/comillas inteligentes
 * como  ג € "  /  ג € .  Según cómo pdf.js agrupe los fragmentos, entre "ג" y "€"
 * puede haber espacios o marcas bidireccionales invisibles (U+202B/U+202C).
 * Las reglas van de lo más específico a lo más general.
 */
(function (root) {
    'use strict';

    var BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;

    // Corrige el mojibake sin tocar saltos de línea ni espacios (los bloques de código dependen de ellos).
    function fixMojibake(str) {
        if (!str) return '';
        return String(str)
            .replace(BIDI_CONTROLS, '')
            // Guion que el texto RTL dejó invertido ("€ג) y desplazado tras los dígitos:
            .replace(/([A-Za-z])(\d+)\s*"\s*€\s*ג(?:\s*(?=[.,;:)]))?/g, '$1-$2')         // highmem16 "€ג  -> highmem-16
            .replace(/(\d[\d:]*)\s+(\d[\d:]*)\s*"\s*€\s*\)\s*ג/g, '$1-$2)')              // 365 90 "€)ג  -> 365-90)
            .replace(/(\d[\d:]*)\s+(\d[\d:]*)\s*"\s*€\s*ג(?:\s*(?=[.,;:)]))?/g, '$1-$2') // 365 90 "€ג    -> 365-90
            .replace(/\s*"\s*€\s*ג/g, '')                                // resto: ruido irrecuperable, se descarta
            .replace(/ג\s*€\s*¢/g, '•')              // viñeta
            .replace(/\s*ג\s*€\s*[\"“”](?=\S)/g, '-') // guion pegado (us-central1, --preview)
            .replace(/ג\s*€\s*[\"“”]/g, '-')         // guion de lista (\" - \")
            .replace(/ג\s*€\s*[™’]/g, "'")  // apóstrofo
            .replace(/ג\s*€\s*[œ?]/g, '"')            // comilla de apertura
            .replace(/\s*ג\s*€(?=[\s.,;:)\]]|$)/g, '"') // comilla de cierre (pega al texto previo)
            .replace(/ג\s*€/g, '"')                   // comilla de apertura (resto)
            .replace(/"\s*€/g, '"');                  // resto "€ sin la "ג"
    }

    // Limpieza completa para texto de una sola línea (opciones, texto de pregunta ya aplanado).
    function cleanOcrText(str) {
        if (!str) return '';
        return fixMojibake(str)
            .replace(/`"/g, '"')
            .replace(/“/g, '"')
            .replace(/”/g, '"')
            .replace(/’/g, "'")
            .replace(/‘/g, "'")
            .replace(/`'/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Quita el encabezado que queda al inicio del bloque de cada pregunta:
    // el número de pregunta ("265") y la línea "Topic 1" de ExamTopics.
    function stripQuestionHeader(text, id) {
        var s = String(text || '');
        if (id != null && !isNaN(Number(id))) {
            s = s.replace(new RegExp('^\\s*' + Number(id) + '(?=\\s|$)'), '');
        }
        return s.replace(/^\s*Topic\s*\d+\s*/i, '').trim();
    }

    // Texto de pregunta listo para mostrar: corrige mojibake y quita el encabezado.
    // Conserva los saltos de línea (formatQuestionText los usa para detectar bloques de código).
    function cleanQuestionText(text, id) {
        return stripQuestionHeader(fixMojibake(text), id);
    }

    // Normaliza una lista de preguntas ya parseadas (también las cacheadas en localStorage).
    // Verificado sobre kahoot.pdf: aplicarla dos veces da el mismo resultado.
    function sanitizeQuestions(list) {
        return (Array.isArray(list) ? list : []).map(function (q) {
            var options = {};
            Object.keys(q.options || {}).forEach(function (k) { options[k] = cleanOcrText(q.options[k]); });
            return Object.assign({}, q, { question: cleanQuestionText(q.question, q.id), options: options });
        });
    }

    // Regla de selección: cuántas opciones pide la pregunta ("Choose two", "Select all that apply"...).
    // Devuelve { isMultiple, required } sin mutar la pregunta.
    function getSelectionRule(questionText, optionCount) {
        var txt = String(questionText || '').toLowerCase();
        var words = { one: 1, two: 2, three: 3, four: 4, five: 5, both: 2 };
        var match = txt.match(/\b(?:choose|select)\s+(one|two|three|four|five|both|\d+)\b/);
        var required = 1;
        if (match) {
            required = words[match[1]] || parseInt(match[1], 10) || 1;
        } else if (/(?:select|choose) all that apply/.test(txt)) {
            required = optionCount;
        }
        required = Math.max(1, Math.min(required, optionCount));
        return { isMultiple: required > 1, required: required };
    }

    root.fixMojibake = fixMojibake;
    root.cleanOcrText = cleanOcrText;
    root.stripQuestionHeader = stripQuestionHeader;
    root.cleanQuestionText = cleanQuestionText;
    root.sanitizeQuestions = sanitizeQuestions;
    root.getSelectionRule = getSelectionRule;
})(typeof window !== 'undefined' ? window : globalThis);
