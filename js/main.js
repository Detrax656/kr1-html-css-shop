/* ===============================
   0. localStorage: избранное, заказы, профиль
   =============================== */

const FAVORITES_KEY = 'nakal-favorites';
const ORDERS_KEY = 'nakal-orders';
const PROFILE_KEY = 'nakal-profile';

// Функция, которую страница личного кабинета подключает для перерисовки избранного.
let onFavoritesChange = null;

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // localStorage недоступен — данные просто не сохранятся.
  }
}

function getFavorites() {
  return readStorage(FAVORITES_KEY, []);
}

function isFavorite(id) {
  return getFavorites().includes(id);
}

function updateFavoritesCount() {
  const count = getFavorites().length;

  document.querySelectorAll('[data-favorites-count]').forEach((element) => {
    element.textContent = count;
  });
}

function getOrders() {
  return readStorage(ORDERS_KEY, []);
}

function saveOrder(order) {
  const list = getOrders();

  list.unshift(order);
  writeStorage(ORDERS_KEY, list);
}

function createOrderNumber() {
  return `NK-${String(Date.now()).slice(-6)}`;
}

function getProfile() {
  return readStorage(PROFILE_KEY, {});
}

// Подставляет в форму сохранённые данные профиля: { имя поля формы: ключ профиля }.
function fillFromProfile(form, fields) {
  const profile = getProfile();

  Object.entries(fields).forEach(([fieldName, profileKey]) => {
    const field = form.elements[fieldName];

    if (field && profile[profileKey]) {
      field.value = profile[profileKey];
    }
  });
}

const HEART_ICON = '<svg class="favorite-button__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/></svg>';

// Переключаем состояние кнопок избранного (на карточках и на странице товара).
function syncFavoriteButton(button, active) {
  const label = button.querySelector('.favorite-button__label');

  button.classList.toggle('is-active', active);
  button.setAttribute('aria-pressed', String(active));

  if (label) {
    label.textContent = active ? 'В избранном' : 'В избранное';
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-favorite]');

  if (!button) {
    return;
  }

  const id = Number(button.dataset.favorite);
  const wasActive = isFavorite(id);
  const list = getFavorites().filter((item) => item !== id);

  if (!wasActive) {
    list.push(id);
  }

  writeStorage(FAVORITES_KEY, list);

  document.querySelectorAll(`[data-favorite="${id}"]`).forEach((item) => syncFavoriteButton(item, !wasActive));

  // Короткая анимация «прыжка» сердечка.
  button.classList.remove('favorite-pulse');
  void button.offsetWidth;
  button.classList.add('favorite-pulse');

  updateFavoritesCount();

  if (onFavoritesChange) {
    onFavoritesChange();
  }
});

updateFavoritesCount();

/* ===============================
   1. Функции для работы с товарами
   =============================== */

