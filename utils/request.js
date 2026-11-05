const ApiError = require('./ApiError');

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Некорректная ссылка на запись');
  }
  return id;
}


function getBody(req) {
  const body = req.body;
  if (body === undefined) return {};
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Не удалось прочитать отправленные данные');
  }
  return body;
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

module.exports = { parseId, getBody, pick };
