const tg = window.Telegram.WebApp
tg.ready()
tg.expand()

checkBlacklist().then(ok => {
  if (!ok) return


if (tg.requestFullscreen) {
  try { tg.requestFullscreen() } catch {}
}

})

const content = document.getElementById('content')
const buttons = document.querySelectorAll('.bottom-nav button')

let userData = null
let currentPage = null

let searchEl = null
let matchmakingInterval = null

let searchTimer = null
let searchStartedAt = null

function enterBattleMode() {
  document.body.classList.add('in-battle')
}

function exitBattleMode() {
  document.body.classList.remove('in-battle')
}


let currentBattleType = null // 'ranked' | 'duel'



async function loadStats() {
  // 👇 если мы не на странице play — выходим
  if (currentPage !== 'play') return

  const totalEl = document.getElementById('total-users')
  const onlineEl = document.getElementById('online-users')

  // 👇 если DOM ещё не готов — выходим
  if (!totalEl || !onlineEl) return

  const res = await fetch('https://prosto777.pythonanywhere.com/stats', {
    method: 'POST'
  })
  const data = await res.json()

  totalEl.textContent = data.total_users
  onlineEl.textContent = data.online_users
}

loadSettings()


let pingInterval = null

function startPing() {
  if (pingInterval) return

  console.log("ПИНГ")

  pingInterval = setInterval(() => {
    console.log("PING TICK", new Date().toLocaleTimeString())
    loadStats()
    fetch('https://prosto777.pythonanywhere.com/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: Telegram.WebApp.initData
      })
    }).catch(() => {})
  }, 30000)
}



// function applyTelegramTheme() {
//   const theme = Telegram.WebApp.themeParams

//   const root = document.documentElement

//   root.style.setProperty('--tg-bg', theme.bg_color)
//   root.style.setProperty('--tg-text', theme.text_color)
//   root.style.setProperty('--tg-hint', theme.hint_color)
//   root.style.setProperty('--tg-btn', theme.button_color)
//   root.style.setProperty('--tg-btn-text', theme.button_text_color)
//   root.style.setProperty('--tg-secondary-bg', theme.secondary_bg_color)
// }

// applyTelegramTheme()


const THEMES = [
  'default.jpg',
  'anime.jpg',
  'neon.jpg',
  'lava.jpg'
]

function applyTheme(themeFile) {
  document.body.style.backgroundImage =
    `url(/themes/${themeFile})`

    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundRepeat = 'no-repeat'
}



function checkBlacklist() {
  return fetch(
    'https://prosto777.pythonanywhere.com/check_blacklist',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: Telegram.WebApp.initData
      })
    }
  )
  .then(res => res.json())
  .then(data => {
    if (data.blocked) {
      Telegram.WebApp.close()
      return false
    }
    return true
  })
  .catch(err => {
    console.error('Blacklist check failed', err)
    return true // на всякий случай пускаем
  })
}



function formatDateDMY(dateStr) {
  if (!dateStr) return '—'

  const d = new Date(dateStr)

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()

  return `${day}/${month}/${year}`
}




const pages = {
 play: () => `
  <div class="play-screen">
    <h1>🎮 Играть</h1>

    <p class="welcome-text">
      Добро пожаловать,
      <span class="welcome-name">${userData?.first_name ?? 'игрок'}</span>
    </p>

    <div class="online-stats">
      <div class="stat">
        <span class="dot gray"></span>
        Игроков всего:
        <b id="total-users">—</b>
      </div>

      <div class="stat">
        <span class="dot green"></span>
        В сети:
        <b id="online-users">—</b>
      </div>
    </div>

    <div class="play-actions">
    <button class="play-button" onclick="startMatchmaking()">
      🔍 Найти соперника
    </button>
  </div>
  <button class="play-button secondary" onclick="openFriendsModal()">
  🤝 Сыграть с друзьями
</button>
</div>

`,

  shop: () => `<div class="shop-screen">
    <h1>🛒 Магазин</h1>

    <div class="gold-balance">
      <span class="gold-label">Ваш баланс</span>
      <div class="gold-value">
        ${userData?.gold ?? 0} 🏵
      </div>
    </div>
  </div>`,

  settings: () => `<h1 class="settings-title">⚙️ Настройки</h1>

  <h3 class="themes-title">🎨 Фон</h3>
  <div class="themes-grid">
    ${THEMES.map(t => `
      <div class="theme-preview"
           onclick="selectTheme('${t}')"
           style="background-image:url(/themes/${t})">
      </div>
    `).join('')}
  </div>

  <h3 class="sound-title">🔊 Звук</h3>

  <div class="sound-row">
    <span class="sound-label">🎶 Музыка</span>

    <label class="switch">
      <input type="checkbox" id="music-toggle">
      <span class="slider"></span>
    </label>
  </div>`,

  rating: () => `<h1>🏆 Рейтинг</h1>
  <div id="top-players-list"></div>
`,

  profile: () => {
  if (!userData || userData.loading) {
    return `
      <div class="profile-card">
        <div class="profile-loading">
          ⏳ Загружаем профиль…
        </div>
      </div>
    `
  }

  return `
    <div class="profile-card">
      <img class="profile-avatar"
        src="${userData.avatar || 'https://via.placeholder.com/96'}"
      />

      <div class="profile-name">
        ${userData.first_name}
      </div>

      <div class="profile-username">
        @${userData.username || 'unknown'}
      </div>

      <div class="profile-stats">
        <div><i><b>⭐️ Рейтинг — ${userData.rating} ⭐️</b></i></div>
        <div><i><b>🎮 Игр — ${userData.games_played} 🎮</b></i></div>
        <div><i><b>✅ Побед — ${userData.wins} ✅</b></i></div>
        <div><i><b>❌ Поражений — ${userData.losses} ❌</b></i></div>
        <div><i><b>🤝 Ничьи — ${userData.draws} 🤝</b></i></div>
        <div><i><b>💎 Очки — ${userData.score} 💎</b></i></div>
      </div>

      <div class="profile-meta">
        <i><b>📆 В игре с ${formatDateDMY(userData.joined_date)}</b></i>
        <div>🆔 Telegram ID — ${userData.telegram_id}</div>
      </div>
    </div>
  `
}


}

