document.querySelectorAll('.header-search').forEach((form) => {
  const input = form.querySelector('input[name="q"]');
  const clearButton = form.querySelector('.header-search__clear');
  if (!(input instanceof HTMLInputElement) || !(clearButton instanceof HTMLButtonElement)) return;

  const syncClearButton = () => {
    clearButton.hidden = input.value.trim().length === 0;
  };

  input.addEventListener('input', syncClearButton);
  clearButton.addEventListener('click', () => {
    input.value = '';
    syncClearButton();

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('q');
    currentUrl.searchParams.delete('catalog_category');

    if (currentUrl.pathname.endsWith('/search')) {
      window.location.assign(form.action);
      return;
    }

    window.history.replaceState(window.history.state, '', currentUrl.toString());
    input.focus();
  });
});
