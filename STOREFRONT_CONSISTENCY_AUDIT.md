# FreshOMill storefront consistency audit

**Review date:** 12 October 2026  
**Scope:** Shopify Horizon 4.3 theme in this workspace. This pass compares the provided desktop and mobile reference screens with the theme source. No live storefront preview or Shopify admin session was available, so hosted checkout, active customer-account mode, and rendered device screenshots remain outside the review.

## Executive summary

The storefront is a Shopify theme with substantial custom presentation layered over Horizon. Core commerce operations still use Shopify's Liquid objects, cart forms, variant picker, cart item components, and section rendering. Current custom work covers the shared hero treatment, catalog filters/cards, mobile navigation, product detail, cart modal/sheet, contact page, and legacy customer profile/order screens.

The largest consistency risks are platform boundaries and split styling ownership:

1. The checkout and current Shopify Customer Account experiences are hosted surfaces. A theme-only change cannot reproduce their full reference layouts. The new account Liquid templates only apply if the store uses legacy customer accounts.
2. The catalog layout is extensively overridden in `sections/main-collection.liquid`, including repeated desktop rules. Fixed column and page-size rules can drift from the responsive row-count requirement.
3. Custom sections contain many hard-coded English labels and inline component styles. Their typography, spacing, and colors can diverge from theme editor settings and translations.
4. The free-delivery message is driven by a theme threshold. It must agree with actual Shopify shipping rates or it may promise an unavailable rate.

## Mobile cart and product display: current state

- `snippets/cart-drawer.liquid` retains Shopify's cart item component, quantity selector, remove action, totals, and checkout form. It is a modal at every breakpoint, uses the available width with 16px desktop gutters, and stays below the measured header and sticky breadcrumb. Mobile uses a bottom sheet constrained to the visible area.
- The cart backdrop blurs the page; shared theme drawers/dialogs and the mobile search dialog use the same backdrop treatment. Cart rows wrap long titles and details and keep price, quantity, and actions within the dialog width.
- The mobile cart constrains the sheet height, scrolls the item list independently, and keeps totals and checkout actions available. Rendered viewport behavior still needs browser verification.
- `templates/product.json` uses the native product gallery carousel with thumbnails on mobile and desktop, and retains native variant, quantity, price, and add-to-cart blocks. Product detail styling now follows the reference order, with theme H3 title sizing, equal-width variant choices, and side-by-side quantity/add-to-cart controls.
- Product status badges use the real product availability and show “Freshly milled” only when that product tag exists. The reference's rating and review count only render when Shopify review metafields provide them.
- The product category is rendered from `closest.product.type` in a Shopify Liquid block; it is not configured as an unsupported dynamic source.
- The free-delivery threshold is a ₹100-increment theme setting from ₹0 to ₹9,900, within Shopify's range limit. The actual threshold still needs to match the store's shipping rules.
- The home and catalog hero use matching 3:1 desktop and 2.1:1 mobile aspect ratios; the collection template points to the same current hero image as home. The catalog benefits now use three icon-and-label entries to match the home hero structure.
- Contact mobile form and information text no longer shrink to 7–8px; the smallest content labels are 9px, with fields and primary actions at 10–11px or larger.
- No live browser preview was available. Verify the cart at short viewport heights and with long titles, multiple variants, discounts, and many line items; also compare the contact page at 390px to ensure its larger type still fits its stacked cards comfortably.

## Reference alignment matrix

