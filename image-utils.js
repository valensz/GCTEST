/* Imágenes de referencia de preguntas (carpeta Images/).
 * Los archivos del repo se llaman "Question #N.png"; la pregunta 98 usa "98 Reesponse D.png".
 * Lo usan index.html (app.js), question-runner.html y admin.html.
 */
(function (root) {
    'use strict';

    var EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
    var cache = new Map();

    function encodeImagePath(url) {
        return url.split('/').map(function (part) { return encodeURIComponent(part); }).join('/');
    }

    function imageUrlExists(url) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () { resolve(true); };
            img.onerror = function () { resolve(false); };
            img.src = url;
        });
    }

    // Nombres base (sin extensión) donde buscar la imagen de una pregunta
    function candidateBases(questionId) {
        var n = Number(questionId);
        var bases = [];
        if (n === 98) bases.push('Images/98 Reesponse D');
        bases.push('Images/Question #' + n);
        return bases;
    }

    // Devuelve la URL codificada de la imagen, o null si no existe. Cachea el resultado.
    async function resolveReferenceImageUrl(questionId) {
        if (cache.has(questionId)) return cache.get(questionId);

        var found = null;
        var bases = candidateBases(questionId);
        for (var b = 0; b < bases.length && !found; b++) {
            for (var e = 0; e < EXTENSIONS.length && !found; e++) {
                var encoded = encodeImagePath(bases[b] + '.' + EXTENSIONS[e]);
                if (await imageUrlExists(encoded)) found = encoded;
            }
        }
        cache.set(questionId, found);
        return found;
    }

    root.encodeImagePath = encodeImagePath;
    root.resolveReferenceImageUrl = resolveReferenceImageUrl;
})(typeof window !== 'undefined' ? window : globalThis);
