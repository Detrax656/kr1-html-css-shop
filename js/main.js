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
        ? `<button class="button button--secondary product-card__button" type="button" data-product="${product.name}">Заказать</button>`
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
          <a class="button" href="order.html">Оставить заявку</a>
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

/* ===============================
   5. Модальное окно заявки (главная страница)
   =============================== */

const orderDialog = document.getElementById('order-dialog');
const closeDialogButton = document.getElementById('close-order-dialog');
const closeDialogIcon = document.getElementById('close-order-dialog-icon');
const orderDialogTitle = document.getElementById('order-dialog-title');
const selectedProductInput = document.getElementById('selected-product');
const orderForm = document.getElementById('order-form');
const successMessage = document.getElementById('success-message');

// Модальное окно есть только на главной странице.
if (orderDialog) {
  // Карточки создаются скриптом, поэтому слушаем клик на всём документе.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.product-card__button');

    if (!button) {
      return;
    }

    const productName = button.dataset.product;

    selectedProductInput.value = productName;
    orderDialogTitle.textContent = `Заявка: ${productName}`;

    // При каждом открытии показываем форму и прячем прошлое сообщение.
    successMessage.hidden = true;
    orderForm.hidden = false;

    orderDialog.showModal();
  });

  closeDialogButton.addEventListener('click', () => {
    orderDialog.close();
  });

  closeDialogIcon.addEventListener('click', () => {
    orderDialog.close();
  });

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
   6. Отправка формы заявки
   =============================== */

if (orderForm) {
  orderForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formElements = Array.from(orderForm.elements);

    formElements.forEach((element) => {
      if (element.willValidate) {
        element.removeAttribute('aria-invalid');
      }
    });

    if (!orderForm.checkValidity()) {
      formElements.forEach((element) => {
        if (element.willValidate && !element.checkValidity()) {
          element.setAttribute('aria-invalid', 'true');
        }
      });

      orderForm.reportValidity();
      return;
    }

    successMessage.hidden = false;
    orderForm.reset();

    // В модальном окне сообщение показывается вместо формы.
    if (orderDialog) {
      orderForm.hidden = true;
    }
  });
}

/* ===============================
   7. Кнопка «Наверх»
   =============================== */

const toTop = document.querySelector('.to-top');

if (toTop) {
  const updateToTop = () => {
    toTop.classList.toggle('to-top--hidden', window.scrollY < 300);
  };

  window.addEventListener('scroll', updateToTop, { passive: true });
  updateToTop();
}