// 12400 -> «12 400 ₽».
function formatPrice(price) {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

// Размер скидки в рублях.
function calculateDiscount(price, discountPercent) {
  return Math.round((price * discountPercent) / 100);
}

// Итоговая цена с учётом скидки.
function calculateFinalPrice(price, discountPercent) {
  return price - calculateDiscount(price, discountPercent);
}

// Статус товара
function getProductStatus(product) {
  if (!product.inStock) {
    return { key: 'unavailable', label: 'Нет в наличии' };
  }

  if (product.discount > 0) {
    return { key: 'discount', label: `Скидка −${product.discount}%` };
  }

  if (product.isNew) {
    return { key: 'new', label: 'Новинка' };
  }

  if (product.isHit) {
    return { key: 'hit', label: 'Хит' };
  }

  return { key: '', label: '' };
}

// Краткая сводка по товару: «Название: цена. Статус: …»
function createProductSummary(product) {
  const finalPrice = calculateFinalPrice(product.price, product.discount);
  const status = getProductStatus(product).label || (product.inStock ? 'В наличии' : 'Нет в наличии');

  return `${product.name}: ${formatPrice(finalPrice)}. Статус: ${status}.`;
}

// Краткое описание
function getShortDescription(text, maxLength = 100) {
  if (text.length <= maxLength) {
    return text;
  }

  const cut = text.slice(0, maxLength);

  // Если в начале есть законченное предложение, показываем его целиком.
  const sentenceEnd = cut.lastIndexOf('. ');

  if (sentenceEnd > maxLength / 2) {
    return cut.slice(0, sentenceEnd + 1);
  }

  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

// Фильтрация товаров
function filterProducts(list, filters) {
  return list.filter((product) => {
    const finalPrice = calculateFinalPrice(product.price, product.discount);

    const typeOk = filters.types.length === 0 || filters.types.includes(product.type);
    const fromOk = filters.priceFrom === null || finalPrice >= filters.priceFrom;
    const toOk = filters.priceTo === null || finalPrice <= filters.priceTo;
    const stockOk = !filters.inStockOnly || product.inStock;
    const saleOk = !filters.onSaleOnly || product.discount > 0;

    return typeOk && fromOk && toOk && stockOk && saleOk;
  });
}

/* ===============================
   2. Вывод отчёта в консоль
   =============================== */

function logProductReport(list) {
  const first = list[0];

  console.group('Накал: отчёт по товарам');
  console.log('Товар:', first.name);
  console.log('Цена:', formatPrice(first.price));
  console.log('Скидка:', calculateDiscount(first.price, first.discount), '₽');
  console.log('Итоговая цена:', formatPrice(calculateFinalPrice(first.price, first.discount)));
  console.log('Статус:', getProductStatus(first).label || 'без статуса');
  console.log('Описание:', getShortDescription(first.description));
  console.log('Сводка:', createProductSummary(first));

  console.table(list.map((product) => ({
    id: product.id,
    name: product.name,
    price: formatPrice(product.price),
    final: formatPrice(calculateFinalPrice(product.price, product.discount)),
    status: getProductStatus(product).label || '—'
  })));
  console.groupEnd();
}

/* ===============================
   3. Карточки товаров
   =============================== */

function getImageSet(id) {
  const n = String(id).padStart(2, '0');

  return {
    src: `images/lamp-${n}-640.jpg`,
    srcset: `images/lamp-${n}-480.jpg 480w, images/lamp-${n}-640.jpg 640w, images/lamp-${n}-960.jpg 960w`
  };
}

function getPriceHtml(product, className) {
  const finalPrice = calculateFinalPrice(product.price, product.discount);

  if (product.discount > 0) {
    return `<span class="${className}-old"><span class="visually-hidden">Старая цена </span><del>${formatPrice(product.price)}</del></span>
      <span class="${className}-new"><span class="visually-hidden">Цена со скидкой </span>${formatPrice(finalPrice)}</span>`;
  }

  return formatPrice(finalPrice);
}

function createProductCard(product, withOrderButton) {
  const status = getProductStatus(product);
  const image = getImageSet(product.id);
  const link = `product.html?id=${product.id}`;

  const card = document.createElement('article');
  card.className = status.key ? `product-card product-card--${status.key}` : 'product-card';

  card.innerHTML = `
    ${status.label ? `<span class="product-card__badge">${status.label}</span>` : ''}
    <button class="favorite-button${isFavorite(product.id) ? ' is-active' : ''}" type="button" data-favorite="${product.id}"
      aria-pressed="${isFavorite(product.id)}" aria-label="В избранное: ${product.name}">${HEART_ICON}</button>
    <a class="product-card__media" href="${link}" tabindex="-1" aria-hidden="true">
      <img class="product-card__image" src="${image.src}" srcset="${image.srcset}"
        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
        alt="${product.alt}" width="640" height="480" loading="lazy">
    </a>
    <h3 class="product-card__title"><a class="product-card__link" href="${link}">${product.name}</a></h3>
    <p class="product-card__category">${PRODUCT_TYPES[product.type]}</p>
    <p class="product-card__description">${getShortDescription(product.description)}</p>
    <p class="product-card__price">${getPriceHtml(product, 'product-card__price')}</p>
    <div class="product-card__actions">
      <a class="button" href="${link}">Подробнее</a>
      ${withOrderButton && product.inStock
        ? `<button class="button button--secondary product-card__button" type="button" data-id="${product.id}">Заказать</button>`
        : ''}
    </div>`;

  return card;
}

function renderProducts(container, list, withOrderButton) {
  container.replaceChildren(...list.map((product) => createProductCard(product, withOrderButton)));
}

/* ===============================
   4. Страницы: главная, каталог, товар
   =============================== */

const hasOrderDialog = Boolean(document.getElementById('order-dialog'));

// Главная: популярные товары (хиты).
const popularGrid = document.getElementById('popular-grid');

if (popularGrid) {
  renderProducts(popularGrid, products.filter((product) => product.isHit), hasOrderDialog);
}

// Каталог: фильтр.
const catalogGrid = document.getElementById('catalog-grid');
const catalogForm = document.getElementById('catalog-form');

if (catalogGrid && catalogForm) {
  const countText = document.getElementById('catalog-count');
  const emptyText = document.getElementById('catalog-empty');

  const readNumber = (value) => (value === '' ? null : Number(value));

  const applyFilters = () => {
    const data = new FormData(catalogForm);

    const filters = {
      types: data.getAll('type'),
      priceFrom: readNumber(data.get('price-from')),
      priceTo: readNumber(data.get('price-to')),
      inStockOnly: data.has('in-stock'),
      onSaleOnly: data.has('on-sale')
    };

    const result = filterProducts(products, filters);

    renderProducts(catalogGrid, result, hasOrderDialog);
    emptyText.hidden = result.length > 0;
    countText.textContent = `Найдено товаров: ${result.length} из ${products.length}`;
  };

  catalogForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });

  catalogForm.addEventListener('reset', () => {
    setTimeout(applyFilters, 0);
  });

  // Ссылка вида catalog.html?type=floor сразу включает нужный тип.
  const typeFromUrl = new URLSearchParams(window.location.search).get('type');

  if (typeFromUrl) {
    const checkbox = catalogForm.querySelector(`input[name="type"][value="${typeFromUrl}"]`);

    if (checkbox) {
      checkbox.checked = true;
    }
  }

  applyFilters();
}