| Reference screen | Theme implementation and alignment | Remaining verification or limitation |
| --- | --- | --- |
| Home hero and benefits | `sections/hero.liquid` supplies the reference hero proportions and feature style. `templates/index.json` and `templates/collection.json` currently use the same hero image. | Confirm crop and text contrast in a rendered browser at desktop and mobile widths. |
| Catalog filter and product listing | `sections/main-collection.liquid`, `blocks/filters.liquid`, and the shared product-card block control the desktop sidebar, mobile filter sheet, sorting, and two-column mobile grid. Product cards use the same portrait image ratio as the home best-seller cards. Category clicks replace results in place and preserve the current scroll position. | Page size remains fixed at 10. This is exactly two rows at five columns and five rows at two columns, but intermediate desktop widths can show more than two rows. The desktop grid uses five columns at 1440px and wider and auto-fills at narrower widths. |
| Contact page | `sections/contact-page.liquid` matches the shared hero proportions, full-bleed hero image, form, contact cards, map, and social links; redundant decorative contact-card illustrations are absent. | Check that 9px supporting copy remains readable at the narrowest supported width and that success/error states match the reference. |
| Product detail | `sections/product-information.liquid` and `templates/product.json` retain Shopify product and variant behavior while matching the reference gallery, title, options, quantity, and add-to-cart hierarchy. | Review real products with long titles, unavailable variants, multiple media types, and missing rating/review data. |
| Cart | `snippets/cart-drawer.liquid` and `snippets/cart-products.liquid` use a wide modal on desktop and a bottom sheet on mobile, preserve Shopify cart updates, and use the same image treatment and green/neutral palette. | Confirm sticky header/breadcrumb clearance, backdrop blur, internal scrolling, checkout visibility, and text wrapping in the live theme. |
| Profile and orders | `sections/main-customer-account.liquid` and `sections/main-customer-order.liquid` provide sample preview content and data-driven legacy customer/order views. | They only control classic customer accounts. Shopify-hosted new accounts need the account editor/extension surface. |
| Account sign-in | `templates/page.account.json` and `sections/account-sign-in.liquid` provide the responsive branded sign-in landing, use the shared home hero image, and launch Shopify's real passwordless account sheet. | Assign this template to a Shopify page with the `account` handle. The email/code inputs and verification state are hosted by Shopify and cannot be styled into the reference's inline card with theme Liquid. |
| Checkout | Shopify cart checkout handoff remains native. | The supplied checkout reference cannot be reproduced by theme Liquid; apply supported branding in Shopify Checkout Editor or a supported extension. |

## Codebase inventory

The repository contains **49 sections, 95 blocks, 147 snippets, 15 templates, 131 assets, and 57 locale files**. It is a theme, not a standalone storefront app: there is no app server, build pipeline, or checkout extension source in this workspace. The theme includes Horizon's core JavaScript and CSS plus FreshOMill custom sections and styling.

| Storefront area | Main implementation |
| --- | --- |
| Global layout and breadcrumb | `layout/theme.liquid`, `snippets/site-breadcrumb.liquid` |
| Header and mobile navigation | `sections/header.liquid`, `snippets/header-actions.liquid`, `snippets/cart-bubble.liquid` |
| Home | `templates/index.json`, `sections/hero.liquid`, `sections/category-list.liquid`, `sections/product-list.liquid` |
| Catalog and filters | `templates/collection.json`, `sections/main-collection.liquid`, `blocks/filters.liquid`, `snippets/catalog-filter-links.liquid`, `assets/facets.js` |
| Product detail | `templates/product.json`, `sections/product-information.liquid`, `blocks/_product-media-gallery.liquid`, `snippets/product-media-gallery-content.liquid` |
| Cart | `templates/cart.json`, `sections/main-cart.liquid`, `snippets/cart-drawer.liquid`, `snippets/cart-products.liquid`, `snippets/cart-summary.liquid`, cart JavaScript components |
| Contact | `templates/page.contact.json`, `sections/contact-page.liquid` |
| Account and orders | `templates/customers/account.liquid`, `templates/customers/order.liquid`, `sections/main-customer-account.liquid`, `sections/main-customer-order.liquid` |
| Account sign-in landing | `templates/page.account.json`, `sections/account-sign-in.liquid` |
| Theme configuration and copy | `config/settings_schema.json`, `config/settings_data.json`, `locales/*.json` |
| Remaining page types | Search, article, blog, collection index, 404, gift card, password, and generic page templates/sections |

## Findings and recommended changes

Priority meanings: **P0** blocks faithful theme-only implementation or risks a false commerce promise; **P1** should be addressed before calling the storefront consistent; **P2** is important hardening and polish.

