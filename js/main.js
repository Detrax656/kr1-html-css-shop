// Получаем модальное окно по id.
const orderDialog = document.getElementById('order-dialog');

// Получаем все кнопки заказа в карточках товаров.
const orderButtons = document.querySelectorAll('.product-card__button');

// Получаем кнопку закрытия модального окна.
const closeDialogButton = document.getElementById('close-order-dialog');

// Получаем крестик в углу модального окна.
const closeDialogIcon = document.getElementById('close-order-dialog-icon');

// Получаем заголовок модального окна.
const orderDialogTitle = document.getElementById('order-dialog-title');

// Получаем скрытое поле, в которое будет записан выбранный товар.
const selectedProductInput = document.getElementById('selected-product');

// Получаем форму заявки.
const orderForm = document.getElementById('order-form');

// Получаем сообщение об успешной отправке.
const successMessage = document.getElementById('success-message');

// Модальное окно есть только на главной странице, на order.html его нет.
if (orderDialog) {
  // Перебираем все кнопки «Заказать».
  orderButtons.forEach((button) => {
    button.addEventListener('click', () => {

      const productName = button.dataset.product;

      selectedProductInput.value = productName;

      // Показываем название выбранного товара в заголовке окна.
      orderDialogTitle.textContent = `Заявка: ${productName}`;

      // При каждом открытии показываем форму и прячем прошлое сообщение.
      successMessage.hidden = true;
      orderForm.hidden = false;

      orderDialog.showModal();
    });
  });

  // Закрываем модальное окно по кнопке «Закрыть».
  closeDialogButton.addEventListener('click', () => {
    orderDialog.close();
  });

  // Закрываем модальное окно по крестику.
  closeDialogIcon.addEventListener('click', () => {
    orderDialog.close();
  });

  // Закрываем модальное окно по клику на затемнённый фон.
  orderDialog.addEventListener('click', (event) => {
    // Клик по фону приходит на сам dialog, а не на его содержимое.
    if (event.target !== orderDialog) {
      return;
    }

    // Проверяем координаты клика.
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

// Обрабатываем отправку формы.
orderForm.addEventListener('submit', (event) => {

  event.preventDefault();

  const formElements = Array.from(orderForm.elements);

  formElements.forEach((element) => {
    if (element.willValidate) {
      element.removeAttribute('aria-invalid');
    }
  });

  // Проверяем встроенные HTML-ограничения формы.
  if (!orderForm.checkValidity()) {
    formElements.forEach((element) => {
      if (element.willValidate && !element.checkValidity()) {
        element.setAttribute('aria-invalid', 'true');
      }
    });

    // Показываем стандартные сообщения браузера.
    orderForm.reportValidity();
    return;
  }

  // Показываем сообщение об успешной отправке.
  successMessage.hidden = false;

  orderForm.reset();

  // В модальном окне сообщение показывается вместо формы.
  // На странице order.html форма остаётся на месте.
  if (orderDialog) {
    orderForm.hidden = true;
  }
});