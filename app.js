// 가계부 — 기록은 이 기기 안(localStorage)에만 저장합니다.
(function () {
  'use strict';

  var STORE_KEY = 'my-app-gagyebu-records';
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  var $ = function (id) { return document.getElementById(id); };

  // ---------- 저장 ----------
  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function save(records) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- 도우미 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function won(n) { return n.toLocaleString('ko-KR') + '원'; }
  function onlyDigits(s) { return String(s).replace(/[^0-9]/g, ''); }

  function todayKey() { return dayKey(new Date()); }
  function keyToDate(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function shortDate(k) { var d = keyToDate(k); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  function dateLabel(k) { return shortDate(k) + ' (' + DAYS[keyToDate(k).getDay()] + ')'; }
  function shiftKey(k, n) { var d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); }
  function dayRecords(records, key) {
    return records.filter(function (r) { return r.date === key; });
  }
  function sum(list) { return list.reduce(function (a, r) { return a + r.amount; }, 0); }

  // 지금 보고 있는 날짜 (처음엔 오늘)
  var viewKey = todayKey();
  var lastToday = viewKey;

  // ---------- 화면 그리기 ----------
  function render() {
    var today = todayKey();
    lastToday = today;
    if (viewKey > today) viewKey = today;
    var isToday = viewKey === today;

    $('dayTitle').textContent = isToday ? '오늘의 기록' : '지난 기록';
    $('todayDate').textContent = dateLabel(viewKey);
    $('nextDay').disabled = isToday;
    $('goToday').hidden = isToday;
    $('bigLabel').textContent = (isToday ? '오늘' : shortDate(viewKey)) + ' 쓴 돈 · 눌러서 체크';
    $('empty').innerHTML = isToday
      ? '아직 오늘 쓴 돈이 없어요.<br>돈이 나가면 아래 버튼을 눌러 체크하세요.'
      : '이날은 기록이 없어요.<br>아래 버튼을 누르면 이날 쓴 돈을 적을 수 있어요.';

    var list = dayRecords(load(), viewKey).sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
    var ul = $('list');
    ul.innerHTML = '';
    list.forEach(function (r) {
      var li = document.createElement('li');

      var main = document.createElement('div');
      main.className = 'item-main';
      var memo = document.createElement('div');
      memo.className = 'item-memo';
      memo.textContent = r.memo;
      var time = document.createElement('div');
      time.className = 'item-time';
      time.textContent = [r.time, r.place].filter(Boolean).join(' · ');
      main.appendChild(memo);
      main.appendChild(time);

      var amt = document.createElement('div');
      amt.className = 'item-amount';
      amt.textContent = won(r.amount);

      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'edit-btn';
      edit.textContent = '수정';
      edit.setAttribute('aria-label', r.memo + ' ' + won(r.amount) + ' 수정');
      edit.addEventListener('click', function () { openForm(r); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del-btn';
      del.textContent = '지우기';
      del.setAttribute('aria-label', r.memo + ' ' + won(r.amount) + ' 지우기');
      del.addEventListener('click', function () { askDelete(r); });

      var actions = document.createElement('div');
      actions.className = 'item-actions';
      actions.appendChild(edit);
      actions.appendChild(del);

      var side = document.createElement('div');
      side.className = 'item-side';
      side.appendChild(amt);
      side.appendChild(actions);

      li.appendChild(main);
      li.appendChild(side);
      ul.appendChild(li);
    });

    $('empty').hidden = list.length > 0;
    ul.hidden = list.length === 0;
    $('total').textContent = won(sum(list));
  }

  // 날짜 넘기기
  $('prevDay').addEventListener('click', function () { viewKey = shiftKey(viewKey, -1); render(); });
  $('nextDay').addEventListener('click', function () { viewKey = shiftKey(viewKey, 1); render(); });
  $('goToday').addEventListener('click', function () { viewKey = todayKey(); render(); });

  // 오늘의 기록 칸을 좌우로 밀어서 날짜 넘기기 (오른쪽으로 밀면 전날)
  var startX = 0, startY = 0, tracking = false;
  var dayCard = document.querySelector('.today');
  dayCard.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  dayCard.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) viewKey = shiftKey(viewKey, -1);
    else if (viewKey < todayKey()) viewKey = shiftKey(viewKey, 1);
    else return;
    render();
  }, { passive: true });

  // ---------- 키보드가 올라와도 창이 가려지지 않게 ----------
  function fitViewport() {
    var vv = window.visualViewport;
    var root = document.documentElement.style;
    if (!vv) return;
    root.setProperty('--vvh', vv.height + 'px');
    root.setProperty('--vv-top', vv.offsetTop + 'px');
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitViewport);
    window.visualViewport.addEventListener('scroll', fitViewport);
    fitViewport();
  }

  // ---------- 창 열고 닫기 ----------
  function open(id) { $(id).hidden = false; }
  function close(id) { $(id).hidden = true; }
  document.querySelectorAll('.sheet-wrap').forEach(function (wrap) {
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) wrap.hidden = true;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.sheet-wrap').forEach(function (w) { w.hidden = true; });
  });

  // ---------- 1) 지출 체크 ----------
  var memoInput = $('memo');
  var amountInput = $('amount');
  var placeInput = $('place');
  var dateInput = $('date');

  // 교통(교통카드)은 장소를 비워도 됨
  function isTransit(memo) { return memo.indexOf('교통') !== -1; }
  function updatePlaceHint() {
    $('placeHint').textContent = isTransit(memoInput.value) ? '(교통은 비워도 돼요)' : '';
  }

  // 새로 기록할 때는 record 없이, 수정할 때는 그 기록을 넣어서 연다
  var editingId = null;
  function openForm(record) {
    $('addForm').reset();
    $('addError').hidden = true;
    editingId = record ? record.id : null;
    $('addTitle').textContent = record ? '지출 수정' : '지출 체크';
    $('addSubmit').textContent = record ? '저장하기' : '기록하기';
    if (record) {
      memoInput.value = record.memo;
      placeInput.value = record.place || '';
      amountInput.value = record.amount.toLocaleString('ko-KR');
    }
    // 날짜: 새 기록은 지금 보고 있는 날, 수정은 그 기록의 날. 앞날은 고를 수 없음
    dateInput.max = todayKey();
    dateInput.value = record ? record.date : viewKey;
    setQuick(memoInput.value.trim());
    updatePlaceHint();
    open('addSheet');
    $('addForm').scrollTop = 0;
  }
  $('openAdd').addEventListener('click', function () { openForm(null); });

  function setQuick(text) {
    $('quick').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.textContent === text);
    });
  }
  $('quick').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    memoInput.value = b.textContent;
    setQuick(b.textContent);
    updatePlaceHint();
    (isTransit(b.textContent) ? amountInput : placeInput).focus();
  });
  memoInput.addEventListener('input', function () {
    setQuick(memoInput.value.trim());
    updatePlaceHint();
  });

  // 키보드의 '다음' 키를 누르면 다음 칸으로
  memoInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    (isTransit(memoInput.value) ? amountInput : placeInput).focus();
  });
  placeInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    amountInput.focus();
  });

  // 칸을 누르면 키보드가 올라온 뒤 그 칸이 보이게
  $('addForm').addEventListener('focusin', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT') return;
    setTimeout(function () { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
  });

  // 금액은 숫자만, 쉼표를 넣어 보기 좋게
  amountInput.addEventListener('input', function () {
    var digits = onlyDigits(amountInput.value).replace(/^0+/, '').slice(0, 10);
    amountInput.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
  });

  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var memo = memoInput.value.trim() || '기타';
    var place = placeInput.value.trim();
    var amount = Number(onlyDigits(amountInput.value));
    if (!place && !isTransit(memo)) {
      $('addError').textContent = '장소를 넣어 주세요. (교통카드는 비워도 돼요)';
      $('addError').hidden = false;
      placeInput.focus();
      return;
    }
    if (!amount) {
      $('addError').textContent = '금액을 넣어 주세요.';
      $('addError').hidden = false;
      amountInput.focus();
      return;
    }
    var now = new Date();
    var today = dayKey(now);
    var date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : today;
    if (date > today) {
      $('addError').textContent = '앞으로의 날짜는 적을 수 없어요.';
      $('addError').hidden = false;
      dateInput.focus();
      return;
    }
    // 오늘 적는 기록만 시간을 남기고, 지난날 기록은 시간 없이 저장
    var nowTime = date === today ? pad(now.getHours()) + ':' + pad(now.getMinutes()) : '';
    var records = load();
    if (editingId) {
      // 수정: 날짜를 바꾸지 않으면 시간은 그대로 둠
      var found = records.filter(function (r) { return r.id === editingId; })[0];
      if (found) {
        if (found.date !== date) {
          found.date = date;
          found.time = nowTime;
        }
        found.memo = memo;
        found.place = place;
        found.amount = amount;
      }
    } else records.push({
      id: now.getTime() + '-' + Math.random().toString(36).slice(2, 7),
      date: date,
      time: nowTime,
      memo: memo,
      place: place,
      amount: amount
    });
    if (!save(records)) {
      $('addError').textContent = '저장하지 못했어요. 다시 해 주세요.';
      $('addError').hidden = false;
      return;
    }
    if (document.activeElement) document.activeElement.blur(); // 키보드 내리기
    if (navigator.vibrate) navigator.vibrate(15); // 저장되면 살짝 진동 (안드로이드)
    close('addSheet');
    viewKey = date; // 적은 날짜의 기록을 보여 줌
    render();
  });

  // ---------- 2) 지우기 (한 번 묻기) ----------
  var pendingId = null;
  function askDelete(r) {
    pendingId = r.id;
    $('confirmText').textContent = r.memo + ' · ' + won(r.amount);
    open('confirmSheet');
  }
  $('confirmYes').addEventListener('click', function () {
    if (pendingId) {
      save(load().filter(function (r) { return r.id !== pendingId; }));
      pendingId = null;
    }
    close('confirmSheet');
    render();
  });

  // ---------- 3) 그래프 ----------
  $('openChart').addEventListener('click', function () {
    drawCharts();
    open('chartSheet');
  });

  function drawCharts() {
    var records = load();

    // 최근 7일 날짜별
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      var key = dayKey(d);
      days.push({
        label: i === 0 ? '오늘' : DAYS[d.getDay()],
        today: i === 0,
        total: sum(records.filter(function (r) { return r.date === key; }))
      });
    }
    var max = Math.max.apply(null, days.map(function (x) { return x.total; })) || 1;
    var week = $('weekBars');
    week.innerHTML = '';
    days.forEach(function (x) {
      var col = document.createElement('div');
      col.className = 'bar-col' + (x.today ? ' today' : '');
      var val = document.createElement('span');
      val.className = 'bar-val';
      val.textContent = x.total ? x.total.toLocaleString('ko-KR') : '';
      var bar = document.createElement('div');
      bar.className = 'bar' + (x.total ? ' has' : '');
      bar.style.height = Math.max(2, (x.total / max) * 100) + '%';
      var day = document.createElement('span');
      day.className = 'bar-day';
      day.textContent = x.label;
      col.appendChild(val);
      col.appendChild(bar);
      col.appendChild(day);
      week.appendChild(col);
    });
    // 막대 높이가 글자 칸을 빼고 계산되도록 조정
    week.querySelectorAll('.bar').forEach(function (b) {
      b.style.height = 'calc(' + b.style.height + ' * 0.72)';
    });

    // 보고 있는 날의 용도별
    var isToday = viewKey === todayKey();
    $('dayBarsTitle').textContent = (isToday ? '오늘' : shortDate(viewKey)) + ' 용도별 지출';
    var groups = {};
    dayRecords(records, viewKey).forEach(function (r) {
      groups[r.memo] = (groups[r.memo] || 0) + r.amount;
    });
    var items = Object.keys(groups).map(function (k) { return { name: k, total: groups[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
    var box = $('todayBars');
    box.innerHTML = '';
    if (!items.length) {
      var p = document.createElement('p');
      p.className = 'chart-empty';
      p.textContent = isToday ? '오늘은 아직 기록이 없어요.' : '이날은 기록이 없어요.';
      box.appendChild(p);
      return;
    }
    var top = items[0].total;
    items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'hbar-row';
      var name = document.createElement('span');
      name.className = 'hbar-name';
      name.textContent = it.name;
      var track = document.createElement('div');
      track.className = 'hbar-track';
      var fill = document.createElement('div');
      fill.className = 'hbar-fill';
      fill.style.width = Math.max(4, (it.total / top) * 100) + '%';
      track.appendChild(fill);
      var val = document.createElement('span');
      val.className = 'hbar-val';
      val.textContent = won(it.total);
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(val);
      box.appendChild(row);
    });
  }

  // 앱으로 돌아오면 다시 그림. 오늘을 보고 있었다면 자정이 지나도 새 오늘로
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (viewKey === lastToday) viewKey = todayKey();
    render();
  });

  render();

  // ---------- 웹앱(PWA): 서비스 워커 ----------
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // 새 버전이 적용되면 화면을 한 번 자동으로 새로고침
      if (!hadController || reloaded) { hadController = true; return; }
      reloaded = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        reg.update();
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) reg.update();
        });
      }).catch(function () {});
    });
  }
})();