| Priority | Finding | Recommended change |
| --- | --- | --- |
| P0 | Shopify checkout is hosted. The reference's address, payment-method, and place-order layout cannot be rendered by `templates/cart.json` or a theme section. | Apply visual branding in Shopify Checkout Editor. Use a Checkout UI extension only for supported custom content. Keep Shopify's native address/payment controls and checkout submission. |
| P0 | `sections/header.liquid` uses Shopify’s `<shopify-account>` component. The added `templates/customers/*` pages are legacy-account templates and do not control Shopify’s new hosted Customer Account experience. The new branded sign-in landing triggers Shopify’s native passwordless account sheet; its OTP fields and resend state remain Shopify controlled. | Assign the `page.account` template to a page with handle `account`. Use Shopify’s Customer Accounts editor for the hosted sign-in branding and account screens. Keep the native component for secure OTP handling. |
| P1 | Free-delivery progress in the cart drawer reads `settings.cart_free_delivery_goal`, independently of shipping profiles/rates. | Confirm the threshold and qualifying subtotal with store shipping rules; hide the bar at zero or derive qualification from an authoritative store configuration. Do not show “free” when checkout will charge delivery. |
| P1 | Catalog desktop styling in `sections/main-collection.liquid` has repeated grid/control selectors and a hard `repeat(5, ...)` rule alongside auto-fill rules at narrower breakpoints. | Consolidate the catalog layout into one desktop and one mobile rule set with shared CSS variables. Derive columns from actual available width, and keep count/sort in the same grid track as the products. |
| P1 | `templates/collection.json` and `sections/main-collection.liquid` paginate at a fixed 10 products. This fits the five-column desktop and two-column mobile reference layouts but can exceed two rows at intermediate desktop widths. | Decide whether intermediate widths should keep 10 items or calculate the count from the actual column count. Any dynamic page size must stay compatible with Shopify pagination and facet rerenders. |
| P1 | Catalog category filtering loads a collection URL's `#ResultsList` into the existing page using section rendering and keeps the current scroll position. | Verify back/forward, pagination, sort, filters, and category counts remain synchronized after successive async updates. |
| P1 | Account profile fields represent customer default-address fields; customer email is explicitly read-only. Legacy Liquid cannot update all fields shown in the reference as customer credentials. | Keep the UI truthful: label editable address/contact fields accurately. Use Shopify's customer account experience/API for email or credential changes. Do not imply that address saves change account credentials. |
| P1 | Custom sections include hard-coded English labels and mixed punctuation; theme locale files cover the stock theme, not every custom string. | Move customer, catalog, cart, contact, and account copy to `locales/en.default.json` and provide translations or documented English fallbacks. Keep settings labels translatable in schema locale files. |
| P1 | Custom CSS is embedded in multiple section/snippet `{% stylesheet %}` blocks and uses repeated literal colors, dimensions, and typography. | Define a small FreshOMill token layer for green, neutral backgrounds, border, radius, spacing, and type scale. Use component-scoped tokens and remove duplicate overrides as each area is normalized. |
| P2 | The account order filter uses inline `onchange` JavaScript. Inline behavior is harder to test, maintain, and reuse. | Move account behavior into a small progressive-enhancement asset. Keep order links and pagination functional without JavaScript. |
| P2 | Address, order, and cart empty/error/success states are not visually covered as a unified system. | Create shared message, empty-state, and form-error patterns with visible validation and focus handling. Confirm remove/default-address actions with Shopify's actual form response behavior. |
| P2 | The reference includes badges, rating count, tracking, and delivery details that depend on real product/order/shipping data. | Render each detail only when its Shopify field exists; never fabricate rating, delivery, fulfillment, or support status. Add explicit fallbacks for absent metafields/media. |
| P2 | The custom account and order views are not represented in JSON templates and are only reachable under classic account routing. | Document the account mode in the merchant handoff and verify the sign-in, logout, order detail, pagination, and return-to-account routes on the target store. |
| P2 | No rendered storefront preview was available, and the Shopify Liquid validator could not start because its `@shopify/theme-check-common` dependency is not installed. The theme skill's documentation search also failed to fetch its remote results. | Run Shopify Theme Check in an environment with its dependencies and preview the theme at the documented viewport widths. `git diff --check` passed, but it does not validate Liquid rendering or visual layout. |

## Page-by-page consistency review

### Global shell

- The breadcrumb is rendered from `layout/theme.liquid`, which is the right shared location for cross-page placement. Confirm its sticky offset against both the desktop header and mobile header/bottom navigation, including transparent-header pages.
- Header, footer, sticky breadcrumb, and bottom navigation should share one spacing and stacking scale. Keep the catalog toolbar at base stacking order; only open popovers/drawers should rise above content.
- Cart badge sizing has a dedicated mobile override. Verify 1-, 2-, and 3-digit counts and empty-cart rendering against the icon's visible bounds.

