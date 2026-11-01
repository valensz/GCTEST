/* Parser de la base de preguntas (texto extraído con pdf.js).
 * Requiere que `pdfjsLib` esté cargado y que text-utils.js se haya cargado antes.
 * Lo usan index.html (app.js) y admin.html.
 */
(function (root) {
    'use strict';

    // Opciones: el marcador "A. " debe venir precedido de espacio o salto de línea.
    var OPTION_MARKERS = {
        A: /[\r\n\s]+A\.\s+/,
        B: /[\r\n\s]+B\.\s+/,
        C: /[\r\n\s]+C\.\s+/,
        D: /[\r\n\s]+D\.\s+/,
        E: /[\r\n\s]+E\.\s+/
    };

    // Extrae el texto de todas las páginas y llama onProgress(page, total, textoAcumulado).
    async function extractFullText(arrayBuffer, onProgress) {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            let lastY = null;
            let pageText = '';
            for (const item of textContent.items) {
                const currentY = item.transform[5];
                // Reconstruye el layout: un cambio vertical grande equivale a un salto de línea
                if (lastY !== null && Math.abs(currentY - lastY) > 8) {
                    pageText += '\n';
                }
                pageText += item.str + ' ';
                lastY = currentY;
            }

            fullText += `\n\n--- PAGE ${i} ---\n\n` + pageText;
            if (onProgress) onProgress(i, numPages, fullText);
        }
        return fullText;
    }

    // Convierte el bloque de texto de una pregunta en un objeto, o null si está incompleto.
    function parseQuestionBlock(part) {
        const numMatch = part.match(/^(\d+)/);
        if (!numMatch) return null;
        const qId = parseInt(numMatch[1], 10);

        const ansIndex = part.search(/Correct\s+Answer\s*:/i);
        if (ansIndex === -1) return null;

        const bodyAndOptions = part.substring(0, ansIndex).trim();
        const answerAndVotes = part.substring(ansIndex).trim();

        const ansMatch = answerAndVotes.match(/Correct\s+Answer\s*:\s*([A-E]+)/i);
        if (!ansMatch) return null; // sin respuesta correcta no se puede jugar
        const correctAnswer = ansMatch[1].trim().toUpperCase();

        const idx = {};
        Object.keys(OPTION_MARKERS).forEach(letter => {
            idx[letter] = bodyAndOptions.search(OPTION_MARKERS[letter]);
        });
        if (idx.A === -1 || idx.B === -1 || idx.C === -1 || idx.D === -1) return null;

        // El texto de la pregunta va antes de la opción A
        const questionText = cleanQuestionText(bodyAndOptions.substring(0, idx.A), qId);

        // Cada opción llega hasta el marcador de la siguiente
        const slice = (from, to) => bodyAndOptions.substring(from, to)
            .replace(/^[\r\n\s]*[A-E]\.\s+/, '').trim();
        const options = {
            A: slice(idx.A, idx.B),
            B: slice(idx.B, idx.C),
            C: slice(idx.C, idx.D),
            D: idx.E !== -1 ? slice(idx.D, idx.E) : slice(idx.D)
        };
        if (idx.E !== -1) options.E = slice(idx.E);

        // Votos de la comunidad (si el PDF los trae)
        const votes = {};
        const voteIndex = answerAndVotes.search(/Community\s+vote\s+distribution/i);
        if (voteIndex !== -1) {
            const voteStr = answerAndVotes.substring(voteIndex);
            for (const match of voteStr.matchAll(/([A-E])\s*\((\d+)%\)/gi)) {
                votes[match[1].toUpperCase()] = parseInt(match[2], 10);
            }
        }

        // Limpia cada opción de una sola línea; la E solo existe si tiene texto
        Object.keys(options).forEach(letter => { options[letter] = cleanOcrText(options[letter]); });
        if (!options.E) delete options.E;

        return { id: qId, question: questionText, options, answer: correctAnswer, votes };
    }

    // Parser principal: devuelve la lista de preguntas válidas del PDF.
    async function parsePdfContent(arrayBuffer, onProgress) {
        const fullText = await extractFullText(arrayBuffer, onProgress);

        // Cada bloque empieza tras "Question #"
        const parts = fullText.split(/Question\s+#/i);
        const parsedQuestions = [];

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;
            try {
                const question = parseQuestionBlock(part);
                if (question) parsedQuestions.push(question);
            } catch (e) {
                console.error('Error parsing question block', i, e);
            }
        }
        return parsedQuestions;
    }

    root.parsePdfContent = parsePdfContent;
})(typeof window !== 'undefined' ? window : globalThis);
