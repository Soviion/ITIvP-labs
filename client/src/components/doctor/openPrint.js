// Открывает системное окно печати (очередь принтеров ОС) для листа с data-sheet="id"
export async function printSheet(id) {
  const source = document.querySelector(`[data-sheet="${id}"]`);
  if (!source) return false;

  const root = document.createElement('div');
  root.id = 'print-root';
  root.append(source.cloneNode(true));
  root.querySelectorAll('details').forEach((block) => { block.open = true; }); // в печати приёмы и направления развёрнуты
  document.body.append(root);
  document.body.classList.add('is-printing-doc');

  const cleanup = () => {
    document.body.classList.remove('is-printing-doc');
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // фото должно успеть отрисоваться, иначе в печать попадёт пустая рамка
  await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {})));
  window.print();
  return true;
}
