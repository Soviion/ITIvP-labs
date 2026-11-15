// Читает payload JWT (середину токена) только для отображения срока действия.
// Подпись проверяет сервер — клиент токену «не верит» и ничего по нему не решает.
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