const pageOrder = ['play', 'shop', 'settings', 'rating', 'profile']

function openPage(page) {
  if (page === currentPage) return

  const oldIndex = currentPage
    ? pageOrder.indexOf(currentPage)
    : pageOrder.indexOf(page)

  const newIndex = pageOrder.indexOf(page)
  const direction = newIndex > oldIndex ? 'right' : 'left'

  content.className = `page-exit-${direction}`

  setTimeout(() => {
    content.innerHTML = pages[page]()
    content.className = `page-enter-${direction}`
    currentPage = page

    buttons.forEach(btn =>
      btn.classList.toggle('active', btn.dataset.page === page)
    )

    // 👇 просто вызываем, БЕЗ колбэков
    if (page === 'profile') {
      loadProfile()
    }

    if (page === 'play') {
      loadStats()
    }

    
    if (page === 'rating') {
      loadRating()
    }

    if (page === 'settings') {
      loadSettings()
    }

    if (page === 'shop') {
      loadGoldBalance().then(() => {
        content.innerHTML = pages.shop()
      })
      return
  }


   
  }, 200)
}



buttons.forEach(btn => {
  btn.onclick = () => openPage(btn.dataset.page)
})

// старт
content.innerHTML = '<p>⏳ Загрузка...</p>'

async function auth() {
  try {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData
        })
      }
    )

    if (!res.ok) throw new Error('Auth failed')

    userData = await res.json()
    applyTheme(userData.theme || 'default.jpg')
    startPing() 
    openPage('play')

  } catch (e) {
    content.innerHTML = '<p>❌ Ошибка авторизации</p>'
    console.error(e)
  }
}

auth()


async function selectTheme(themeFile) {
  applyTheme(themeFile)

  await fetch('https://prosto777.pythonanywhere.com/settings/theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      theme: themeFile
    })
  })
}



async function loadGoldBalance() {
  try {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/gold/balance',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData
        })
      }
    )

    if (!res.ok) return

    const data = await res.json()

    if (!userData) userData = {}
    userData.gold = data.gold

    console.log('[GOLD]', data.gold)

  } catch (e) {
    console.error('[GOLD ERROR]', e)
  }
}



function openFriendsModal() {
  if (document.querySelector('.modal-overlay')) return

  const modal = document.createElement('div')
  modal.className = 'modal-overlay'

  modal.innerHTML = `
    <div class="friends-modal">
      <div class="modal-header">
        <h2>🤝 Друзья</h2>
        <button class="modal-close">✕</button>
      </div>

      <div class="modal-tabs">
        <button id="tab-friends" class="active">Мои</button>
        <button id="tab-requests">Заявки</button>
        <button id="tab-add">Добавить</button>
      </div>

      <div class="modal-content" id="friends-content">
        <p class="empty-text">Пока пусто 👀</p>
      </div>
    </div>
  `

  modal.querySelector('.modal-close').onclick = () => modal.remove()

  modal.querySelector('#tab-friends').onclick = () => switchFriendsTab('friends')
  modal.querySelector('#tab-requests').onclick = () => switchFriendsTab('requests')
  modal.querySelector('#tab-add').onclick = () => switchFriendsTab('add')

  document.body.appendChild(modal)

  loadFriends()
}



let friendsTab = 'friends'

function switchFriendsTab(tab) {
  friendsTab = tab
  renderFriendsContent()
}


let friendsData = {
  friends: [],
  incoming_requests: [],
  outgoing_requests: []
}

