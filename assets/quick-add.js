import { Component } from '@theme/component';
import { morph } from '@theme/morph';
import { DialogComponent, DialogCloseEvent } from '@theme/dialog';
import { mediaQueryLarge, isMobileBreakpoint, getIOSVersion } from '@theme/utilities';
import VariantPicker from '@theme/variant-picker';
import { StandardEvents, ProductSelectEvent, CartLinesUpdateEvent } from '@shopify/events';

export class QuickAddComponent extends Component {
  /** @type {AbortController | null} */
  #abortController = null;
  /** @type {Map<string, Element>} */
  #cachedContent = new Map();
  /** @type {AbortController} */
  #cartUpdateAbortController = new AbortController();
  #cartActionPending = false;
  #addedAnimationTimeout = null;

  get productPageUrl() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    if (productCard) return productCard.productPageUrl;

    const hotspotProduct = /** @type {import('./product-hotspot').ProductHotspotComponent | null} */ (
      this.closest('product-hotspot-component')
    );
    const productLink = hotspotProduct?.getHotspotProductLink();

    return productLink?.href || '';
  }

  /**
   * Gets the currently selected variant ID from the product card
   * @returns {string | null} The variant ID or null
   */
  #getSelectedVariantId() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    return productCard?.getSelectedVariantId() ?? null;
  }

  connectedCallback() {
    super.connectedCallback();

    mediaQueryLarge.addEventListener('change', this.#closeQuickAddModal);
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartUpdate, {
      signal: this.#cartUpdateAbortController.signal,
    });
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#syncCardCartState, {
      signal: this.#cartUpdateAbortController.signal,
    });
    document.addEventListener(StandardEvents.productSelect, this.#handleProductSelectUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    mediaQueryLarge.removeEventListener('change', this.#closeQuickAddModal);
    this.#abortController?.abort();
    this.#cartUpdateAbortController.abort();
    if (this.#addedAnimationTimeout) clearTimeout(this.#addedAnimationTimeout);
    document.removeEventListener(StandardEvents.productSelect, this.#handleProductSelectUpdate);
  }

  /**
   * Updates quick-add button state when product variant is selected
   * @param {ProductSelectEvent} event - The product select event
   */
  #handleProductSelectUpdate = (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest('product-card') !== this.closest('product-card')) return;
    if (this.dataset.usesSellingPlans === 'true') return;

    const selectedForm = event.detail?.html?.querySelector('product-form-component');
    const selectedPrice = Number(event.detail?.resource?.price ?? selectedForm?.dataset.cartUnitPrice);
    const productForm = this.querySelector('product-form-component');
    if (Number.isFinite(selectedPrice) && productForm) {
      productForm.dataset.cartUnitPrice = String(selectedPrice);
    }

    const selectedVariantId = this.#getSelectedVariantId();
    const cartVariantId = this.dataset.cartVariantId;
    if (selectedVariantId && String(selectedVariantId).split('/').pop() !== cartVariantId) {
      const normalizedVariantId = String(selectedVariantId).split('/').pop();
      const variantInput = this.querySelector('input[name="id"]');
      if (variantInput instanceof HTMLInputElement) {
        variantInput.value = normalizedVariantId;
        variantInput.disabled = this.#isSelectedVariantUnavailable();
      }
      this.dataset.cartVariantId = normalizedVariantId;
      this.dataset.cartQuantity = '0';
      this.#setInCartState(0);
      fetch(`${Theme.routes.cart_url}.js`, { credentials: 'same-origin' })
        .then((response) => response.json())
        .then((cart) => {
          const quantity = (cart.items || [])
            .filter((item) => String(item.variant_id) === normalizedVariantId)
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          this.dataset.cartVariantId = normalizedVariantId;
          this.dataset.cartQuantity = String(quantity);
          const count = this.querySelector('.quick-add__cart-count');
          if (count) count.textContent = String(quantity);
          this.#setInCartState(quantity);
        })
        .catch((error) => console.warn('[quick-add] Could not sync selected variant:', error));
    }
  };

  /**
   * Whether the card's currently selected swatch maps to an unavailable variant.
   * Reads `data-option-available` off the variant picker's selected option - the same
   * signal the product card uses. Only reports true on an explicit `false`, so an
   * unknown/absent signal leaves the caller's default ("add") untouched.
   * @returns {boolean}
   */
  #isSelectedVariantUnavailable() {
    const productCard = /** @type {import('./product-card').ProductCard | null} */ (this.closest('product-card'));
    return productCard?.variantPicker?.selectedOption?.dataset.optionAvailable === 'false';
  }

  /**
   * Clears the cached content when cart is updated
   */
  #handleCartUpdate = () => {
    this.#cachedContent.clear();
  };

  /** @param {import('@shopify/events').CartLinesUpdateEvent} event */
  #syncCardCartState = (event) => {
    const detail = event.detail || {};
    const normalizedProductId = String(detail.productId || '').split('/').pop();
    const isThisProduct = normalizedProductId && normalizedProductId === String(this.dataset.productId).split('/').pop();
    const eventLines = event.lines || detail.lines || [];
    const eventLine = Array.isArray(eventLines) ? eventLines[0] : null;
    const merchandiseId = eventLine?.merchandiseId || eventLine?.variantId || eventLine?.variant_id;
    const eventVariantId = merchandiseId ? String(merchandiseId).split('/').pop() : '';

    if (event.action === 'add' && eventVariantId === this.dataset.cartVariantId) {
      const addedQuantity = Number(eventLine?.quantity) || 1;
      const currentQuantity = Number(this.dataset.cartQuantity) || 0;
      const optimisticQuantity = currentQuantity + addedQuantity;
      this.dataset.cartQuantity = String(optimisticQuantity);
      const count = this.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(optimisticQuantity);
      this.#setInCartState(optimisticQuantity);
    }

    event.promise?.then(({ detail: resultDetail }) => {
      const items = resultDetail?.items;
      if (!Array.isArray(items)) return;

      let variantId = this.dataset.cartVariantId || '';
      if (isThisProduct && eventVariantId) variantId = eventVariantId;
      if (!variantId && normalizedProductId === String(this.dataset.productId).split('/').pop()) {
        const productItem = items.find((item) => String(item.product_id) === String(this.dataset.productId));
        if (productItem) variantId = String(productItem.variant_id);
      }
      if (!variantId) return;

      const matches = items.filter((item) => String(item.variant_id) === variantId);
      const quantity = matches.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      this.dataset.cartVariantId = variantId;
      this.dataset.cartLineKey = matches[0]?.key || '';
      this.dataset.cartQuantity = String(quantity);

      const count = this.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(quantity);

      this.#setInCartState(quantity);
    }).catch((error) => {
      if (error?.name !== 'AbortError') console.warn('[quick-add] Cart state sync failed:', error);
    });
  };

  #setInCartState(quantity) {
    this.dataset.inCart = quantity > 0 ? 'true' : 'false';
    this.setAttribute('data-in-cart', quantity > 0 ? 'true' : 'false');
    const controls = this.querySelector('.quick-add__cart-controls');
    if (controls) controls.hidden = quantity <= 0;
    this.dataset.cartQuantity = String(quantity);
  }

  /** @param {number} delta */
  async #changeCartQuantity(delta) {
    if (this.#cartActionPending) return;
    const variantId = this.dataset.cartVariantId;
    if (!variantId) return;
    const previousQuantity = Number(this.dataset.cartQuantity) || 0;
    const optimisticQuantity = Math.max(0, previousQuantity + delta);
    const optimisticCount = this.querySelector('.quick-add__cart-count');
    if (optimisticCount) optimisticCount.textContent = String(optimisticQuantity);
    this.#setInCartState(optimisticQuantity);
    const unitPrice = Number(this.querySelector('product-form-component')?.dataset.cartUnitPrice);
    document.dispatchEvent(new CustomEvent('freshomill:cart-optimistic', {
      detail: {
        itemCountDelta: delta,
        totalPriceDelta: Number.isFinite(unitPrice) ? unitPrice * delta : 0,
      },
    }));
    this.#cartActionPending = true;
    this.toggleAttribute('aria-busy', true);

    let pendingUpdatePromise = null;
    try {
      const cartResponse = await fetch(`${Theme.routes.cart_url}.js`, { credentials: 'same-origin' });
      if (!cartResponse.ok) throw new Error(`Cart request failed (${cartResponse.status})`);
      const cart = await cartResponse.json();
      const matchingLines = (cart.items || []).filter((item) => String(item.variant_id) === variantId);
      const line = matchingLines[0];
      if (!line?.key) {
        const count = this.querySelector('.quick-add__cart-count');
        if (count) count.textContent = String(previousQuantity);
        this.#setInCartState(previousQuantity);
        return;
      }

      const nextLineQuantity = Math.max(0, (Number(line.quantity) || 0) + delta);
      const sectionIds = [...document.querySelectorAll('cart-items-component[data-section-id]')]
        .map((element) => element.dataset.sectionId)
        .filter(Boolean);
      /** @type {Record<string, unknown>} */
      const changePayload = { id: line.key, quantity: nextLineQuantity };
      if (sectionIds.length) {
        changePayload.sections = sectionIds.join(',');
        changePayload.sections_url = window.location.pathname;
      }
      const updatePromise = CartLinesUpdateEvent.createPromise();
      pendingUpdatePromise = updatePromise;
      this.dispatchEvent(new CartLinesUpdateEvent({
        action: nextLineQuantity > 0 ? 'update' : 'remove',
        context: 'cart',
        productId: this.dataset.productId,
        lines: [{ id: line.key, variantId, merchandiseId: `gid://shopify/ProductVariant/${variantId}`, quantity: nextLineQuantity }],
        promise: updatePromise.promise,
      }));

      const updateResponse = await fetch(Theme.routes.cart_change_url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(changePayload),
      });
      if (!updateResponse.ok) throw new Error(`Cart update failed (${updateResponse.status})`);
      const updatedCart = await updateResponse.json();
      updatePromise.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(updatedCart),
        detail: {
          items: updatedCart.items,
          sections: updatedCart.sections,
          itemCount: updatedCart.item_count,
          source: 'quick-add-component',
          didError: false,
        },
      });
      const actualQuantity = (updatedCart.items || [])
        .filter((item) => String(item.variant_id) === variantId)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      this.dataset.cartQuantity = String(actualQuantity);
      const count = this.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(actualQuantity);
      this.#setInCartState(actualQuantity);
    } catch (error) {
      pendingUpdatePromise?.reject(error);
      const count = this.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(previousQuantity);
      this.#setInCartState(previousQuantity);
      console.error('[quick-add] Could not update cart quantity:', error);
    } finally {
      this.#cartActionPending = false;
      this.removeAttribute('aria-busy');
    }
  }

  increaseCartQuantity = (event) => {
    event.preventDefault();
    this.#changeCartQuantity(1);
  };

  decreaseCartQuantity = (event) => {
    event.preventDefault();
    this.#changeCartQuantity(-1);
  };

  /**
   * Re-renders the variant picker in the quick-add modal.
   * @param {Element} newHtml - The element to re-render.
   */
  #updateVariantPicker(newHtml) {
    const modalContent = document.getElementById('quick-add-modal-content');
    if (!modalContent) return;
    const variantPicker = /** @type {VariantPicker | null} */ (modalContent.querySelector('variant-picker'));
    if (!variantPicker) return;
    variantPicker.updateVariantPicker(newHtml);
  }

  /**
   * Handles quick add button click
   * @param {Event} event - The click event
   */
  handleClick = async (event) => {
    event.preventDefault();

    return this.openQuickAddModal();
  };

  openQuickAddModal = async () => {
    const currentUrl = this.productPageUrl;
    const modalContent = document.getElementById('quick-add-modal-content');
    this.#openQuickAddModal();
    if (modalContent) {
      modalContent.replaceChildren();
      modalContent.dataset.productUrl = currentUrl;
      modalContent.setAttribute('aria-busy', 'true');
    }

    // Check if we have cached content for this URL
    let productGrid = this.#cachedContent.get(currentUrl);

    try {
      if (!productGrid) {
        // Fetch and cache the content
        const html = await this.fetchProductPage(currentUrl);
        if (html) {
          const gridElement = html.querySelector('[data-product-grid-content]');
          if (gridElement) {
            // Cache the cloned element to avoid modifying the original
            productGrid = /** @type {Element} */ (gridElement.cloneNode(true));
            this.#cachedContent.set(currentUrl, productGrid);
          }
        }
      }

      if (productGrid && modalContent?.dataset.productUrl === currentUrl) {
        // Use a fresh clone from the cache
        const freshContent = /** @type {Element} */ (productGrid.cloneNode(true));
        await this.updateQuickAddModal(freshContent);
        this.#updateVariantPicker(productGrid);
      }
    } finally {
      if (modalContent?.dataset.productUrl === currentUrl) {
        modalContent.removeAttribute('aria-busy');
      }
    }
  };

  #resetScroll() {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    const productDetails = dialogComponent.querySelector('.product-details');
    const productMedia = dialogComponent.querySelector('.product-information__media');
    productDetails?.scrollTo({ top: 0, behavior: 'instant' });
    productMedia?.scrollTo({ top: 0, behavior: 'instant' });
  }

  /** @param {QuickAddDialog} dialogComponent */
  #stayVisibleUntilDialogCloses(dialogComponent) {
    this.toggleAttribute('stay-visible', true);

    dialogComponent.addEventListener(DialogCloseEvent.eventName, () => this.toggleAttribute('stay-visible', false), {
      once: true,
    });
  }

  #openQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    this.#stayVisibleUntilDialogCloses(dialogComponent);
    this.#syncHeaderState(dialogComponent);

    dialogComponent.showDialog();

    // is nondeterministic when the open attribute is set on the dialog element after .showDialog() is called.
    // Waiting until the open animation starts seemed to be the most reliable metric here.
    const dialog = dialogComponent.refs?.dialog;
    if (!dialog) return;
    dialog.addEventListener('animationstart', this.#resetScroll.bind(this), { once: true });
  };

  /**
   * Mirrors the header states that product media and details styles depend on. Those rules reach page
   * content from `#header-group` with a sibling combinator, which can't reach this body-level dialog.
   * Scroll is locked while the dialog is open, so the header can't change state until it closes.
   *
   * @param {QuickAddDialog} dialogComponent
   */
  #syncHeaderState(dialogComponent) {
    dialogComponent.toggleAttribute(
      'header-transparent',
      document.querySelector('header-component[transparent]') !== null
    );
    dialogComponent.toggleAttribute(
      'header-sticky-active',
      document.querySelector("#header-group #header-component[data-sticky-state='active']") !== null
    );
  }

  #closeQuickAddModal = () => {
    const dialogComponent = document.getElementById('quick-add-dialog');
    if (!(dialogComponent instanceof QuickAddDialog)) return;

    dialogComponent.closeDialog();
  };

  /**
   * Fetches the product page content
   * @param {string} productPageUrl - The URL of the product page to fetch
   * @returns {Promise<Document | null>}
   */
  async fetchProductPage(productPageUrl) {
    if (!productPageUrl) return null;

    // We use this to abort the previous fetch request if it's still pending.
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      const response = await fetch(productPageUrl, {
        signal: this.#abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch product page: HTTP error ${response.status}`);
      }

      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      return html;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      } else {
        throw error;
      }
    } finally {
      this.#abortController = null;
    }
  }

  /**
   * Re-renders the variant picker.
   * @param {Element} productGrid - The product grid element
   */
  async updateQuickAddModal(productGrid) {
    const modalContent = document.getElementById('quick-add-modal-content');

    if (!productGrid || !modalContent) return;

    if (isMobileBreakpoint()) {
      const productDetails = productGrid.querySelector('.product-details');
      const productFormComponent = productGrid.querySelector('product-form-component');
      const variantPicker = productGrid.querySelector('variant-picker');
      const productPrice = productGrid.querySelector('product-price');
      const productTitle = document.createElement('a');
      productTitle.textContent = this.dataset.productTitle || '';

      // Make product title as a link to the product page
      productTitle.href = this.productPageUrl;

      const productHeader = document.createElement('div');
      productHeader.classList.add('product-header');

      productHeader.appendChild(productTitle);
      productGrid.appendChild(productHeader);

      // Keep all scrollable product information before the sticky purchase row.
      // If details follow the sticky row, they scroll underneath it on mobile.
      if (variantPicker) {
        productGrid.appendChild(variantPicker);
      }
      if (productPrice) {
        productGrid.appendChild(productPrice);
      }
      if (productFormComponent) {
        productGrid.appendChild(productFormComponent);
      }

      productDetails?.remove();
    }

    // Sync the view-event-payload attribute and morph children into the modal's product-component
    const payload = productGrid.getAttribute('view-event-payload') || '';
    modalContent.setAttribute('view-event-payload', payload);

    morph(modalContent, productGrid);

    this.#syncVariantSelection(modalContent);
    this.#syncModalAddedState();
  }

  #setupModalDescription(modalContent) {
    const description = modalContent.querySelector('.quick-add-product-description, .freshomill-product-description');
    if (!(description instanceof HTMLElement)) return;
    if (description.parentElement?.classList.contains('quick-add-description')) return;

    description.querySelectorAll('h1, h2, h3').forEach((heading) => {
      const headingText = heading.textContent?.trim() || '';
      if (/^product details(?:\.{1,}|\u2026)+$/i.test(headingText)) {
        heading.textContent = headingText.replace(/(?:\.{1,}|\u2026)+$/, '');
      }
    });

    const dialog = document.getElementById('quick-add-dialog');
    const readMoreLabel = (dialog?.dataset.readMoreLabel || 'Read more').replace(/(?:\.{2,}|\u2026)+$/, '').trim();
    const wrapper = document.createElement('div');
    wrapper.className = 'quick-add-description';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'quick-add-description-toggle';
    toggle.textContent = readMoreLabel;
    toggle.setAttribute('aria-expanded', 'false');

    const detailsHeading = [...description.querySelectorAll('h1, h2, h3')].find((heading) =>
      /^product details\.?$/i.test(heading.textContent?.trim() || '')
    );
    let detailBody = description;
    if (detailsHeading) {
      let headingBlock = detailsHeading;
      while (headingBlock.parentElement && headingBlock.parentElement !== description) {
        headingBlock = headingBlock.parentElement;
      }

      const children = [...description.childNodes];
      const headingIndex = children.indexOf(headingBlock);
      if (headingIndex >= 0) {
        const intro = document.createElement('div');
        intro.className = 'quick-add-description-intro';
        detailBody = document.createElement('div');
        detailBody.className = 'quick-add-description-body';
        for (const node of children.slice(0, headingIndex)) intro.appendChild(node);
        for (const node of children.slice(headingIndex + 1)) detailBody.appendChild(node);
        description.replaceChildren(intro, headingBlock, detailBody);
      }
    }

    description.before(wrapper);
    wrapper.append(description, toggle);
    detailBody.classList.add('quick-add-description-body--clamped');

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      detailBody.classList.toggle('quick-add-description-body--clamped', !expanded);
      toggle.textContent = expanded
        ? dialog?.dataset.showLessLabel || 'Show less'
        : readMoreLabel;
    });

    requestAnimationFrame(() => {
      detailBody.classList.remove('quick-add-description-body--clamped');
      const fullHeight = detailBody.scrollHeight;
      detailBody.classList.add('quick-add-description-body--clamped');
      toggle.hidden = fullHeight <= detailBody.clientHeight + 1;
    });
  }

  async #syncModalAddedState() {
    const modalContent = document.getElementById('quick-add-modal-content');
    const variantInput = modalContent?.querySelector('product-form-component input[name="id"]');
    const addButton = modalContent?.querySelector('add-to-cart-component button[type="submit"]');
    if (!(variantInput instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement)) return;

    const cardVariantId = String(this.dataset.cartVariantId || '').split('/').pop();
    const selectedVariantId = String(variantInput.value).split('/').pop();
    if (cardVariantId === selectedVariantId) {
      const cardQuantity = Number(this.dataset.cartQuantity) || 0;
      this.#setModalVariantCartState(modalContent, addButton, variantInput, cardQuantity);
    }

    try {
      const response = await fetch(`${Theme.routes.cart_url}.js`, { credentials: 'same-origin' });
      if (!response.ok) return;
      const cart = await response.json();
      const variantId = String(variantInput.value).split('/').pop();
      const quantity = (cart.items || [])
        .filter((item) => String(item.variant_id) === variantId)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      this.#setModalVariantCartState(modalContent, addButton, variantInput, quantity);
    } catch (error) {
      console.warn('[quick-add] Could not sync popup cart state:', error);
    }
  }

  #setModalVariantCartState(modalContent, addButton, variantInput, quantity) {
    addButton.dataset.inCartQuantity = String(quantity);
    let controls = addButton.parentElement?.querySelector('.quick-add__cart-controls');
    if (!controls && addButton.parentElement) {
      controls = document.createElement('div');
      controls.className = 'quick-add__cart-controls';
      controls.innerHTML = '<button class="quick-add__cart-step" type="button" data-popup-quantity-delta="-1" aria-label="Decrease quantity">−</button><span class="quick-add__cart-count" aria-live="polite"></span><button class="quick-add__cart-step" type="button" data-popup-quantity-delta="1" aria-label="Increase quantity">+</button>';
      addButton.parentElement.appendChild(controls);
    }
    if (controls) {
      controls.hidden = quantity <= 0;
      const count = controls.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(quantity);
    }
    addButton.hidden = quantity > 0;

    const quantityInput = modalContent.querySelector('quantity-selector-component input[name="quantity"]');
    if (quantityInput instanceof HTMLInputElement) {
      quantityInput.setAttribute('data-cart-quantity', String(quantity));
      quantityInput.value = String(quantity || Number(quantityInput.min) || 1);
    }
  }

  /**
   * Syncs the variant selection from the product card to the modal
   * @param {Element} modalContent - The modal content element
   */
  #syncVariantSelection(modalContent) {
    const selectedVariantId = this.#getSelectedVariantId();
    if (!selectedVariantId) return;

    // Find and check the corresponding input in the modal
    const modalInputs = modalContent.querySelectorAll('input[type="radio"][data-variant-id]');
    for (const input of modalInputs) {
      if (input instanceof HTMLInputElement && input.dataset.variantId === selectedVariantId && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

if (!customElements.get('quick-add-component')) {
  customElements.define('quick-add-component', QuickAddComponent);
}

class QuickAddDialog extends DialogComponent {
  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener(StandardEvents.cartLinesUpdate, this.handleCartUpdate, {
      signal: this.#abortController.signal,
    });
    this.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.addEventListener('click', this.#handlePopupQuantityClick);

    this.addEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#abortController.abort();
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleDialogClose);
    this.removeEventListener('click', this.#handlePopupQuantityClick);
  }

  /**
   * Closes the dialog on successful cart update
   * @param {CartLinesUpdateEvent} event - The cart lines update event
   */
  handleCartUpdate = (event) => {
    const modalContent = document.getElementById('quick-add-modal-content');
    const target = event.target instanceof Element ? event.target : null;
    if (modalContent && target && modalContent.contains(target) && event.action === 'add') {
      const variantInput = modalContent.querySelector('product-form-component input[name="id"]');
      const addButton = modalContent.querySelector('add-to-cart-component button[type="submit"]');
      const line = (event.lines || event.detail?.lines || [])[0];
      const lineVariantId = String(line?.merchandiseId || line?.variantId || '').split('/').pop();
      if (variantInput instanceof HTMLInputElement && addButton instanceof HTMLButtonElement && lineVariantId === variantInput.value) {
        const quantity = (Number(addButton.dataset.inCartQuantity) || 0) + (Number(line?.quantity) || 1);
        this.#setModalVariantCartState(modalContent, addButton, variantInput, quantity);
      }
    }

    event.promise
      ?.then(({ detail }) => {
        if (detail?.didError) return;
        const modalContent = document.getElementById('quick-add-modal-content');
        const variantInput = modalContent?.querySelector('product-form-component input[name="id"]');
        const addButton = modalContent?.querySelector('add-to-cart-component button[type="submit"]');
        if (!(variantInput instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement)) return;

        const variantId = String(variantInput.value).split('/').pop();
        const quantity = (detail?.items || [])
          .filter((item) => String(item.variant_id) === variantId)
          .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        this.#setModalVariantCartState(modalContent, addButton, variantInput, quantity);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[quick-add] Event promise rejected:', error);
      });
  };

  #handlePopupQuantityClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const step = event.target.closest('[data-popup-quantity-delta]');
    if (!step) return;
    event.preventDefault();
    this.#changePopupQuantity(Number(step.dataset.popupQuantityDelta));
  };

  async #changePopupQuantity(delta) {
    const modalContent = document.getElementById('quick-add-modal-content');
    const variantInput = modalContent?.querySelector('product-form-component input[name="id"]');
    const addButton = modalContent?.querySelector('add-to-cart-component button[type="submit"]');
    if (!(variantInput instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement)) return;
    const variantId = variantInput.value;
    const previousQuantity = Number(addButton.dataset.inCartQuantity) || 0;
    const nextQuantity = Math.max(0, previousQuantity + delta);
    this.#setModalVariantCartState(modalContent, addButton, variantInput, nextQuantity);
    const unitPrice = Number(modalContent.querySelector('product-form-component')?.dataset.cartUnitPrice);
    document.dispatchEvent(new CustomEvent('freshomill:cart-optimistic', {
      detail: { itemCountDelta: delta, totalPriceDelta: Number.isFinite(unitPrice) ? unitPrice * delta : 0 },
    }));

    let updatePromise;
    try {
      const cartResponse = await fetch(`${Theme.routes.cart_url}.js`, { credentials: 'same-origin' });
      if (!cartResponse.ok) throw new Error(`Cart request failed (${cartResponse.status})`);
      const cart = await cartResponse.json();
      const line = (cart.items || []).find((item) => String(item.variant_id) === variantId);
      if (!line?.key) throw new Error('Cart line was not found');
      const targetQuantity = Math.max(0, (Number(line.quantity) || 0) + delta);
      updatePromise = CartLinesUpdateEvent.createPromise();
      this.dispatchEvent(new CartLinesUpdateEvent({
        action: targetQuantity > 0 ? 'update' : 'remove',
        context: 'cart',
        productId: addButton.closest('product-form-component')?.dataset.productId,
        lines: [{ id: line.key, variantId, merchandiseId: `gid://shopify/ProductVariant/${variantId}`, quantity: targetQuantity }],
        promise: updatePromise.promise,
      }));
      const response = await fetch(Theme.routes.cart_change_url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: line.key, quantity: targetQuantity }),
      });
      if (!response.ok) throw new Error(`Cart update failed (${response.status})`);
      const updatedCart = await response.json();
      updatePromise.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(updatedCart),
        detail: { items: updatedCart.items, itemCount: updatedCart.item_count, source: 'quick-add-dialog', didError: false },
      });
      const actualQuantity = (updatedCart.items || []).filter((item) => String(item.variant_id) === variantId)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      this.#setModalVariantCartState(modalContent, addButton, variantInput, actualQuantity);
    } catch (error) {
      updatePromise?.reject(error);
      this.#setModalVariantCartState(modalContent, addButton, variantInput, previousQuantity);
      document.dispatchEvent(new CustomEvent('freshomill:cart-optimistic', {
        detail: { itemCountDelta: -delta, totalPriceDelta: Number.isFinite(unitPrice) ? -unitPrice * delta : 0 },
      }));
      console.error('[quick-add-dialog] Could not update cart quantity:', error);
    }
  }

  #setModalVariantCartState(modalContent, addButton, variantInput, quantity) {
    addButton.dataset.inCartQuantity = String(quantity);
    let controls = addButton.parentElement?.querySelector('.quick-add__cart-controls');
    if (!controls && addButton.parentElement) {
      controls = document.createElement('div');
      controls.className = 'quick-add__cart-controls';
      controls.innerHTML = '<button class="quick-add__cart-step" type="button" data-popup-quantity-delta="-1" aria-label="Decrease quantity">−</button><span class="quick-add__cart-count" aria-live="polite"></span><button class="quick-add__cart-step" type="button" data-popup-quantity-delta="1" aria-label="Increase quantity">+</button>';
      addButton.parentElement.appendChild(controls);
    }
    if (controls) {
      controls.hidden = quantity <= 0;
      const count = controls.querySelector('.quick-add__cart-count');
      if (count) count.textContent = String(quantity);
    }
    addButton.hidden = quantity > 0;

    const quantityInput = modalContent.querySelector('quantity-selector-component input[name="quantity"]');
    if (quantityInput instanceof HTMLInputElement) {
      quantityInput.setAttribute('data-cart-quantity', String(quantity));
      quantityInput.value = String(quantity || Number(quantityInput.min) || 1);
    }
  }

  /** @param {ProductSelectEvent} event - The product select event */
  #handleProductSelect = (event) => {
    // Wait for variant update data
    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html } = detail;
        const anchorElement = /** @type {HTMLAnchorElement} */ (html.querySelector('.view-product-title a'));
        const viewMoreDetailsLink = /** @type {HTMLAnchorElement} */ (this.querySelector('.view-product-title a'));
        const mobileProductTitle = /** @type {HTMLAnchorElement} */ (this.querySelector('.product-header a'));

        if (!anchorElement) return;

        if (viewMoreDetailsLink) viewMoreDetailsLink.href = anchorElement.href;
        if (mobileProductTitle) mobileProductTitle.href = anchorElement.href;
        this.#syncPopupCartState();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[quick-add] Event promise rejected:', error);
      });
  };

  async #syncPopupCartState() {
    const modalContent = document.getElementById('quick-add-modal-content');
    const variantInput = modalContent?.querySelector('product-form-component input[name="id"]');
    const addButton = modalContent?.querySelector('add-to-cart-component button[type="submit"]');
    if (!(variantInput instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement)) return;

    try {
      const response = await fetch(`${Theme.routes.cart_url}.js`, { credentials: 'same-origin' });
      if (!response.ok) return;
      const cart = await response.json();
      const variantId = String(variantInput.value).split('/').pop();
      const quantity = (cart.items || [])
        .filter((item) => String(item.variant_id) === variantId)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      this.#setModalVariantCartState(modalContent, addButton, variantInput, quantity);
    } catch (error) {
      console.warn('[quick-add] Could not sync selected popup variant:', error);
    }
  }

  #handleDialogClose = () => {
    const modalContent = document.getElementById('quick-add-modal-content');
    if (modalContent) {
      modalContent.replaceChildren();
      modalContent.removeAttribute('aria-busy');
      modalContent.removeAttribute('view-event-payload');
      delete modalContent.dataset.productUrl;
      modalContent.scrollTop = 0;
    }

    const iosVersion = getIOSVersion();
    /**
     * This is a patch to solve an issue with the UI freezing when the dialog is closed.
     * To reproduce it, use iOS 16.0.
     */
    if (!iosVersion || iosVersion.major >= 17 || (iosVersion.major === 16 && iosVersion.minor >= 4)) return;

    requestAnimationFrame(() => {
      /** @type {HTMLElement | null} */
      const grid = document.querySelector('#ResultsList [product-grid-view]');
      if (grid) {
        const currentWidth = grid.getBoundingClientRect().width;
        grid.style.width = `${currentWidth - 1}px`;
        requestAnimationFrame(() => {
          grid.style.width = '';
        });
      }
    });
  };
}

if (!customElements.get('quick-add-dialog')) {
  customElements.define('quick-add-dialog', QuickAddDialog);
}
