// Лист A4 на экране и его печать. Один и тот же приём для карты и для направления:
// печатаем копию листа, вынесенную в #print-root, а всё остальное приложение на время печати скрыто (см. doctor.css).

export function PrintSheet({ id, children, className = '' }) {
  return (
    <div className={`print-area ${className}`.trim()} data-sheet={id}>
      <article className="doc-sheet">{children}</article>
    </div>
  );
}