function loadFriends() {
  console.log('[FRIENDS] loading...')

  fetch('https://prosto777.pythonanywhere.com/friends/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })
    .then(r => r.json())
    .then(data => {
      friendsData = data
      console.log('[FRIENDS] loaded', data)
      console.log('[FRIENDS DATA]', friendsData.friends)
      renderFriendsContent()
    })
    .catch(err => {
      console.error('[FRIENDS LOAD ERROR]', err)
    })
}


function renderFriendsContent() {
  const box = document.getElementById('friends-content')
  if (!box) return

  if (friendsTab === 'friends') {
  if (!friendsData.friends.length) {
    box.innerHTML = `<p class="empty-text">Друзей пока нет 👀</p>`
    return
  }

  box.innerHTML = friendsData.friends.map(f => `
  <div class="friend-card improved">
    <img src="${f.avatar}" class="friend-avatar">

    <div class="friend-info">
      <div class="friend-header">
        <div>
          <div class="friend-name">${f.first_name}</div>
          <div class="friend-username">@${f.username || '—'}</div>
        </div>

        <button class="friend-btn play" onclick="sendDuelRequest(${f.id})">🎮</button>
      </div>

      <div class="friend-stats-grid">
        <div>⭐ <b>${f.rating || 0}</b></div>
        <div>🎮 <b>${f.games_played || 0}</b></div>
        <div>✅ <b>${f.wins || 0}</b></div>
        <div>❌ <b>${f.losses || 0}</b></div>
        <div>🤝 <b>${f.draws || 0}</b></div>
        <div>💎 <b>${f.score || 0}</b></div>
      </div>
    </div>
  </div>
`).join('')

}

  //
  if (friendsTab === 'requests') {
  const incoming = friendsData.incoming_requests || []
  const outgoing = friendsData.outgoing_requests || []

  loadDuels().then(duels => {
    const incomingDuels = duels.incoming_duels || []
    const outgoingDuels = duels.outgoing_duels || []

    let html = ''

    // =========================
    // ВХОДЯЩИЕ ДУЭЛИ
    // =========================
    if (incomingDuels.length) {
      html += `<h4 class="requests-title">⚔️ Входящие дуэли</h4>`

      incomingDuels.forEach(u => {
        html += `
          <div class="friend-card small">
            <img src="${u.avatar}" class="friend-avatar">

            <div class="friend-info">
              <div class="friend-name">${u.first_name}</div>
              <div class="friend-username">@${u.username || '—'}</div>

              <div class="friend-stats compact">
                ⭐ ${u.rating || 0}
                · 🎮 ${u.games_played || 0}
                · ✅ ${u.wins || 0}
                · 💎 ${u.score || 0}
              </div>
            </div>

            <div class="friend-actions">
              <button class="friend-btn accept"
                onclick="acceptDuel(${u.duel_id})">✓</button>
              <button class="friend-btn reject"
                onclick="rejectDuel(${u.duel_id})">✕</button>
            </div>
          </div>
        `
      })
    }

    // =========================
    // ИСХОДЯЩИЕ ДУЭЛИ
    // =========================
    if (outgoingDuels.length) {
      html += `<h4 class="requests-title">⚔️ Отправленные дуэли</h4>`

      outgoingDuels.forEach(u => {
        html += `
          <div class="friend-card small muted">
            <img src="${u.avatar}" class="friend-avatar">
            <div class="friend-info">
              <div class="friend-name">${u.first_name}</div>
              <div class="friend-username">@${u.username || '—'}</div>

              <div class="friend-stats compact">
                ⭐ ${u.rating || 0}
                · 🎮 ${u.games_played || 0}
                · ✅ ${u.wins || 0}
                · 💎 ${u.score || 0}
              </div>

              <div class="friend-status">⚔️ Ожидание дуэли</div>
            </div>

            <div class="friend-actions">
          <button class="friend-btn reject"
            onclick="cancelOutgoingDuel(${u.duel_id})">✕</button>
        </div>

          </div>
        `
      })
    }

    // =========================
    // ВХОДЯЩИЕ ЗАЯВКИ В ДРУЗЬЯ
    // =========================
    if (incoming.length) {
      html += `<h4 class="requests-title">📥 Входящие</h4>`
      incoming.forEach(u => {
        html += `
          <div class="friend-card small">
            <img src="${u.avatar}" class="friend-avatar">

            <div class="friend-info">
              <div class="friend-name">${u.first_name}</div>
              <div class="friend-username">@${u.username || '—'}</div>

              <div class="friend-stats compact">
                ⭐ ${u.rating || 0}
                · 🎮 ${u.games_played || 0}
                · ✅ ${u.wins || 0}
                · 💎 ${u.score || 0}
              </div>
            </div>

            <div class="friend-actions">
              <button class="friend-btn accept"
                onclick="acceptFriend(${u.request_id})">✓</button>
              <button class="friend-btn reject"
                onclick="rejectFriend(${u.request_id})">✕</button>
            </div>
          </div>
        `
      })
    }

    // =========================
    // ИСХОДЯЩИЕ ЗАЯВКИ В ДРУЗЬЯ
    // =========================
    if (outgoing.length) {
      html += `<h4 class="requests-title">📤 Отправленные</h4>`
      outgoing.forEach(u => {
        html += `
          <div class="friend-card small muted">
            <img src="${u.avatar}" class="friend-avatar">
            <div class="friend-info">
              <div class="friend-name">${u.first_name}</div>
              <div class="friend-username">@${u.username || '—'}</div>
              <div class="friend-stats">
                ⭐ ${u.rating || 0}
                · 🎮 ${u.games_played || 0}
                · ✅ ${u.wins || 0}
                · 💎 ${u.score || 0}
              </div>
              <div class="friend-status">⏳ Ожидание</div>
            </div>
          </div>
        `
      })
    }

    // если вообще ничего нет
    if (!html) {
      html = `<p class="empty-text">Заявок и дуэлей нет 📭</p>`
    }

    box.innerHTML = html
  })

  return
}



  if (friendsTab === 'add') {
    box.innerHTML = `
      <input id="friend-id-input" class="friend-input" placeholder="Telegram ID">
      <button class="friend-btn" onclick="searchFriend()">🔍 Найти</button>
      <div id="friend-search-result" class="friend-search-result"></div>
    `
  }
}





function searchFriend() {
  const tgId = document.getElementById('friend-id-input').value.trim()
  if (!tgId) return

  fetch('https://prosto777.pythonanywhere.com/friends/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      telegram_id: tgId
    })
  })
    .then(r => r.json())
    .then(data => {
      const res = document.getElementById('friend-search-result')

      if (!data.found) {
        res.innerHTML = `<p class="empty-text">Не найдено</p>`
        return
      }

      const u = data.user   // ✅ ВОТ ТУТ, А НЕ ВЫШЕ

      res.innerHTML = `
        <div class="friend-card big">
    <img src="${u.avatar}" class="friend-avatar">

    <div class="friend-info">
      <div class="friend-name">${u.first_name}</div>
      <div class="friend-username">@${u.username || '—'}</div>

      <div class="friend-stats-full">
        ⭐ Рейтинг — <b>${u.rating || 0}</b><br>
        🎮 Игр — <b>${u.games_played || 0}</b><br>
        ✅ Побед — <b>${u.wins || 0}</b><br>
        ❌ Поражений — <b>${u.losses || 0}</b><br>
        🤝 Ничьи — <b>${u.draws || 0}</b><br>
        💎 Очки — <b>${u.score || 0}</b><br>
        📆 В игре с ${formatDateDMY(u.created_at)}
      </div>
    </div>

    <button class="friend-btn add" onclick="sendFriendRequest(${u.id})">
      ➕ Добавить
    </button>
  </div>
      `
    })
}



function sendFriendRequest(userId) {
  console.log('[FRIENDS] send request to', userId)

  fetch('https://prosto777.pythonanywhere.com/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      user_id: userId
    })
  })
    .then(r => r.json())
    .then(data => {
      const res = document.getElementById('friend-search-result')
      if (res) {
        res.innerHTML = `
          <p class="empty-text">✅ Заявка отправлена</p>
        `
      }

      // 🤝 уже друзья
      if (data.error === 'already_exists') {
        res.innerHTML = `
          <p class="empty-text">🤝 Этот пользователь уже у вас в друзьях</p>
        `
        return
      }


      console.log('[FRIENDS] request sent')
      loadFriends()
    })
    .catch(err => {
      console.error('[FRIEND REQUEST ERROR]', err)
    })
}

function acceptFriend(requestId) {
  fetch('https://prosto777.pythonanywhere.com/friends/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      request_id: requestId
    })
  })
    .then(r => r.json())
    .then(() => loadFriends())
}

