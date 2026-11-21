/*
  Лампочка-выключатель: тянем за лампочку, лампа «включается»
  и тема сайта меняется. Тёмная тема — свет выключен, светлая — включён.
  Выбор темы сохраняется в localStorage (ключ theme).
*/

const root = document.documentElement;
const pull = document.getElementById('pull');

if (pull) {
  const swing = document.getElementById('swing');
  const cord = document.getElementById('cord');
  const bulbGroup = document.getElementById('bulb-group');

  // ===== Настройки (координаты SVG) =====
  // Длина шнура в покое: на широких экранах лампочка висит ниже, ближе к заголовку.
  const restQueries = [
    [window.matchMedia('(min-width: 1280px)'), 172],
    [window.matchMedia('(min-width: 1024px)'), 133]
  ];

  function getRest() {
    const match = restQueries.find(([query]) => query.matches);
    return match ? match[1] : 100;
  }

  const COMPACT_REST = 93;   // шнур втянут: лампочка почти целиком в шапке, снизу выступает ~10px
  const stickyQuery = window.matchMedia('(min-width: 768px)');

  let compact = false;       // true, когда страница прокручена
  let REST = getRest();      // текущая длина шнура
  let restTarget = REST;     // длина, к которой шнур плавно движется

  function updateRestTarget() {
    restTarget = compact ? COMPACT_REST : getRest();

    if (reduceMotion) {
      REST = restTarget;   // без анимации
    }
  }
  const MAX_PULL = 75;    // насколько максимум можно оттянуть
  const THRESHOLD = 30;   // порог: дальше этого отпускание переключает тему
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== Состояние физики =====
  let pullY = 0;          // растяжение шнура
  let velY = 0;           // скорость растяжения
  let angle = 0;          // угол наклона (градусы)
  let velA = 0;           // угловая скорость
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let moved = 0;
  let running = false;

  // Рисуем текущее состояние: удлиняем шнур, двигаем лампочку, поворачиваем всё вокруг подвеса.
  function draw() {
    const y = REST + pullY;

    cord.setAttribute('y2', y);
    bulbGroup.setAttribute('transform', `translate(30 ${y})`);
    swing.setAttribute('transform', `rotate(${angle} 30 0)`);
  }

  // Физика считается фиксированными шагами по 1/60 секунды, поэтому на мониторах
  // 60, 120 и 144 Гц лампочка двигается одинаково.
  const STEP = 1000 / 60;
  let lastTime = 0;
  let lag = 0;

  // Один шаг физики: две независимые «пружины» (вертикаль и маятник) возвращаются к нулю.
  function step() {
    if (!dragging) {
      velY += -pullY * 0.14;   // сила пружины пропорциональна растяжению
      velY *= 0.82;            // затухание
      pullY += velY;

      velA += -angle * 0.04;   // маятник качается плавно и дольше, затухание слабее
      velA *= 0.96;
      angle += velA;
      angle = Math.max(-25, Math.min(25, angle));
    }

    // Длина шнура плавно подтягивается к цели (около 0,7 с).
    REST += (restTarget - REST) * 0.07;

    if (Math.abs(restTarget - REST) < 0.3) {
      REST = restTarget;
    }
  }

  function tick(now) {
    if (!lastTime) {
      lastTime = now;
    }

    // Накопленное время делим на шаги; ограничение защищает от «прыжка» после паузы вкладки.
    lag += Math.min(now - lastTime, 100);
    lastTime = now;

    while (lag >= STEP) {
      step();
      lag -= STEP;
    }

    draw();

    const still = !dragging
      && REST === restTarget
      && Math.abs(pullY) < 0.05 && Math.abs(velY) < 0.05
      && Math.abs(angle) < 0.05 && Math.abs(velA) < 0.05;

    if (still) {
      pullY = 0;
      angle = 0;
      draw();
      running = false;
      lastTime = 0;
      lag = 0;
      return;
    }

    requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  // ===== Смена темы и вспышка =====
  function toggleTheme() {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';

    root.dataset.theme = next;
    pull.setAttribute('aria-pressed', String(next === 'light'));

    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      // localStorage может быть недоступен — тема просто не сохранится.
    }

    // Лучики показываем только когда лампочка загорается.
    if (next === 'light' && !reduceMotion) {
      pull.classList.remove('burst');
      void pull.getBoundingClientRect();   // перезапускаем анимацию
      pull.classList.add('burst');
    }
  }

  // Рывок без мыши (клавиатура или короткий тап).
  function kick() {
    if (reduceMotion) {
      return;
    }

    velY = 7;
    velA = (Math.random() < 0.5 ? -1 : 1) * 1.6;
    startLoop();
  }

  // ===== Перетаскивание (Pointer Events: мышь, палец, стилус) =====
  pull.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    moved = 0;
    pull.setPointerCapture(e.pointerId);   // ловим движение, даже если курсор ушёл с кнопки
    startLoop();
  });

  pull.addEventListener('pointermove', (e) => {
    if (!dragging) {
      return;
    }

    const dy = Math.max(0, e.clientY - startY);
    const dx = e.clientX - startX;

    moved = Math.max(moved, dy, Math.abs(dx));
    pullY = MAX_PULL * (1 - Math.exp(-dy / MAX_PULL));        // «резинка»: дальше тянешь — тяжелее
    angle = Math.max(-15, Math.min(15, dx * 0.15));           // лампочка наклоняется за курсором
  });

  pull.addEventListener('pointerup', () => {
    if (!dragging) {
      return;
    }

    dragging = false;

    const tapped = moved < 5;   // короткий клик без движения

    if (pullY > THRESHOLD || tapped) {
      toggleTheme();
    }

    if (tapped) {
      kick();
    }

    velY = 0;
    velA = 0;
    startLoop();
  });

  pull.addEventListener('pointercancel', () => {
    dragging = false;
    startLoop();
  });

  // Клавиатура: Enter и пробел вызывают click с detail = 0.
  pull.addEventListener('click', (e) => {
    if (e.detail === 0) {
      toggleTheme();
      kick();
    }
  });

  // При изменении ширины окна пересчитываем длину шнура.
  restQueries.forEach(([query]) => {
    query.addEventListener('change', () => {
      updateRestTarget();
      REST = restTarget;
      draw();
    });
  });

  // Покачивание при прокрутке: там, где шапка закреплена (от 768px), толкаем маятник.
  let lastScroll = window.scrollY;

  window.addEventListener('scroll', () => {
    const delta = window.scrollY - lastScroll;
    lastScroll = window.scrollY;

    // Шнур втягивается после прокрутки на 120px и опускается обратно ниже 60px.
    const shouldCompact = stickyQuery.matches && (compact ? window.scrollY > 60 : window.scrollY > 120);

    if (shouldCompact !== compact) {
      compact = shouldCompact;
      updateRestTarget();
      startLoop();
    }

    if (reduceMotion || dragging || !stickyQuery.matches) {
      return;
    }

    // Лёгкий толчок: сила небольшая и ограничена, чтобы качание было еле заметным.
    if (Math.abs(velA) < 0.18) {
      velA += Math.max(-0.1, Math.min(0.1, delta * -0.001));
    }

    startLoop();
  }, { passive: true });

  // Страница могла открыться уже прокрученной (обновление в середине страницы).
  compact = stickyQuery.matches && window.scrollY > 120;
  updateRestTarget();
  REST = restTarget;

  // Длина шнура с предыдущей страницы: начинаем с неё и плавно идём к нужной,
  // чтобы лампочка не прыгала при переходе между страницами.
  try {
    const saved = Number(sessionStorage.getItem('cordRest'));

    if (saved > 0 && !reduceMotion) {
      REST = saved;
    }
  } catch (e) {
    // sessionStorage недоступен — лампочка просто начнёт с нужной длины.
  }

  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem('cordRest', String(REST));
    } catch (e) {
      // ничего страшного
    }
  });

  // Тема могла измениться на другой странице или во вкладке: при возврате назад
  // (кэш страницы в Android/Chrome) и при возвращении к вкладке перечитываем её.
  function syncTheme() {
    let saved = null;

    try {
      saved = localStorage.getItem('theme');
    } catch (e) {
      return;
    }

    if (saved && saved !== root.dataset.theme) {
      root.dataset.theme = saved;
    }

    pull.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));
  }

  window.addEventListener('pageshow', syncTheme);
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      syncTheme();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncTheme();
    }
  });

  pull.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));
  draw();

  // Показываем лампочку только после первой отрисовки, чтобы не мелькало неверное положение.
  pull.classList.add('pull--ready');

  if (REST !== restTarget) {
    startLoop();
  }
}
