const getDrawer = () => document.getElementById('filters-drawer');
const categoryLinks = (drawer) => Array.from(drawer?.querySelectorAll('.catalog-category') || []);
const activeCategory = (drawer) => categoryLinks(drawer).find((link) => link.classList.contains('is-active'));
const pendingCategory = (drawer) =>
  categoryLinks(drawer).find((link) => link.href === drawer.dataset.pendingCategory) || activeCategory(drawer);
const activeFilterCount = (drawer) =>
  Number(drawer.dataset.appliedFilterCount ?? drawer.querySelector('#filters-drawer-bubble')?.textContent.trim()) || 0;

const updateControls = () => {
  const drawer = getDrawer();
  if (!drawer) return;

  const active = activeCategory(drawer);
  const pending = pendingCategory(drawer);
  const categoryChanged = Boolean(pending && active && pending.href !== active.href);
  const filtersChanged = drawer.dataset.filtersDirty === 'true';
  const applyButton = drawer.querySelector('[data-catalog-apply-filters]');
  const clearButton = drawer.querySelector('[data-catalog-clear-all]');
  const triggerCategory = drawer.querySelector('.facets-toggle__button [data-active-category-label]');
  const triggerLabel = drawer.querySelector('.facets-toggle__button .facets-toggle__label');

  categoryLinks(drawer).forEach((link) => {
    link.classList.toggle('is-pending', Boolean(categoryChanged && pending && link.href === pending.href));
  });
  drawer.classList.toggle('has-pending-category', categoryChanged);
  if (triggerCategory) {
    const activeName = active?.querySelector('.catalog-category__name')?.textContent.trim() || '';
    triggerCategory.textContent = activeName;
    triggerCategory.hidden = !activeName;
    if (triggerLabel) triggerLabel.hidden = Boolean(activeName);
  }
  if (applyButton) applyButton.disabled = !(categoryChanged || filtersChanged);
  if (clearButton) clearButton.disabled = (!active || active.classList.contains('catalog-category--all')) && activeFilterCount(drawer) === 0;
};

const setPendingCategory = (drawer, selectedLink) => {
  if (!drawer || !selectedLink) return;

  drawer.dataset.pendingCategory = selectedLink.href;
  categoryLinks(drawer).forEach((link) => {
    link.classList.toggle('is-pending', link.href === selectedLink.href);
  });
  updateControls();
};

document.addEventListener('theme-drawer:open', (event) => {
  const drawer = event.target instanceof Element ? event.target.closest('#filters-drawer') : null;
  if (!drawer) return;

  drawer.dataset.pendingCategory = activeCategory(drawer)?.href || '';
  delete drawer.dataset.filtersDirty;
  categoryLinks(drawer).forEach((link) => link.classList.remove('is-pending'));
  updateControls();
}, true);

// Capture mobile category taps before the collection's desktop navigation handler.
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const drawer = getDrawer();
  if (!drawer) return;

  const categoryLink = event.target.closest('#filters-drawer .catalog-category');
  if (categoryLink && window.matchMedia('(max-width: 749px)').matches) {
    event.preventDefault();
    setPendingCategory(drawer, categoryLink);
    return;
  }

  const clear = event.target.closest('#filters-drawer [data-catalog-clear-all]');
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
      url.searchParams.delete('catalog_category');
    } else {
      url.pathname = `${root}collections/all`;
    }

    window.location.assign(url.toString());
    return;
  }

  const apply = event.target.closest('#filters-drawer [data-catalog-apply-filters]');
  if (!apply) return;
  event.preventDefault();
  if (apply.disabled) return;

  const pending = pendingCategory(drawer);
  const active = activeCategory(drawer);
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
}, true);

const markFiltersDirty = (event) => {
  if (!(event.target instanceof Element) || !event.target.matches('input, select')) return;
  const drawer = event.target.closest('#filters-drawer');
  if (!drawer || !event.target.closest('.facets--drawer')) return;
  drawer.dataset.filtersDirty = 'true';
  updateControls();
};
document.addEventListener('change', markFiltersDirty);
document.addEventListener('input', markFiltersDirty);

const syncAppliedFilters = (event) => {
  const drawer = getDrawer();
  if (!drawer) return;
  const sourceSection = event.target instanceof Element ? event.target.closest('.shopify-section') : null;
  if (sourceSection && sourceSection !== drawer.closest('.shopify-section')) return;
  const filters = event.search?.productFilters ?? event.productFilters ?? [];
  drawer.dataset.appliedFilterCount = String(filters.length);
  updateControls();
};
document.addEventListener('shopify:collection:update', syncAppliedFilters);
document.addEventListener('shopify:search:update', syncAppliedFilters);

const drawerObserver = new MutationObserver(() => {
  const currentDrawer = getDrawer();
  if (!currentDrawer) return;
  updateControls();
});
drawerObserver.observe(document.documentElement, { childList: true, subtree: true });
updateControls();