function acceptFriend(requestId) {
  fetch('https://prosto777.pythonanywhere.com/friends/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      request_id: requestId
    })
  })
    .then(r => r.json())
    .then(() => loadFriends())
}

function switchFriendsTab(tab) {
  friendsTab = tab

  document.querySelectorAll('.modal-tabs button')
    .forEach(b => b.classList.remove('active'))

  document.getElementById(`tab-${tab}`).classList.add('active')

  renderFriendsContent()
}

function rejectFriend(requestId) {
  fetch('https://prosto777.pythonanywhere.com/friends/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      request_id: requestId
    })
  })
    .then(() => loadFriends())
}




async function sendDuelRequest(userId) {
  console.log('[DUEL] sending to', userId)
  currentBattleType = 'duel'

  try {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/duel/request',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData,
          user_id: userId
        })
      }
    )

    const data = await res.json()
    console.log('[DUEL] response:', data)

    if (data.error === 'already_have_pending_duel') {
      alert('У тебя уже есть активная дуэль ⚔️')
      return
    }


    if (data.error) {
      console.log('Ошибка: ' + data.error)
      return
    }

    closeFriendsModal()
    showSearch()

    // проверяем только наличие боя
    duelInterval = setInterval(checkDuelStatus, 2000)

  } catch (e) {
    console.error('[DUEL ERROR]', e)
  }
}



let duelInterval = null


async function checkDuelStatus() {
  try {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/duel/status',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData
        })
      }
    )

    const data = await res.json()

    if (data.status === 'ready') {
      clearInterval(duelInterval)
      stopSearch()
      enterBattleMode()
      loadBattle()
    }

  } catch (e) {
    console.error('[DUEL STATUS ERROR]', e)
  }
}




async function loadDuels() {
  const res = await fetch('https://prosto777.pythonanywhere.com/duel/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })

  const data = await res.json()
  return data
}


function acceptDuel(duelId) {
  currentBattleType = 'duel'
  fetch('https://prosto777.pythonanywhere.com/duel/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      duel_id: duelId
    })
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        alert(data.error)
        return
      }

      console.log('[DUEL] closing modal...')
      closeFriendsModal()
      // показываем ожидание
      showSearch()

      // ждём появления боя
      duelInterval = setInterval(checkDuelStatus, 2000)
    })
}




function rejectDuel(duelId) {
  fetch('https://prosto777.pythonanywhere.com/duel/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData,
      duel_id: duelId
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      alert(data.error)
      return
    }

    // перезагружаем список заявок
    loadFriends()
  })
}


function closeFriendsModal() {
  console.log('[DUEL] closing modal...2')
  const modal = document.querySelector('.modal-overlay')
  if (modal) {
    console.log('[DUEL] closing modal...3')
    modal.remove()
  }
  else {
    console.log('ERORds 4')
  }
}


async function cancelOutgoingDuel(duelId) {
  console.log('[DUEL] cancel outgoing from requests', duelId)

  try {
    await fetch('https://prosto777.pythonanywhere.com/duel/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: Telegram.WebApp.initData
      })
    })

    // перезагружаем список заявок
    loadFriends()

  } catch (e) {
    console.error('[DUEL CANCEL ERROR]', e)
  }
}



// function loadProfile() {
//   // если уже грузим — не дёргаем ещё раз
//   console.log("MOMENT3")
//   if (userData?.loading) return

//   console.log("MOMENT2")
//   userData = { loading: true }
//   content.innerHTML = pages.profile()

//   fetch('https://prosto777.pythonanywhere.com/profile', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       initData: Telegram.WebApp.initData
//     })
//   })
//     .then(res => {
//       if (!res.ok) throw new Error('profile fetch failed')
//       return res.json()
//     })
//     .then(data => {
//       userData = data

//       // 🔁 если мы всё ещё на профиле — перерисовать
//       if (currentPage === 'profile') {
//         console.log("MOMENT")
//         content.innerHTML = pages.profile()
//       }
//     })
//     .catch(err => {
//       console.error('[PROFILE LOAD ERROR]', err)
//       userData = null
//     })
// }




function loadProfile() {
  console.log("LOAD PROFILE START")

  // ставим loading
  userData = { loading: true }

  // ⚠️ показываем лоадер ТОЛЬКО если мы реально в профиле
  if (currentPage === 'profile') {
    content.innerHTML = pages.profile()
  }

  fetch('https://prosto777.pythonanywhere.com/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })
    .then(res => {
      if (!res.ok) throw new Error('profile fetch failed')
      return res.json()
    })
    .then(data => {
      console.log("PROFILE DATA RECEIVED", data)

      userData = data

      // 🔥 КЛЮЧ: если мы на профиле — ОБЯЗАТЕЛЬНО перерисовать
      if (currentPage === 'profile') {
        console.log("PROFILE RERENDER")
        content.innerHTML = pages.profile()
      }
    })
    .catch(err => {
      console.error('[PROFILE LOAD ERROR]', err)
      userData = null
    })
}




let bgMusic = null
let musicEnabled = false
let musicInitialized = false
let backgroundMusic = null

function loadSettings() {
  fetch('https://prosto777.pythonanywhere.com/settings/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })
    .then(r => r.json())
    .then(data => {
      musicEnabled = data.music_enabled

      const toggle = document.getElementById('music-toggle')
      if (toggle) toggle.checked = musicEnabled

      applyMusicState()
    })
}




// document.addEventListener('change', e => {
//   if (e.target.id === 'music-toggle') {
//     musicEnabled = e.target.checked
//     applyMusicState()

//     fetch('https://prosto777.pythonanywhere.com/settings/set_music', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         initData: Telegram.WebApp.initData,
//         enabled: musicEnabled
//       })
//     })
//   }
// })


document.addEventListener('change', e => {
  if (e.target.id === 'music-toggle') {
    musicEnabled = e.target.checked
    console.log('[SETTINGS] toggle changed →', musicEnabled)

    if (musicEnabled) {
      // ✅ ЭТО USER GESTURE → МОЖНО PLAY
      startMusicFromGesture()
    } else {
      applyMusicState()
    }

    fetch('https://prosto777.pythonanywhere.com/settings/set_music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: Telegram.WebApp.initData,
        enabled: musicEnabled
      })
    })
  }
})