// Страница товара: данные берём из массива по ?id=.
const productPage = document.getElementById('product-page');

if (productPage) {
  const id = Number(new URLSearchParams(window.location.search).get('id')) || 1;
  const product = products.find((item) => item.id === id);

  if (!product) {
    document.title = 'Товар не найден — Накал';
    productPage.innerHTML = `
      <section class="section">
        <h1>Товар не найден</h1>
        <p>Возможно, ссылка устарела. Вернитесь в каталог и выберите лампу заново.</p>
        <a class="button" href="catalog.html">Перейти в каталог</a>
      </section>`;
  } else {
    productPage.innerHTML = createProductPageHtml(product);
    document.title = `${product.name} — Накал`;

    const related = products.filter((item) => item.id !== product.id && item.type === product.type);
    const others = products.filter((item) => item.id !== product.id && item.type !== product.type);

    renderProducts(document.getElementById('related-grid'), related.concat(others).slice(0, 3), false);
  }
}

function createProductPageHtml(product) {
  const status = getProductStatus(product);
  const image = getImageSet(product.id);
  const article = `NK-${String(product.id).padStart(4, '0')}`;

  const rows = Object.entries(product.specs)
    .map(([name, value]) => `<tr><th class="product-table__cell" scope="row">${name}</th><td class="product-table__cell">${value}</td></tr>`)
    .join('');

  const kit = PRODUCT_KITS[product.type]
    .map((item) => `<li class="product-details__item">${item};</li>`)
    .join('')
    .replace(/;<\/li>$/, '.</li>');

  return `
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <a class="breadcrumbs__link" href="index.html">Главная</a>
      <a class="breadcrumbs__link" href="catalog.html">Каталог</a>
      <span class="breadcrumbs__current" aria-current="page">${product.name}</span>
    </nav>

    <section class="section">
      <article class="product-details">
        <img class="product-details__image" src="${image.src}" srcset="${image.srcset}"
          sizes="(max-width: 767px) 100vw, 50vw" alt="${product.alt}" width="640" height="480">

        <div class="product-details__info">
          ${status.label ? `<p class="product-details__badge product-details__badge--${status.key}">${status.label}</p>` : ''}
          <h1 class="product-details__title">${product.name}</h1>
          <p class="product-details__category">${PRODUCT_TYPES[product.type]}, артикул ${article}</p>
          <p class="product-details__description">${product.description}</p>

          <h2 class="product-details__subtitle">Комплектация</h2>
          <ul class="product-details__list">${kit}</ul>

          <p class="product-details__price">${getPriceHtml(product, 'product-details__price')}</p>
          <p class="product-details__availability${product.inStock ? '' : ' product-details__availability--no'}">
            ${product.inStock ? 'В наличии' : 'Нет в наличии'}
          </p>
          <div class="product-card__actions">
            ${product.inStock
              ? `<a class="button" href="order.html?id=${product.id}">Оформить заказ</a>`
              : ''}
            <button class="button button--secondary favorite-button favorite-button--text${isFavorite(product.id) ? ' is-active' : ''}" type="button"
              data-favorite="${product.id}" aria-pressed="${isFavorite(product.id)}">${HEART_ICON}<span class="favorite-button__label">${isFavorite(product.id) ? 'В избранном' : 'В избранное'}</span></button>
          </div>
        </div>
      </article>
    </section>

    <section class="section">
      <div class="table-wrapper">
        <table class="product-table">
          <caption class="product-table__caption">Характеристики товара</caption>
          <thead>
            <tr>
              <th class="product-table__heading" scope="col">Параметр</th>
              <th class="product-table__heading" scope="col">Значение</th>
            </tr>
          </thead>
          <tbody>
            <tr><th class="product-table__cell" scope="row">Артикул</th><td class="product-table__cell">${article}</td></tr>
            <tr><th class="product-table__cell" scope="row">Тип</th><td class="product-table__cell">${PRODUCT_TYPES[product.type]}</td></tr>
            ${rows}
            <tr><th class="product-table__cell" scope="row">Гарантия</th><td class="product-table__cell">2 года</td></tr>
            <tr><th class="product-table__cell" scope="row">Срок доставки</th><td class="product-table__cell">1–3 дня по Москве, 3–7 дней по России</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Отзывы покупателей</h2>

      <div class="reviews">
        <article class="review-card">
          <p class="review-card__rating" role="img" aria-label="Оценка: 5 из 5">★★★★★</p>
          <blockquote class="review-card__text">Качество отличное: материалы, шнур, абажур — всё ощущается дорогим. Свет тёплый и мягкий, в комнате стало заметно уютнее.</blockquote>
          <p class="review-card__author">Алексей К.</p>
        </article>

        <article class="review-card">
          <p class="review-card__rating" role="img" aria-label="Оценка: 4 из 5">★★★★☆</p>
          <blockquote class="review-card__text">Лампа красивая и светит ярче, чем я ожидала. Упаковка надёжная, доставили на следующий день.</blockquote>
          <p class="review-card__author">Марина В.</p>
        </article>

        <article class="review-card">
          <p class="review-card__rating" role="img" aria-label="Оценка: 5 из 5">★★★★★</p>
          <blockquote class="review-card__text">Заказывал в подарок жене. Когда она включила свет, не сразу поверила, что это обычная лампа. Очень красиво.</blockquote>
          <p class="review-card__author">Игорь Т.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Похожие товары</h2>
      <div class="products-grid" id="related-grid"></div>
    </section>`;
}

