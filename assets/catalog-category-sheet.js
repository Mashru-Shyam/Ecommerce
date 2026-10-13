const drawer = document.getElementById('filters-drawer');

if (drawer && !drawer.dataset.categorySheetReady) {
  drawer.dataset.categorySheetReady = 'true';

  const applyButton = drawer.querySelector('[data-catalog-apply-filters]');
  const clearButton = drawer.querySelector('[data-catalog-clear-all]');
  const categoryLinks = () => Array.from(drawer.querySelectorAll('.catalog-category'));
  const activeCategory = () => categoryLinks().find((link) => link.classList.contains('is-active'));
  const pendingCategory = () => categoryLinks().find((link) => link.href === drawer.dataset.pendingCategory) || activeCategory();
  const activeFilterCount = () => Number(drawer.dataset.appliedFilterCount ?? drawer.querySelector('#filters-drawer-bubble')?.textContent.trim()) || 0;

  const updateControls = () => {
    const active = activeCategory();
    const pending = pendingCategory();
    const categoryChanged = Boolean(pending && active && pending.href !== active.href);
    const filtersChanged = drawer.dataset.filtersDirty === 'true';
    const triggerCategory = drawer.querySelector('.facets-toggle__button [data-active-category-label]');
    if (triggerCategory) {
      const activeName = active?.querySelector('.catalog-category__name')?.textContent.trim() || '';
      triggerCategory.textContent = activeName;
      triggerCategory.hidden = !activeName;
    }
    if (applyButton) applyButton.disabled = !(categoryChanged || filtersChanged);
    if (clearButton) clearButton.disabled = (!active || active.classList.contains('catalog-category--all')) && activeFilterCount() === 0;
  };

  const setPendingCategory = (link) => {
    if (!link) return;
    drawer.dataset.pendingCategory = link.href;
    categoryLinks().forEach((categoryLink) => {
      categoryLink.classList.toggle('is-pending', categoryLink.href === link.href);
    });
    updateControls();
  };

  drawer.addEventListener('theme-drawer:open', () => {
    drawer.dataset.pendingCategory = activeCategory()?.href || '';
    delete drawer.dataset.filtersDirty;
    categoryLinks().forEach((link) => link.classList.remove('is-pending'));
    updateControls();
  });

  drawer.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const categoryLink = event.target.closest('.catalog-category');
    if (categoryLink && window.matchMedia('(max-width: 749px)').matches) {
      event.preventDefault();
      setPendingCategory(categoryLink);
      return;
    }

    const clear = event.target.closest('[data-catalog-clear-all]');
    if (clear) {
      event.preventDefault();
      if (clear.disabled) return;

      const url = new URL(window.location.href);
      const root = window.Shopify?.routes?.root || '/';
      const isSearch = url.pathname === `${root}search` || url.pathname.endsWith('/search');
      for (const key of [...url.searchParams.keys()]) {
        if (key.startsWith('filter.') || key === 'page' || key === 'catalog_page') url.searchParams.delete(key);
      }

      if (isSearch) {
        url.pathname = `${root}search`;
        url.searchParams.set('catalog_category', 'all');
      } else {
        url.pathname = `${root}collections/all`;
      }

      window.location.assign(url.toString());
      return;
    }

    const apply = event.target.closest('[data-catalog-apply-filters]');
    if (!apply || apply.disabled) return;
    event.preventDefault();

    const pending = pendingCategory();
    const active = activeCategory();
    if (pending && active && pending.href !== active.href) {
      const formComponent = drawer.querySelector('facets-form-component');
      const form = formComponent?.querySelector('form');
      const targetUrl = new URL(pending.href, window.location.href);
      if (formComponent && form) {
        const parameters = formComponent.createURLParameters(new FormData(form));
        parameters.delete('q');
        targetUrl.search = parameters.toString();
      }
      window.location.assign(targetUrl.toString());
      return;
    }

    const formComponent = drawer.querySelector('facets-form-component');
    if (formComponent && typeof formComponent.updateFilters === 'function') {
      formComponent.updateFilters({ applyDraft: true });
    }
    delete drawer.dataset.filtersDirty;
    drawer.close();
  });

  const markFiltersDirty = (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.facets--drawer')) return;
    if (!event.target.matches('input, select')) return;
    drawer.dataset.filtersDirty = 'true';
    updateControls();
  };
  drawer.addEventListener('change', markFiltersDirty);
  drawer.addEventListener('input', markFiltersDirty);

  const syncAppliedFilters = (event) => {
    const sourceSection = event.target instanceof Element ? event.target.closest('.shopify-section') : null;
    if (sourceSection && sourceSection !== drawer.closest('.shopify-section')) return;
    const filters = event.search?.productFilters ?? event.productFilters ?? [];
    drawer.dataset.appliedFilterCount = String(filters.length);
    updateControls();
  };
  document.addEventListener('shopify:collection:update', syncAppliedFilters);
  document.addEventListener('shopify:search:update', syncAppliedFilters);

  const categoryObserver = new MutationObserver(updateControls);
  categoryObserver.observe(drawer, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  updateControls();
}