// function applyMusicState() {
//   if (musicEnabled) {
//     if (!bgMusic) {
//       bgMusic = new Audio('music/bg.mp3') // путь потом поменяешь
//       bgMusic.loop = true
//       bgMusic.volume = 0.2
//     }
//     bgMusic.play().catch(() => {})
//   } else {
//     if (bgMusic) {
//       bgMusic.pause()
//       bgMusic.currentTime = 0
//     }
//   }
// }



function applyMusicState() {
  console.log('[AUDIO] applyMusicState enabled =', musicEnabled)

  if (!musicEnabled) {
    if (backgroundMusic) {
      backgroundMusic.pause()
      backgroundMusic.currentTime = 0
      backgroundMusic = null
      musicInitialized = false
      console.log('[AUDIO] stopped')
    }
  }

  // ❌ НЕ ВКЛЮЧАЕМ ЗДЕСЬ
}



function startMusicFromGesture() {
  console.log('[AUDIO] user gesture')

  if (!musicEnabled) {
    console.log('[AUDIO] disabled in settings')
    return
  }

  if (musicInitialized) {
    console.log('[AUDIO] already playing')
    return
  }

  backgroundMusic = new Audio('music/bg.mp3')
  backgroundMusic.loop = true
  backgroundMusic.volume = 0.2

  backgroundMusic.play()
    .then(() => {
      musicInitialized = true
      console.log('[AUDIO] PLAYING ✅')
    })
    .catch(err => {
      console.warn('[AUDIO] BLOCKED ❌', err)
      backgroundMusic = null
      musicInitialized = false
    })
}


document.addEventListener('click', startMusicFromGesture, { once: true })
document.addEventListener('touchstart', startMusicFromGesture, { once: true })



function loadRating() {
  fetch('https://prosto777.pythonanywhere.com/rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })
    .then(res => {
      if (!res.ok) throw new Error('rating fetch failed')
      return res.json()
    })
    .then(data => {
      const list = document.getElementById('top-players-list')
      list.innerHTML = ''

      if (!data.length) {
        list.innerHTML = `<p style="text-align:center;color:#aaa;">Пока пусто</p>`
        return
      }

      data.forEach((player, index) => {
        const card = document.createElement('div')
        card.className = 'player-card'

        let rank = index + 1
        if (index === 0) rank = '🥇'
        else if (index === 1) rank = '🥈'
        else if (index === 2) rank = '🥉'

        const avatar = player.avatar
          ? `<img class="player-avatar" src="${player.avatar}">`
          : `<div class="player-avatar placeholder">
               ${player.first_name?.[0]?.toUpperCase() || '?'}
             </div>`

        card.innerHTML = `
          <div class="player-rank">${rank}</div>
          ${avatar}
          <div class="player-info">
            <div class="player-username">@${player.username || 'unknown'}</div>
            <div class="player-name">${player.first_name || ''}</div>
            <div class="player-score">
              ⭐ ${player.rating}
              &nbsp;|&nbsp;
              ✅ ${player.wins}
              &nbsp;|&nbsp;
              💎 ${player.score}
            </div>
          </div>
        `

        // ✅ подсветка себя — ТЕПЕРЬ ПРАВИЛЬНО
        if (player.is_me) {
          card.classList.add('highlight')
        }

        list.appendChild(card)
      })
    })
    .catch(err => console.error('[RATING LOAD ERROR]', err))
}




Telegram.WebApp.onEvent('viewportChanged', () => {
  if (Telegram.WebApp.isClosing) {
    clearInterval(pingInterval)
    pingInterval = null
  }
})



// function showSearch() {
//   searchStartedAt = Date.now()

//   searchEl = document.createElement('div')
//   searchEl.className = 'search-screen'
//   searchEl.innerHTML = `
//     <div class="magnifier"></div>
//     <div class="search-text" id="search-text">
//       Поиск соперника…
//     </div>
//     <div class="search-time">
//       <span id="search-time">0</span> сек
//     </div>
//     <button class="cancel-search" onclick="cancelMatchmaking()">
//       Отмена
//     </button>
//   `
//   document.body.appendChild(searchEl)

//   searchTimer = setInterval(updateSearchUI, 1000)
// }

// function updateSearchUI() {
//   if (!searchStartedAt) return

//   const seconds = Math.floor((Date.now() - searchStartedAt) / 1000)

//   const timeEl = document.getElementById('search-time')
//   const textEl = document.getElementById('search-text')

//   if (timeEl) {
//     timeEl.textContent = seconds
//   }

//   if (textEl) {
//     const dots = ['.', '..', '...']
//     textEl.textContent =
//       'Поиск соперника' + dots[seconds % dots.length]
//   }
// }

function showSearch() {
  searchStartedAt = Date.now()
  console.log(currentBattleType)

  const text =
    currentBattleType === 'duel'
      ? 'Ожидание друга ⚔️'
      : 'Поиск соперника'

  searchEl = document.createElement('div')
  searchEl.className = 'search-screen'
  searchEl.innerHTML = `
    <div class="search-arena">
      <div class="ring ring-back"></div>
      <div class="ring ring-mid"></div>
      <div class="ring ring-front"></div>
      <div class="vs">VS</div>
    </div>

    <div class="search-text" id="search-text">
      ${text}
    </div>

    <div class="search-time">
      <span id="search-time">0</span> сек
    </div>

    <button class="cancel-search" onclick="${
      currentBattleType === 'duel'
        ? 'cancelDuelSearch()'
        : 'cancelMatchmaking()'
    }">
      Отмена
    </button>
  `

  document.body.appendChild(searchEl)
  searchTimer = setInterval(updateSearchUI, 1000)
}



async function cancelDuelSearch() {
  if (duelInterval) {
    clearInterval(duelInterval)
    duelInterval = null
  }

  await fetch('https://prosto777.pythonanywhere.com/duel/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })

  stopSearch()
  currentBattleType = null
}


// function updateSearchUI() {
//   if (!searchStartedAt) return

//   const seconds = Math.floor((Date.now() - searchStartedAt) / 1000)

//   const timeEl = document.getElementById('search-time')
//   const textEl = document.getElementById('search-text')

//   if (timeEl) timeEl.textContent = seconds

//   if (textEl) {
//     const dots = ['.', '..', '...']
//     textEl.textContent =
//       'Поиск соперника' + dots[seconds % dots.length]
//   }
// }


function updateSearchUI() {
  if (!searchStartedAt) return

  const seconds = Math.floor((Date.now() - searchStartedAt) / 1000)

  const timeEl = document.getElementById('search-time')
  const textEl = document.getElementById('search-text')

  if (timeEl) timeEl.textContent = seconds

  if (textEl) {
    const dots = ['.', '..', '...']

    const baseText =
      currentBattleType === 'duel'
        ? 'Ожидание друга ⚔️'
        : 'Поиск соперника'

    textEl.textContent =
      baseText + dots[seconds % dots.length]
  }
}





function stopSearch() {
  if (searchTimer) {
    clearInterval(searchTimer)
    searchTimer = null
  }

  if (searchEl) {
    searchEl.remove()
    searchEl = null
  }

  searchStartedAt = null
}



async function startMatchmaking() {
  tg.HapticFeedback?.impactOccurred('medium')
  currentBattleType = 'ranked'
  showSearch()

  // старт поиска
  await fetch('https://prosto777.pythonanywhere.com/matchmaking/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  })

  // каждые 2 секунды проверяем статус
  matchmakingInterval = setInterval(checkMatchmakingStatus, 2000)
}


async function checkMatchmakingStatus() {
  try {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/matchmaking/status',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData
        })
      }
    )

    const data = await res.json()

    if (data.status === 'found') {
        stopSearch()
        clearInterval(matchmakingInterval)

        tg.HapticFeedback?.notificationOccurred('success')

        enterBattleMode()
        loadBattle()
    }


  } catch (e) {
    console.error('matchmaking error', e)
  }
}