logProductReport(products);

// Проверочный блок на странице каталога: текст выводится через textContent, не через innerHTML.
const jsMessage = document.querySelector('.js-message');
const productOutput = document.querySelector('.product-output');

if (jsMessage) {
  jsMessage.textContent = 'JavaScript подключён корректно.';
}

if (productOutput) {
  productOutput.textContent = createProductSummary(products[0]);
}

/* ===============================
   5. Заказ: общие функции
   =============================== */

const DELIVERY_PRICE = 500;
const FREE_DELIVERY_FROM = 10000;
const MAX_QUANTITY = 10;

// Стоимость доставки: курьер платный до 10 000 ₽, самовывоз бесплатный.
function calculateDelivery(subtotal, method) {
  if (method !== 'courier') {
    return 0;
  }

  return subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
}

function readQuantity(input) {
  const value = Math.floor(Number(input.value)) || 1;
  return Math.min(MAX_QUANTITY, Math.max(1, value));
}

// Мини-карточка товара для окна быстрого заказа и сводки заказа.
function createOrderItemHtml(product, quantity) {
  const unit = calculateFinalPrice(product.price, product.discount);

  return `
    <img class="order-item__image" src="${getImageSet(product.id).src}" alt="${product.alt}" width="96" height="72">
    <div class="order-item__info">
      <p class="order-item__name">${product.name}</p>
      <p class="order-item__meta">${PRODUCT_TYPES[product.type]}</p>
      <p class="order-item__price">${formatPrice(unit)} × ${quantity}</p>
    </div>`;
}

