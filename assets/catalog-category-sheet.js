const drawer = document.getElementById('filters-drawer');

if (drawer && !drawer.dataset.categorySheetReady) {
  drawer.dataset.categorySheetReady = 'true';

  const applyButton = drawer.querySelector('[data-catalog-category-apply]');
  const categoryLinks = () => Array.from(drawer.querySelectorAll('.catalog-category'));

  const setPendingCategory = (link) => {
    if (!link || !applyButton) return;
    drawer.dataset.pendingCategory = link.href;
    categoryLinks().forEach((categoryLink) => {
      categoryLink.classList.toggle('is-pending', categoryLink.href === link.href);
    });
    applyButton.disabled = false;
  };

  drawer.addEventListener('theme-drawer:open', () => {
    const activeLink = categoryLinks().find((link) => link.classList.contains('is-active'));
    if (activeLink && !drawer.dataset.pendingCategory) setPendingCategory(activeLink);
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const categoryLink = event.target.closest('#filters-drawer .catalog-category');
    if (categoryLink && window.matchMedia('(max-width: 749px)').matches && !drawer.dataset.applyingCategory) {
      event.preventDefault();
      setPendingCategory(categoryLink);
      return;
    }

    const apply = event.target.closest('#filters-drawer [data-catalog-category-apply]');
    if (!apply || !drawer.dataset.pendingCategory) return;

    const selectedLink = categoryLinks().find((link) => link.href === drawer.dataset.pendingCategory);
    if (!selectedLink) return;

    event.preventDefault();
    drawer.dataset.applyingCategory = 'true';
    selectedLink.click();
    window.setTimeout(() => delete drawer.dataset.applyingCategory, 0);
  });

  drawer.addEventListener('theme-drawer:close', () => {
    delete drawer.dataset.pendingCategory;
    delete drawer.dataset.applyingCategory;
    categoryLinks().forEach((link) => link.classList.remove('is-pending'));
    if (applyButton) applyButton.disabled = true;
  });
}