async function cancelMatchmaking() {
  tg.HapticFeedback?.notificationOccurred('warning')

  await fetch(
    'https://prosto777.pythonanywhere.com/matchmaking/cancel',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: Telegram.WebApp.initData
      })
    }
  )

  stopSearch()
  clearInterval(matchmakingInterval)
}

async function loadBattle() {
  content.innerHTML = '<p>⚔️ Игра начинается...</p>'

  const res = await fetch(
  'https://prosto777.pythonanywhere.com/battle/state',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: Telegram.WebApp.initData
    })
  }
)

if (!res.ok) {
    const err = await res.json()
    console.error('battle error:', err)
    content.innerHTML = '<p>❌ Ошибка загрузки боя</p>'
    return
}

const data = await res.json()
renderBattle(data)
startBattlePolling()

}

const roundInfo = [
  { name: '1-й раунд', type: 'Одинарная игра' },
  { name: '2-й раунд', type: 'Двойная игра' },
  { name: '3-й раунд', type: 'Игра наоборот' }
]


const roundNames = [
  'Одинарная игра',
  'Двойная игра',
  'Игра Наоборот'
]


document.querySelectorAll('.round-name').forEach(
  el => el.textContent = roundInfo[r].name
)

document.querySelectorAll('.round-type').forEach(
  el => el.textContent = roundInfo[r].type
)


// function applyBattleUpdate(update) {
//   if (!update.state) return

//   // 🏁 КОНЕЦ ИГРЫ
//   if (update.game_finished) {
//     console.log('[GAME FINISHED]', update.winner)

//     stopBattlePolling()
//     showGameResultModal(update)
//     return
//   }

//   const state = update.state
//   const isMyTurn = state.turn === 'me'

//   // ❤️ жизни
//   document.querySelector('.player.left .hearts').textContent =
//     '❤️'.repeat(state.lives.me)

//   document.querySelector('.player.right .hearts').textContent =
//     '❤️'.repeat(state.lives.opponent)

//   // 🧮 очки
//   document.querySelector('.player.left .score-value').textContent =
//     state.scores.me

//   document.querySelector('.player.right .score-value').textContent =
//     state.scores.opponent

//   // 🔁 ход
//   document.querySelector('.turn-indicator').textContent =
//     isMyTurn ? 'Ваш ход…' : 'Ход соперника…'

//   document.querySelector('.answer-input').disabled = !isMyTurn
//   document.querySelector('.answer-btn').disabled = !isMyTurn

//   // 🟦 открытие слота
//   if (
//     update.result === 'correct' &&
//     typeof update.matched_index === 'number' &&
//     update.slot &&
//     update.slot.text !== null
//   ) {
//     const i = update.matched_index
//     const slotEl = document.querySelectorAll('.slot')[i]
//     if (slotEl) {
//       slotEl.classList.remove('closed')
//       slotEl.classList.add('open')
//       slotEl.innerHTML = `
//         <span class="slot-text">${update.slot.text}</span>
//         <b class="slot-score">${update.slot.score}</b>
//       `
//     }
//   }

//   // 🔄 КОНЕЦ РАУНДА (НО НЕ ИГРЫ)
//   if (update.round_finished) {
//     console.log('[ROUND END]', update.round_reason)

//     stopBattlePolling()

//     setTimeout(() => {
//       loadBattle() // ✅ ТОЛЬКО ДЛЯ СЛЕДУЮЩЕГО РАУНДА
//     }, 1500)
//   }
// }


let roundTransitionLocked = false

function applyBattleUpdate(update) {
  console.log('--- APPLY UPDATE ---')
  console.log('result:', update.result)
  console.log('matched_index:', update.matched_index)
  console.log('round_finished:', update.round_finished)
  console.log('game_finished:', update.game_finished)

  // if (update.game_finished) {
  //   console.log('🏁 GAME FINISHED')
  //   stopBattlePolling()

  //   // // ❗ ВАЖНО: НЕ РЕНДЕРИМ НИЧЕГО ЗДЕСЬ
  //   // setTimeout(() => {
  //   //   showGameResultModal(update)
  //   // }, 500)

  //   return
  // }

  // if (update.round_finished) {
  //   console.log('🔄 ROUND FINISHED')
  //   stopBattlePolling()

  //   setTimeout(() => {
  //     loadBattle()
  //   }, 2000)

  //   return
  // }

  // ❗ НИКАКОГО DOM КОДА ТУТ
}