// Проверка формы: помечаем неверные поля через aria-invalid.
function validateForm(form) {
  const elements = Array.from(form.elements).filter((element) => element.willValidate);

  elements.forEach((element) => element.removeAttribute('aria-invalid'));

  if (form.checkValidity()) {
    return true;
  }

  elements.forEach((element) => {
    if (!element.checkValidity()) {
      element.setAttribute('aria-invalid', 'true');
    }
  });

  form.reportValidity();
  return false;
}

/* ===============================
   6. Окно быстрого заказа (главная и каталог)
   =============================== */

const orderDialog = document.getElementById('order-dialog');

if (orderDialog) {
  const quickForm = document.getElementById('quick-form');
  const quickItem = document.getElementById('quick-item');
  const quickQty = document.getElementById('quick-qty');
  const quickTotal = document.getElementById('quick-total');
  const quickSuccess = document.getElementById('quick-success');
  const quickFull = document.getElementById('quick-full');
  let quickProduct = null;

  const updateQuick = () => {
    const quantity = readQuantity(quickQty);
    const total = calculateFinalPrice(quickProduct.price, quickProduct.discount) * quantity;

    quickItem.innerHTML = createOrderItemHtml(quickProduct, quantity);
    quickTotal.textContent = `Итого: ${formatPrice(total)}`;
  };

  // Карточки создаются скриптом, поэтому слушаем клик на всём документе.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.product-card__button');

    if (!button) {
      return;
    }

    quickProduct = products.find((product) => product.id === Number(button.dataset.id));

    quickForm.reset();
    fillFromProfile(quickForm, { name: 'name', phone: 'phone' });
    quickForm.hidden = false;
    quickSuccess.hidden = true;
    quickFull.href = `order.html?id=${quickProduct.id}`;
    updateQuick();

    orderDialog.showModal();
  });

  quickQty.addEventListener('input', updateQuick);

  quickForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!validateForm(quickForm)) {
      return;
    }

    const quantity = readQuantity(quickQty);
    const number = createOrderNumber();

    saveOrder({
      number,
      date: new Date().toLocaleDateString('ru-RU'),
      product: quickProduct.name,
      quantity,
      delivery: 'Быстрый заказ',
      total: calculateFinalPrice(quickProduct.price, quickProduct.discount) * quantity
    });

    quickSuccess.textContent = `Спасибо! Заказ № ${number} принят, менеджер перезвонит вам в течение 15 минут.`;
    quickForm.hidden = true;
    quickSuccess.hidden = false;
  });

  document.getElementById('close-order-dialog').addEventListener('click', () => orderDialog.close());
  document.getElementById('close-order-dialog-icon').addEventListener('click', () => orderDialog.close());

  // Закрываем окно по клику на затемнённый фон.
  orderDialog.addEventListener('click', (event) => {
    if (event.target !== orderDialog) {
      return;
    }

    const rect = orderDialog.getBoundingClientRect();

    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (isOutside) {
      orderDialog.close();
    }
  });
}

/* ===============================
   7. Страница оформления заказа
   =============================== */

const orderForm = document.getElementById('order-form');