### Home and catalog

- Home and catalog share product cards and theme-level product data, but catalog layout has a separate dense set of overrides. Treat the home product card as the canonical component and avoid a second catalog-only card design.
- The catalog search icon, category list, filter controls, and clear action now have targeted mobile styles. Check search-to-category spacing, icon stroke contrast, separators, keyboard focus, safe-area inset, and clear/apply behavior after actual facet rerenders.
- Category clicks are handled without scrolling to the top. Check browser history, refresh, back/forward, sort, and pagination after category changes.

### Product detail and cart

- Native product forms and cart item controls are retained, which is necessary for variant, quantity, and cart behavior. Review the mobile gallery at narrow widths, with one image, many images, video, and a variant-specific image.
- On mobile cart sheets, test empty and populated states, quantity updates, item removal, discounts, free-shipping threshold, long titles, unavailable items, scroll anchoring, checkout CTA visibility, keyboard close, and safe areas.
- Compare cart line-item image size, quantity selector, price placement, divider rhythm, and total hierarchy to the same design tokens used by catalog cards and product detail.

### Contact, account, and order

- Contact is theme-controlled and should share the home/catalog hero height and page gutters. Validate mobile map/embed dimensions, form success/error states, and social links.
- The new account pages use customer/order/address Liquid data. Test with no address, multiple addresses, a non-default address, no orders, canceled orders, partially fulfilled orders, unavailable historical products, and orders with tracking.
- The legacy account template now shows clearly labeled sample profile/address/order cards only in theme-editor preview when the corresponding real data is absent; sample controls are read-only or disabled and do not write customer data.
- Shopify's new customer accounts and hosted checkout require their own Shopify customization surface; theme Liquid cannot guarantee the supplied screen design there.
- The branded sign-in page is available as `page.account`; its button opens Shopify’s native passwordless account component. The inline six-digit code entry shown in the reference is controlled by Shopify and cannot be recreated by theme Liquid without replacing Shopify authentication.

### Remaining templates

- Search, blog/article, collection list, generic pages, 404, gift card, and password templates should use the same heading scale, breadcrumb spacing, page gutters, card radius, and button states. Review them after the core purchase path rather than duplicating catalog-specific overrides.
- The 57 locale files should be checked for the custom strings added to the storefront. Keep translated content as data, not as CSS or inline JavaScript text.

## Recommended implementation plan

1. **Confirm platform modes and policies.** Record checkout customization capability, customer account mode, and the actual free-delivery threshold/rules.
2. **Finish the purchase path.** Verify mobile/desktop product details, cart drawer and cart page; standardize line items, totals, quantity controls, notices, empty states, and checkout handoff.
3. **Implement the supported checkout surface.** Apply checkout branding in Shopify Admin or add a supported extension. Do not recreate payment collection in the theme.
4. **Finish account/order behavior for the active account mode.** Keep the legacy templates only if classic accounts are active; otherwise use Shopify's account editor/extension surface.
5. **Consolidate catalog layout.** Remove duplicate desktop rules, align adaptive pagination with row-count requirements, and preserve category/filter/sort state.
6. **Normalize global design tokens.** Bring header, breadcrumb, hero, cards, forms, drawers, buttons, and footer onto one type/spacing/color system.
7. **Localize and harden interactions.** Move inline scripts, add accessible labels and visible errors, and verify keyboard/focus/contrast behavior.
8. **Visual and functional QA.** Check 360, 390, 768, 1280, 1440, and 1920 px widths; verify no horizontal overflow and test all dynamic Shopify states.

## Acceptance checklist

- Desktop and mobile share typography, color, button, border, and spacing tokens.
- Product gallery and product form remain usable with every variant and media type.
- Cart drawer uses one intentional scroll region, keeps checkout visible, and updates through Shopify's cart component.
- Shipping progress matches actual shipping eligibility.
- Catalog columns fill the available area; pagination reflects the chosen row-count rule at each breakpoint.
- Search, category, facets, sort, pagination, and browser history stay synchronized.
- Account pages correspond to the active Shopify account mode and do not imply unsupported profile edits.
- Checkout layout is implemented only through supported Checkout customization surfaces.
- All custom visible copy is localized and all forms expose errors/success states.
- Visual QA and Shopify theme validation pass on the target theme before release.