// function showGameResultModal(data) {
//   const win = data.winner === 'me'
//   const draw = data.winner === 'draw'

//   const ratingText = draw
//     ? 'Рейтинг без изменений'
//     : win
//       ? '+20 рейтинга'
//       : '-10 рейтинга'

//   const title = draw
//     ? '🤝 Ничья'
//     : win
//       ? '🏆 Победа!'
//       : '💀 Поражение'

//   const modal = document.createElement('div')
//   modal.className = 'result-modal'
//   modal.innerHTML = `
//     <div class="result-card ${win ? 'win' : 'lose'}">
//       <h2>${title}</h2>

//       <div class="result-row">
//         <span>${currentBattleData.me.first_name}</span>
//         <b>${currentBattleData.me.score}</b>
//       </div>

//       <div class="result-row">
//         <span>${currentBattleData.opponent.first_name}</span>
//         <b>${currentBattleData.opponent.score}</b>
//       </div>

//       <div class="rating-change">${ratingText}</div>

//       <button class="result-btn">OK</button>
//     </div>
//   `

//   document.body.appendChild(modal)

//   modal.querySelector('.result-btn').onclick = () => {
//     modal.remove()
//     // openPage('play') // возвращаем в меню
//     currentBattleData = null
//     console.log("O NETTT1")
//     exitBattleMode()
//     // loadProfile()
//     openPage('profile')
//     console.log("O NETTT2")
//   }
// }




// function showGameResultModal(data) {
//   const win = data.winner === 'me'
//   const draw = data.winner === 'draw'

//   const ratingText = draw
//     ? '⭐️ Рейтинг без изменений ⭐️'
//     : win
//       ? '⭐️ +20 рейтинга ⭐️'
//       : '⭐️ -10 рейтинга ⭐️'

//   const title = draw
//     ? '🤝 Ничья'
//     : win
//       ? '🏆 Победа!'
//       : '💀 Поражение'

//   const showRating = currentBattleType === 'ranked'

//   const modal = document.createElement('div')
//   modal.className = 'result-modal'
//   modal.innerHTML = `
//     <div class="result-card ${win ? 'win' : 'lose'}">
//       <h2>${title}</h2>

//       <div class="result-row">
//         <span>${currentBattleData.me.first_name}</span>
//         <b>${currentBattleData.me.score}</b>
//       </div>

//       <div class="result-row">
//         <span>${currentBattleData.opponent.first_name}</span>
//         <b>${currentBattleData.opponent.score}</b>
//       </div>

//       ${showRating ? `<div class="rating-change">${ratingText}</div>` : ''}

//       <button class="result-btn">OK</button>
//     </div>
//   `

//   document.body.appendChild(modal)

//   modal.querySelector('.result-btn').onclick = () => {
//     modal.remove()
//     currentBattleData = null
//     currentBattleType = null
//     exitBattleMode()
//     openPage('profile')
//   }
// }



function showGameResultModal(data) {
  const win = data.winner === 'me'
  const draw = data.winner === 'draw'

  const title = draw
    ? '🤝 Ничья'
    : win
      ? '🏆 Победа!'
      : '💀 Поражение'

  const isRanked = currentBattleType === 'ranked'

  // ===== РЕЙТИНГ =====
  let ratingText = ''
  if (isRanked) {
    ratingText = draw
      ? '⭐️ Рейтинг без изменений ⭐️'
      : win
        ? '⭐️ +20 рейтинга ⭐️'
        : '⭐️ -10 рейтинга ⭐️'
  }

  // ===== ЗОЛОТО =====
  let goldText = ''
  if (isRanked && win) {
    const goldEarned = Math.floor(currentBattleData.me.score * 0.1)
    goldText = `🏵 +${goldEarned} золота 🏵`
  }

  // ===== МОДАЛКА =====
  const modal = document.createElement('div')
  modal.className = 'result-modal'

  modal.innerHTML = `
    <div class="result-card ${win ? 'win' : 'lose'}">
      <h2>${title}</h2>

      <div class="result-row">
        <span>${currentBattleData.me.first_name}</span>
        <b>${currentBattleData.me.score}</b>
      </div>

      <div class="result-row">
        <span>${currentBattleData.opponent.first_name}</span>
        <b>${currentBattleData.opponent.score}</b>
      </div>

      ${
        isRanked
          ? `
            <div class="reward-block">
              <div class="rating-change">${ratingText}</div>
              ${goldText ? `<div class="gold-change">${goldText}</div>` : ''}
            </div>
          `
          : ''
      }

      <button class="result-btn">OK</button>
    </div>
  `

  document.body.appendChild(modal)

  modal.querySelector('.result-btn').onclick = () => {
    modal.remove()
    currentBattleData = null
    currentBattleType = null
    exitBattleMode()
    openPage('profile')
  }
}




let battlePoll = null
let lastStateHash = null

function startBattlePolling() {
  if (battlePoll) return

  battlePoll = setInterval(async () => {
    const res = await fetch(
      'https://prosto777.pythonanywhere.com/battle/state',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: Telegram.WebApp.initData
        })
      }
    )

    // ⛔ бой закончился — прекращаем polling
    if (res.status === 404) {
      console.log('[POLL] battle not found → stop')
      stopBattlePolling()
      return
    }

    if (!res.ok) return
    const data = await res.json()

    const stateHash = JSON.stringify({
      turn: data.turn,
      slots: data.slots,
      meLives: data.me.lives,
      opLives: data.opponent.lives,
      meScore: data.me.score,
      opScore: data.opponent.score
    })

    console.log(
      '[POLL STATE]',
      'round:', data.state.round_index,
      'opened:', data.slots.map(s => s.opened ? 1 : 0).join('')
    )

    if (stateHash !== lastStateHash) {
      console.log('[POLL] state changed')
      lastStateHash = stateHash
      renderBattle(data)
    }

    if (data.game_finished) {
      console.log('[POLL] GAME FINISHED')

      stopBattlePolling()

      setTimeout(() => {
        showGameResultModal(data)
      }, 500)
    }
  }, 1500)
}