if (orderForm) {
  const productSelect = document.getElementById('order-product');
  const qtyInput = document.getElementById('order-qty');
  const deliveryFields = document.getElementById('delivery-fields');
  const summaryItem = document.getElementById('summary-item');
  const submitButton = document.getElementById('order-submit');
  const success = document.getElementById('order-success');

  // Список товаров в выпадающем списке: цена уже со скидкой.
  products.forEach((product) => {
    const option = document.createElement('option');
    const price = formatPrice(calculateFinalPrice(product.price, product.discount));

    option.value = product.id;
    option.textContent = product.inStock ? `${product.name}, ${price}` : `${product.name}, нет в наличии`;
    option.disabled = !product.inStock;
    productSelect.append(option);
  });

  fillFromProfile(orderForm, { name: 'name', phone: 'phone', email: 'email', city: 'city' });

  const idFromUrl = Number(new URLSearchParams(window.location.search).get('id'));
  const preselected = products.find((product) => product.id === idFromUrl && product.inStock);

  if (preselected) {
    productSelect.value = preselected.id;
  }

  const updateSummary = () => {
    const product = products.find((item) => item.id === Number(productSelect.value));
    const quantity = readQuantity(qtyInput);
    const method = orderForm.elements.delivery.value;
    const isCourier = method === 'courier';

    // Поля адреса нужны только для курьера.
    deliveryFields.hidden = !isCourier;
    deliveryFields.querySelectorAll('input').forEach((input) => {
      input.disabled = !isCourier;
    });

    if (!product) {
      summaryItem.innerHTML = '<p class="order-summary__empty">Выберите лампу, чтобы увидеть состав заказа.</p>';
      document.getElementById('summary-subtotal').textContent = formatPrice(0);
      document.getElementById('summary-delivery').textContent = formatPrice(0);
      document.getElementById('summary-total').textContent = formatPrice(0);
      submitButton.textContent = 'Оформить заказ';
      return null;
    }

    const subtotal = calculateFinalPrice(product.price, product.discount) * quantity;
    const delivery = calculateDelivery(subtotal, method);

    summaryItem.innerHTML = createOrderItemHtml(product, quantity);
    document.getElementById('summary-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('summary-delivery').textContent = delivery === 0 ? 'Бесплатно' : formatPrice(delivery);
    document.getElementById('summary-total').textContent = formatPrice(subtotal + delivery);
    submitButton.textContent = `Оформить заказ · ${formatPrice(subtotal + delivery)}`;

    return { product, quantity, delivery, total: subtotal + delivery, isCourier };
  };

  orderForm.addEventListener('input', updateSummary);
  orderForm.addEventListener('change', updateSummary);

  // Кнопки «−» и «+» у количества.
  orderForm.querySelectorAll('.qty__button').forEach((button) => {
    button.addEventListener('click', () => {
      const next = readQuantity(qtyInput) + Number(button.dataset.step);

      qtyInput.value = Math.min(MAX_QUANTITY, Math.max(1, next));
      updateSummary();
    });
  });

  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const order = updateSummary();

    if (!validateForm(orderForm) || !order) {
      return;
    }

    const number = createOrderNumber();
    const way = order.isCourier ? 'Доставим курьером' : 'Заберёте в шоуруме на Тверской, 12';

    document.getElementById('order-success-text').textContent =
      `Заказ № ${number}: ${order.product.name} × ${order.quantity}, итого ${formatPrice(order.total)}. ` +
      `${way}. Менеджер свяжется с вами для подтверждения.`;

    saveOrder({
      number,
      date: new Date().toLocaleDateString('ru-RU'),
      product: order.product.name,
      quantity: order.quantity,
      delivery: order.isCourier ? 'Курьер' : 'Самовывоз',
      total: order.total
    });

    orderForm.hidden = true;
    success.hidden = false;
    document.getElementById('order-success-title').focus();
  });

  updateSummary();
}

/* ===============================
   8. Личный кабинет
   =============================== */

const tabs = Array.from(document.querySelectorAll('.tabs__tab'));

