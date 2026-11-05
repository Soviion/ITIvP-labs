// Ссылка «Перейти к основному содержимому» (WCAG 2.4.1). Стоит первой на странице: клавиатурный пользователь
// и скринридер одним нажатием пропускают шапку и меню. Сайт — SPA, поэтому вместо перехода по #якорю
// (его перехватил бы роутер) переводим фокус на <main id="main-content"> сами
export default function SkipLink() {
  function skip(event) {
    const target = document.getElementById('main-content');
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.scrollIntoView();
  }

  return <a className="skip-link" href="#main-content" onClick={skip}>Перейти к основному содержимому</a>;
}