function stopBattlePolling() {
  if (battlePoll) {
    clearInterval(battlePoll)
    battlePoll = null
  }
}



let currentBattleData = null
let timerInterval = null


function renderLives(count) {
  return '❤️'.repeat(count)
}


function renderBattle(data) {
  currentBattleData = data

  console.log(
  '[RENDER]',
  'round:', data.me.state.round_index,
  'turn:', data.turn,
  'game_finished:', data.game_finished,
  'round_finished:', data.round_finished
  )

  const hearts = n => '❤️'.repeat(n)
  const isMyTurn = data.turn === 'me'

  // ❗ НИКАКИХ модалок и логики конца игры здесь
  // renderBattle = ТОЛЬКО отрисовка состояния

  data.slots.forEach((s, i) => {
    if (s.opened) {
      console.log(
        `[SLOT OPENED] slot ${i + 1}`,
        'text:', s.text,
        'score:', s.score
      )
    }
  })


  content.innerHTML = `
    <div class="battle-screen">

      <!-- ВЕРХНЯЯ ПАНЕЛЬ -->
      <div class="battle-header">
        <div class="round-title left">
          <div class="round-type">${roundNames[data.me.state.round_index]}</div>
        </div>

        <div class="round-counter">0000</div>

        <div class="round-title right">
          <div class="round-type">${roundNames[data.me.state.round_index]}</div>
        </div>
      </div>

      <!-- ВОПРОС -->
      <div class="battle-question">
        ${data.question}
      </div>

      <!-- ИГРОКИ -->
      <div class="battle-players">

        <!-- Я -->
        <div class="player left">
          <div class="score-box">
            <span class="score-value">${data.me.score}</span>
          </div>

          <img class="avatar" src="${data.me.avatar}">
          <div class="info">
            <div class="name">${data.me.first_name}</div>
            <div class="username">@${data.me.username}</div>
            <div class="hearts">${hearts(data.me.lives)}</div>
            <div class="rating">⭐ ${data.me.rating}</div>
          </div>
        </div>

        <!-- СОПЕРНИК -->
        <div class="player right">
          <div class="score-box">
            <span class="score-value">${data.opponent.score}</span>
          </div>

          <img class="avatar" src="${data.opponent.avatar}">
          <div class="info">
            <div class="name">${data.opponent.first_name}</div>
            <div class="username">@${data.opponent.username}</div>
            <div class="hearts">${hearts(data.opponent.lives)}</div>
            <div class="rating">⭐ ${data.opponent.rating}</div>
          </div>
        </div>

      </div>

      <!-- СЛОТЫ -->
      <div class="slots">
        ${data.slots.map(s => `
          <div class="slot ${s.opened ? 'open' : 'closed'}">
            ${
              s.opened
                ? `
                  <span class="slot-text">${s.text}</span>
                  <b class="slot-score">${s.score}</b>
                `
                : `
                  <div class="slot-dots">
                    <span>•</span><span>•</span><span>•</span>
                  </div>
                  <div class="slot-index">${s.index}</div>
                  <div class="slot-dots">
                    <span>•</span><span>•</span><span>•</span>
                  </div>
                `
            }
          </div>
        `).join('')}
      </div>

      <!-- ХОД -->
      <div class="turn-indicator">
        ${isMyTurn ? 'Ваш ход…' : 'Ход соперника…'}
      </div>

      <div class="wrong-answers"></div>

      <div class="turn-timer">
        <span class="timer-value">01:00</span>
      </div>

      <!-- ВВОД -->
      <div class="answer-box">
        <input
          type="text"
          class="answer-input"
          placeholder="Введите ответ..."
          autocomplete="off"
          ${isMyTurn ? '' : 'disabled'}
        />
        <button class="answer-btn" ${isMyTurn ? '' : 'disabled'}>
          ОК
        </button>
      </div>

    </div>
  `


  const wrongBox = document.querySelector('.wrong-answers')
  if (wrongBox) {
    if (data.wrong_answer) {
      wrongBox.textContent = `❌ ${data.wrong_answer}`
      wrongBox.classList.add('active')
    } else {
      wrongBox.textContent = ''
      wrongBox.classList.remove('active')
    }
  }

  // ✅ обработчик ответа — ТОЛЬКО ЗДЕСЬ
  const btn = document.querySelector('.answer-btn')
  const input = document.querySelector('.answer-input')

  const timerEl = document.querySelector('.timer-value')

  if (timerInterval) {
    clearInterval(timerInterval)
  }

  let secondsLeft = data.time_left ?? 60

  const renderTime = () => {
    const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
    const s = String(secondsLeft % 60).padStart(2, '0')
    timerEl.textContent = `${m}:${s}`
  }

  renderTime()

  timerInterval = setInterval(() => {
    secondsLeft--
    if (secondsLeft < 0) {
      clearInterval(timerInterval)
      return
    }
    renderTime()
  }, 1000)

  if (btn && input) {
    btn.onclick = async () => {
      const text = input.value.trim()
      if (!text) return

      input.value = ''

      try{
        const res = await fetch(
          'https://prosto777.pythonanywhere.com/battle/answer',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              initData: Telegram.WebApp.initData,
              text
            })
          }
        )

        if (!res.ok) return

        const update = await res.json()
        applyBattleUpdate(update)

        // показываем только последний неверный ответ, если он есть
        if (update.result === 'wrong') {
          wrongBox.textContent = text
        }

      } catch (err) {
        console.warn('[ANSWER ERROR]', err)
      }
  }
}


  

  // ✅ обновляем hash состояния (для polling)
  lastStateHash = JSON.stringify({
    turn: data.turn,
    slots: data.slots,
    meLives: data.me.lives,
    opLives: data.opponent.lives,
    meScore: data.me.score,
    opScore: data.opponent.score
  })
}