if (tabs.length) {
  const selectTab = (tab) => {
    tabs.forEach((item) => {
      const active = item === tab;

      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));

    // Стрелки, Home и End переключают вкладки с клавиатуры.
    tab.addEventListener('keydown', (event) => {
      const next = {
        ArrowRight: tabs[(index + 1) % tabs.length],
        ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
        Home: tabs[0],
        End: tabs[tabs.length - 1]
      }[event.key];

      if (next) {
        event.preventDefault();
        next.focus();
        selectTab(next);
      }
    });
  });

  // Ссылка account.html#orders открывает нужную вкладку.
  const fromHash = tabs.find((tab) => tab.id === `tab-${window.location.hash.slice(1)}`);
  selectTab(fromHash || tabs[0]);

  // Избранное.
  const favoritesGrid = document.getElementById('favorites-grid');
  const favoritesEmpty = document.getElementById('favorites-empty');

  onFavoritesChange = () => {
    const ids = getFavorites();
    const list = products.filter((product) => ids.includes(product.id));

    favoritesEmpty.hidden = list.length > 0;
    renderProducts(favoritesGrid, list, false);
  };

  onFavoritesChange();

  // Заказы.
  const orders = getOrders();

  document.getElementById('orders-empty').hidden = orders.length > 0;
  document.getElementById('orders-wrap').hidden = orders.length === 0;
  // Данные заказов лежат в localStorage, поэтому строки таблицы собираем через textContent.
  const ordersList = document.getElementById('orders-list');

  ordersList.textContent = '';

  orders.forEach((order) => {
    const row = document.createElement('tr');
    const values = [order.number, order.date, order.product, order.quantity, order.delivery, formatPrice(order.total), 'Новый'];

    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');

      cell.className = 'product-table__cell';
      cell.textContent = value;

      if (index === 0) {
        cell.scope = 'row';
      }

      row.append(cell);
    });

    ordersList.append(row);
  });

  // Профиль.
  const profileForm = document.getElementById('profile-form');
  const profileSuccess = document.getElementById('profile-success');
  const profile = getProfile();

  Object.keys(profile).forEach((key) => {
    const field = profileForm.elements[key];

    if (!field) {
      return;
    }

    if (field.type === 'checkbox') {
      field.checked = Boolean(profile[key]);
    } else {
      field.value = profile[key];
    }
  });

  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    profileSuccess.hidden = true;

    if (!validateForm(profileForm)) {
      return;
    }

    writeStorage(PROFILE_KEY, {
      name: profileForm.elements.name.value.trim(),
      email: profileForm.elements.email.value.trim(),
      phone: profileForm.elements.phone.value.trim(),
      city: profileForm.elements.city.value.trim(),
      news: profileForm.elements.news.checked
    });

    profileSuccess.hidden = false;
  });
}

/* ===============================
   9. Вопрос менеджеру (кнопка чата)
   =============================== */

const managerDialog = document.getElementById('manager-dialog');

if (managerDialog) {
  const managerForm = document.getElementById('manager-form');
  const managerSuccess = document.getElementById('manager-success');

  document.querySelectorAll('[data-open-manager]').forEach((button) => {
    button.addEventListener('click', () => {
      managerForm.reset();
      fillFromProfile(managerForm, { name: 'name', email: 'email' });
      managerForm.hidden = false;
      managerSuccess.hidden = true;
      managerDialog.showModal();
    });
  });

  managerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!validateForm(managerForm)) {
      return;
    }

    managerForm.hidden = true;
    managerSuccess.hidden = false;
  });

  document.getElementById('close-manager').addEventListener('click', () => managerDialog.close());
  document.getElementById('close-manager-icon').addEventListener('click', () => managerDialog.close());

  // Закрываем окно по клику на затемнённый фон.
  managerDialog.addEventListener('click', (event) => {
    if (event.target !== managerDialog) {
      return;
    }

    const rect = managerDialog.getBoundingClientRect();

    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      managerDialog.close();
    }
  });
}

/* ===============================
   10. Кнопка «Наверх»
   =============================== */

const toTop = document.querySelector('.to-top');

if (toTop) {
  const chatButton = document.querySelector('.chat-button');

  const updateToTop = () => {
    const scrolled = window.scrollY >= 300;

    toTop.classList.toggle('to-top--hidden', !scrolled);

    // Кнопка чата поднимается над кнопкой «Наверх», когда та появляется.
    if (chatButton) {
      chatButton.classList.toggle('chat-button--raised', scrolled);
    }
  };

  window.addEventListener('scroll', updateToTop, { passive: true });
  updateToTop();
}
