/* ═══════════════════════════════════════════
   보동보동 — app.js
═══════════════════════════════════════════ */

// ── Supabase 설정 ──
const SUPABASE_URL = 'https://etmghgvyetuxiotyglrj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bWdoZ3Z5ZXR1eGlvdHlnbHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzExNzgsImV4cCI6MjA4ODgwNzE3OH0.cDgYyB9LbH_OZxhEWzNEiPwlBi9SHZZ4XLm3OgBRHdY';
const MEMBER_CODE  = 'bdbd';
const ADMIN_CODE   = 'admin1234';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 앱 상태 ──
let isAdmin        = false;
let allGames       = [];
let gFilters       = { genre: 'all', players: 'all', diff: 'all', avail: 'all' };
let gSort          = 'registered_at';
let currentGameId  = null;
let currentNoticeId = null;
let diffVal        = 1;
let acAll          = [];
let csvParsed      = [];

const SID = (() => {
  let id = localStorage.getItem('_bd_sid');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('_bd_sid', id); }
  return id;
})();

/* ══════════════════════════════════════
   LOGIN
══════════════════════════════════════ */
document.getElementById('code-input').addEventListener('keypress', e => {
  if (e.key === 'Enter') tryLogin();
});

function tryLogin() {
  const v = document.getElementById('code-input').value.trim();
  if (v === ADMIN_CODE)  { isAdmin = true;  enterApp(); }
  else if (v === MEMBER_CODE) { isAdmin = false; enterApp(); }
  else {
    const el = document.getElementById('login-error');
    el.textContent = '❌ 입장 코드가 올바르지 않습니다.';
    document.getElementById('code-input').value = '';
    setTimeout(() => el.textContent = '', 3000);
  }
}

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  const nav = document.getElementById('bottom-nav');
  if (isAdmin) {
    document.getElementById('admin-chip').style.display = '';
    document.getElementById('admin-nav').style.display  = '';
    document.getElementById('tab-approve').style.display = '';
    nav.className = 'bottom-nav nav-5';
  } else {
    nav.className = 'bottom-nav nav-4';
  }

  const d = new Date();
  document.getElementById('topbar-date').textContent =
    `${d.getMonth()+1}/${d.getDate()} (${['일','월','화','수','목','금','토'][d.getDay()]})`;

  loadHome();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function logout() {
  isAdmin = false;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('admin-chip').style.display = 'none';
  document.getElementById('admin-nav').style.display  = 'none';
  document.getElementById('tab-approve').style.display = 'none';
  document.getElementById('code-input').value = '';
}

/* ══════════════════════════════════════
   PAGE NAVIGATION
══════════════════════════════════════ */
function showPage(name) {
  if (name === 'admin' && !isAdmin) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const nb = document.querySelector(`.bnav[data-page="${name}"]`);
  if (nb) nb.classList.add('active');

  if (name === 'home')   loadHome();
  if (name === 'games')  loadGamesPage();
  if (name === 'rental') loadRentalPage();
  if (name === 'notice') loadNotices();
  if (name === 'admin')  loadAdminPage();
}

/* ══════════════════════════════════════
   HOME
══════════════════════════════════════ */
async function loadHome() {
  try {
    const [gRes, rRes, nRes, pRes] = await Promise.all([
      sb.from('games').select('id,is_available'),
      sb.from('rentals').select('id').eq('status', 'approved'),
      sb.from('notices').select('*').order('created_at', { ascending: false }).limit(4),
      sb.from('rentals').select('id').eq('status', 'pending'),
    ]);
    const gs = gRes.data || [], ns = nRes.data || [];
    document.getElementById('st-total').textContent   = gs.length;
    document.getElementById('st-rented').textContent  = (rRes.data||[]).length;
    document.getElementById('st-avail').textContent   = gs.filter(g => g.is_available).length;
    document.getElementById('st-pending').textContent = (pRes.data||[]).length;

    const hn = document.getElementById('home-notices');
    hn.innerHTML = ns.length
      ? ns.map(n => `
        <div class="hnotice-item">
          <span class="pill ${catPill(n.category)}">${catLabel(n.category)}</span>
          <div class="hnotice-txt">${esc(n.title)}</div>
          <div class="hnotice-date">${fmt(n.created_at)}</div>
        </div>`).join('')
      : '<div class="empty"><div class="ei">📭</div><p>공지가 없어요</p></div>';

    const { data: activeRent } = await sb.from('rentals')
      .select('*').in('status', ['approved', 'pending'])
      .order('rented_at', { ascending: false }).limit(5);
    const hrEl = document.getElementById('home-rentals');
    if (!activeRent || !activeRent.length) {
      hrEl.innerHTML = '<div class="empty"><div class="ei">📭</div><p>대여 중인 게임이 없어요</p></div>';
    } else {
      const gids = [...new Set(activeRent.map(r => r.game_id))];
      const { data: gl } = await sb.from('games').select('id,title').in('id', gids);
      const gmap = Object.fromEntries((gl||[]).map(g => [g.id, g.title]));
      hrEl.innerHTML = activeRent.map(r => `
        <div class="hrental-item">
          <div>
            <div class="hrental-name">${esc(gmap[r.game_id] || '?')}</div>
            <div class="hrental-who">${esc(r.renter_name)} · ${r.status === 'pending' ? '승인 대기중' : r.due_date ? '~' + fmt(r.due_date) : ''}</div>
          </div>
          <span class="pill ${r.status === 'pending' ? 'p-yellow' : 'p-red'}">${r.status === 'pending' ? '⏳ 대기' : '대여중'}</span>
        </div>`).join('');
    }
  } catch(e) { console.error(e); }
}

/* ══════════════════════════════════════
   GAMES
══════════════════════════════════════ */
async function loadGamesPage() {
  document.getElementById('games-list').innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data, error } = await sb.from('games_with_stats').select('*');
  if (error) { document.getElementById('games-list').innerHTML = `<div class="empty"><p>오류: ${error.message}</p></div>`; return; }
  allGames = data || [];
  renderGames();
}

function renderGames() {
  const q = (document.getElementById('srch-q')?.value || '').toLowerCase();
  let list = allGames.filter(g => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (gFilters.genre !== 'all' && g.genre !== gFilters.genre) return false;
    if (gFilters.players === '2' && g.min_players > 2) return false;
    if (gFilters.players === '4' && g.max_players < 4) return false;
    if (gFilters.players === '6' && g.max_players < 6) return false;
    if (gFilters.diff === 'easy' && g.difficulty > 2) return false;
    if (gFilters.diff === 'mid'  && (g.difficulty < 2 || g.difficulty > 3)) return false;
    if (gFilters.diff === 'hard' && g.difficulty < 4) return false;
    if (gFilters.avail === 'yes' && !g.is_available) return false;
    return true;
  });
  list.sort((a, b) => {
    if (gSort === 'recommend_count') return (b.recommend_count||0) - (a.recommend_count||0);
    if (gSort === 'min_players')     return a.min_players - b.min_players;
    if (gSort === 'min_time')        return a.min_time - b.min_time;
    if (gSort === 'difficulty')      return a.difficulty - b.difficulty;
    return new Date(b.registered_at) - new Date(a.registered_at);
  });

  const el = document.getElementById('games-list');
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="ei">🔍</div><p>조건에 맞는 게임이 없어요</p></div>'; return; }
  el.innerHTML = list.map(g => `
    <div class="gitem" onclick="openGameModal('${g.id}')">
      <div class="gthumb">
        ${g.image_url
          ? `<img src="${esc(g.image_url)}" alt="${esc(g.title)}" loading="lazy" onerror="this.parentElement.innerHTML='🎲'">`
          : '🎲'}
      </div>
      <div class="gbody">
        <div class="ggenre">${esc(g.genre)}</div>
        <div class="gtitle">${esc(g.title)}</div>
        <div class="gtags">
          <span class="pill p-yellow">👥 ${g.min_players}~${g.max_players}명</span>
          <span class="pill p-blue">⏱ ${g.min_time}~${g.max_time}분</span>
          <span class="pill p-purple">${'★'.repeat(g.difficulty)}${'☆'.repeat(5-g.difficulty)}</span>
          <span class="pill ${g.is_available ? 'p-green' : 'p-red'}">${g.is_available ? '✅ 가능' : '❌ 대여중'}</span>
        </div>
        <div class="gfoot">
          <div class="gstats">👍 ${g.recommend_count||0} · 💬 ${g.review_count||0}</div>
          <div style="font-size:.68rem;color:var(--text3)">${fmt(g.registered_at)}</div>
        </div>
      </div>
    </div>`).join('');
}

function gFilter(type, val, btn) {
  if (type === 'avail') {
    const isOn = btn.classList.contains('on');
    btn.classList.toggle('on', !isOn);
    gFilters.avail = isOn ? 'all' : 'yes';
    renderGames(); return;
  }
  gFilters[type] = val;
  const row = btn.closest('.filter-scroll');
  if (row) row.querySelectorAll('.ftag').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderGames();
}

function setSort(val, btn) {
  gSort = val;
  btn.closest('.sort-bar').querySelectorAll('.ftag').forEach(b => {
    if (b.id !== 'avail-filter') b.classList.remove('on');
  });
  btn.classList.add('on');
  renderGames();
}

/* ══════════════════════════════════════
   GAME MODAL
══════════════════════════════════════ */
async function openGameModal(id) {
  currentGameId = id;
  document.getElementById('game-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  const { data: g } = await sb.from('games_with_stats').select('*').eq('id', id).single();
  if (!g) return;

  document.getElementById('m-hero').innerHTML = g.image_url
    ? `<img src="${esc(g.image_url)}" alt="${esc(g.title)}">
       <div class="mhero-avail"><span class="pill ${g.is_available ? 'p-green' : 'p-red'}">${g.is_available ? '✅ 대여가능' : '❌ 대여중'}</span></div>`
    : `🎲<div class="mhero-avail"><span class="pill ${g.is_available ? 'p-green' : 'p-red'}">${g.is_available ? '✅ 대여가능' : '❌ 대여중'}</span></div>`;

  document.getElementById('m-genre').textContent = g.genre;
  document.getElementById('m-title').textContent = g.title;
  document.getElementById('m-tags').innerHTML = `
    <span class="pill p-yellow">👥 ${g.min_players}~${g.max_players}명</span>
    <span class="pill p-blue">⏱ ${g.min_time}~${g.max_time}분</span>
    <span class="pill p-purple">${'★'.repeat(g.difficulty)}${'☆'.repeat(5-g.difficulty)}</span>
    <span class="pill p-gray">📅 ${fmt(g.registered_at)}</span>`;
  document.getElementById('m-desc').textContent = g.description || '게임 설명이 없습니다.';
  document.getElementById('m-yt').innerHTML = g.youtube_url
    ? `<a href="${esc(g.youtube_url)}" target="_blank" rel="noopener">
         <button class="btn btn-sm" style="background:#FF0000;color:white">▶ 유튜브</button>
       </a>` : '';

  const { count } = await sb.from('recommendations').select('id', { count: 'exact', head: true }).eq('game_id', id);
  const { data: myR } = await sb.from('recommendations').select('id').eq('game_id', id).eq('session_id', SID);
  document.getElementById('rec-num').textContent = count || 0;
  document.getElementById('rec-btn').classList.toggle('liked', !!(myR && myR.length));
  loadReviews(id);
}

async function loadReviews(id) {
  const { data } = await sb.from('reviews').select('*').eq('game_id', id).order('created_at', { ascending: false });
  const list = data || [];
  document.getElementById('rev-count').textContent = `(${list.length}개)`;
  document.getElementById('rev-list').innerHTML = list.length
    ? list.map(r => `
      <div class="rev-line">
        <div class="rev-nick-lbl">✍️ ${esc(r.nickname)}</div>
        <div class="rev-txt">${esc(r.content)}</div>
        <div class="rev-date">${fmt(r.created_at)}</div>
      </div>`).join('')
    : '<div style="font-size:.8rem;color:var(--text3);padding:.5rem 0">첫 번째 한줄평을 남겨보세요!</div>';
}

async function submitReview() {
  const nick = document.getElementById('rev-nick').value.trim();
  const text = document.getElementById('rev-text').value.trim();
  if (!nick || !text) { showToast('닉네임과 내용을 입력해주세요'); return; }
  await sb.from('reviews').insert({ game_id: currentGameId, nickname: nick, content: text });
  document.getElementById('rev-text').value = '';
  loadReviews(currentGameId);
  showToast('✍️ 한줄평이 등록됐어요!');
}

async function toggleRec() {
  const { data: ex } = await sb.from('recommendations').select('id').eq('game_id', currentGameId).eq('session_id', SID);
  const btn = document.getElementById('rec-btn');
  const num = parseInt(document.getElementById('rec-num').textContent) || 0;
  if (ex && ex.length) {
    await sb.from('recommendations').delete().eq('game_id', currentGameId).eq('session_id', SID);
    btn.classList.remove('liked');
    document.getElementById('rec-num').textContent = Math.max(0, num - 1);
  } else {
    await sb.from('recommendations').insert({ game_id: currentGameId, session_id: SID });
    btn.classList.add('liked');
    document.getElementById('rec-num').textContent = num + 1;
    showToast('👍 추천했어요!');
  }
}

function closeGameModal(e) {
  if (!e || e.target === document.getElementById('game-modal')) {
    document.getElementById('game-modal').classList.remove('open');
    document.body.style.overflow = '';
    currentGameId = null;
  }
}

/* ══════════════════════════════════════
   RENTAL
══════════════════════════════════════ */
function loadRentalPage() {
  loadRentalStatus();
  if (isAdmin) loadApproveList();
  populateAC();
}

function rentalTab(tab, btn) {
  btn.closest('.tab-row').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rt-apply').style.display   = tab === 'apply'   ? '' : 'none';
  document.getElementById('rt-status').style.display  = tab === 'status'  ? '' : 'none';
  document.getElementById('rt-approve').style.display = tab === 'approve' ? '' : 'none';
  if (tab === 'status')  loadRentalStatus();
  if (tab === 'approve') loadApproveList();
}

async function populateAC() {
  const { data } = await sb.from('games').select('id,title,image_url,is_available').order('title');
  acAll = data || [];
}

function acSearch(q) {
  const list = document.getElementById('ac-list');
  if (!q.trim()) { list.classList.remove('open'); document.getElementById('r-game-id').value = ''; return; }
  const matches = acAll.filter(g => g.title.toLowerCase().includes(q.toLowerCase())).slice(0, 7);
  if (!matches.length) { list.classList.remove('open'); return; }
  list.innerHTML = matches.map(g => `
    <div class="ac-item" onclick="acSelect('${g.id}','${esc(g.title)}',${g.is_available})">
      <div class="ac-thumb">
        ${g.image_url ? `<img src="${esc(g.image_url)}" onerror="this.parentElement.innerHTML='🎲'">` : '🎲'}
      </div>
      <div>
        <div class="ac-title">${esc(g.title)}</div>
        <div class="ac-avail">${g.is_available ? '✅ 대여가능' : '❌ 대여중 (신청 불가)'}</div>
      </div>
    </div>`).join('');
  list.classList.add('open');
}

function acSelect(id, title, avail) {
  document.getElementById('r-game-input').value = title;
  document.getElementById('r-game-id').value    = avail ? id : '';
  document.getElementById('ac-list').classList.remove('open');
  if (!avail) showToast('현재 대여 중인 게임이에요 😢');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap')) {
    document.getElementById('ac-list')?.classList.remove('open');
  }
});

async function submitRental() {
  const name   = document.getElementById('r-name').value.trim();
  const gameId = document.getElementById('r-game-id').value;
  const period = parseInt(document.getElementById('r-period').value);
  const note   = document.getElementById('r-note').value.trim();
  if (!name)   { showToast('이름을 입력해주세요'); return; }
  if (!gameId) { showToast('대여 가능한 게임을 선택해주세요'); return; }
  const { error } = await sb.from('rentals').insert({
    game_id: gameId, renter_name: name, note, period_days: period, status: 'pending'
  });
  if (error) { showToast('오류: ' + error.message); return; }
  document.getElementById('r-name').value = '';
  document.getElementById('r-game-input').value = '';
  document.getElementById('r-game-id').value = '';
  document.getElementById('r-note').value = '';
  showToast('✅ 신청 완료! 관리자 승인을 기다려주세요 🎲');
  loadHome();
}

async function loadRentalStatus() {
  const el = document.getElementById('rental-status-list');
  el.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data: all } = await sb.from('rentals').select('*')
    .in('status', ['approved', 'pending', 'returned'])
    .order('rented_at', { ascending: false }).limit(30);
  if (!all || !all.length) { el.innerHTML = '<div class="empty"><div class="ei">📭</div><p>대여 내역이 없어요</p></div>'; return; }
  const gids = [...new Set(all.map(r => r.game_id))];
  const { data: gl } = await sb.from('games').select('id,title').in('id', gids);
  const gmap = Object.fromEntries((gl||[]).map(g => [g.id, g.title]));
  const statusMap = { pending: '⏳ 대기중', approved: '📦 대여중', returned: '✅ 반납' };
  const pillMap   = { pending: 'p-yellow',  approved: 'p-red',     returned: 'p-green' };
  el.innerHTML = all.map(r => `
    <div class="ritem">
      <div class="ritem-head">
        <div>
          <div class="ritem-title">${esc(gmap[r.game_id] || '?')}</div>
          <div class="ritem-meta">${esc(r.renter_name)} · 신청 ${fmt(r.rented_at)}</div>
        </div>
        <span class="pill ${pillMap[r.status]}">${statusMap[r.status]}</span>
      </div>
      ${r.due_date ? `<div style="font-size:.75rem;color:var(--text2)">반납예정 ${fmt(r.due_date)}</div>` : ''}
      ${r.note     ? `<div style="font-size:.75rem;color:var(--text2);margin-top:.3rem">📝 ${esc(r.note)}</div>` : ''}
      ${isAdmin && r.status === 'approved'
        ? `<div class="ritem-foot"><div></div>
             <div class="ritem-actions">
               <button class="btn btn-green btn-sm" onclick="returnGame('${r.id}','${r.game_id}')">반납 처리</button>
             </div></div>` : ''}
    </div>`).join('');
}

async function loadApproveList() {
  const el = document.getElementById('rental-approve-list');
  el.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data: pending } = await sb.from('rentals').select('*').eq('status', 'pending').order('rented_at');
  if (!pending || !pending.length) {
    el.innerHTML = '<div class="empty"><div class="ei">🎉</div><p>대기 중인 신청이 없어요</p></div>'; return;
  }
  const gids = [...new Set(pending.map(r => r.game_id))];
  const { data: gl } = await sb.from('games').select('id,title').in('id', gids);
  const gmap = Object.fromEntries((gl||[]).map(g => [g.id, g.title]));
  el.innerHTML = pending.map(r => `
    <div class="ritem">
      <div class="ritem-head">
        <div>
          <div class="ritem-title">${esc(gmap[r.game_id] || '?')}</div>
          <div class="ritem-meta">${esc(r.renter_name)} · ${r.period_days}일 · 신청 ${fmt(r.rented_at)}</div>
          ${r.note ? `<div style="font-size:.73rem;color:var(--text2);margin-top:.2rem">📝 ${esc(r.note)}</div>` : ''}
        </div>
        <span class="pill p-yellow">⏳ 대기</span>
      </div>
      <div class="ritem-foot"><div></div>
        <div class="ritem-actions">
          <button class="btn btn-red btn-sm" onclick="rejectRental('${r.id}')">거절</button>
          <button class="btn btn-primary btn-sm" onclick="approveRental('${r.id}','${r.game_id}',${r.period_days})">✅ 승인</button>
        </div>
      </div>
    </div>`).join('');
}

async function approveRental(rentalId, gameId, days) {
  const due = new Date(); due.setDate(due.getDate() + days);
  await sb.from('rentals').update({
    status: 'approved', approved_at: new Date().toISOString(), due_date: due.toISOString()
  }).eq('id', rentalId);
  await sb.from('games').update({ is_available: false }).eq('id', gameId);
  loadApproveList(); loadHome();
  showToast('✅ 대여 승인 완료!');
}
async function rejectRental(rentalId) {
  if (!confirm('신청을 거절할까요?')) return;
  await sb.from('rentals').update({ status: 'rejected' }).eq('id', rentalId);
  loadApproveList(); loadHome();
  showToast('🚫 신청이 거절됐어요.');
}
async function returnGame(rentalId, gameId) {
  await sb.from('rentals').update({ status: 'returned', returned_at: new Date().toISOString() }).eq('id', rentalId);
  await sb.from('games').update({ is_available: true }).eq('id', gameId);
  loadRentalStatus(); loadHome();
  showToast('📬 반납 처리 완료!');
}

/* ══════════════════════════════════════
   NOTICE
══════════════════════════════════════ */
async function loadNotices() {
  const el = document.getElementById('notice-list');
  el.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data } = await sb.from('notices').select('*').order('created_at', { ascending: false });
  const list = data || [];
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="ei">📭</div><p>공지가 없어요</p></div>'; return; }
  el.innerHTML = list.map(n => `
    <div class="nitem" onclick="openNoticeModal('${n.id}')">
      <div class="nitem-head">
        <span class="pill ${catPill(n.category)}">${catLabel(n.category)}</span>
        <div class="nitem-title">${esc(n.title)}</div>
      </div>
      <div class="nitem-body">${esc(n.content)}</div>
      <div class="nitem-foot">
        <div class="nitem-date">${fmt(n.created_at)}${n.updated_at !== n.created_at ? ' (수정됨)' : ''}</div>
      </div>
    </div>`).join('');
}

async function openNoticeModal(id) {
  currentNoticeId = id;
  const { data: n } = await sb.from('notices').select('*').eq('id', id).single();
  if (!n) return;
  document.getElementById('nm-badge').className   = `pill ${catPill(n.category)}`;
  document.getElementById('nm-badge').textContent = catLabel(n.category);
  document.getElementById('nm-title').textContent   = n.title;
  document.getElementById('nm-meta').textContent    = fmt(n.created_at) + (n.updated_at !== n.created_at ? ' · 수정됨' : '');
  document.getElementById('nm-content').textContent = n.content;
  document.getElementById('notice-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeNoticeModal(e) {
  if (!e || e.target === document.getElementById('notice-modal')) {
    document.getElementById('notice-modal').classList.remove('open');
    document.body.style.overflow = '';
    currentNoticeId = null;
  }
}

/* ══════════════════════════════════════
   ADMIN
══════════════════════════════════════ */
function loadAdminPage() {
  if (!isAdmin) return;
  loadAdminNotices();
}

function adminTab(tab, btn) {
  document.querySelectorAll('.admin-tabs-row .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['game', 'notice', 'gamelist', 'csv'].forEach(t => {
    document.getElementById('at-' + t).style.display = t === tab ? '' : 'none';
  });
  if (tab === 'notice')   loadAdminNotices();
  if (tab === 'gamelist') loadAdminGameList();
}

/* ── 이미지 업로드 ── */
async function handleImgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  showToast('📸 이미지 업로드 중...');
  const ext  = file.name.split('.').pop();
  const path = `${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('game-images').upload(path, file, { upsert: true });
  if (error) { showToast('업로드 실패: ' + error.message); return; }
  const { data: { publicUrl } } = sb.storage.from('game-images').getPublicUrl(path);
  document.getElementById('ag-img-url').value = publicUrl;
  const drop = document.getElementById('img-drop');
  drop.innerHTML = `<img src="${publicUrl}"><div class="img-drop-txt" style="background:rgba(0,0,0,.4);color:white;width:100%;text-align:center;padding:.3rem;position:relative;z-index:1">변경하려면 탭</div>`;
  showToast('✅ 이미지 업로드 완료!');
}

function setDiff(v) {
  diffVal = v;
  document.getElementById('ag-diff').value = v;
  document.querySelectorAll('#star-row .star-btn').forEach(b => b.classList.toggle('on', +b.dataset.v <= v));
}

async function addGame() {
  const title = document.getElementById('ag-title').value.trim();
  const minP  = +document.getElementById('ag-minp').value;
  const maxP  = +document.getElementById('ag-maxp').value;
  const minT  = +document.getElementById('ag-mint').value;
  const maxT  = +document.getElementById('ag-maxt').value;
  if (!title || !minP || !maxP || !minT || !maxT) { showToast('필수 항목을 모두 입력해주세요'); return; }
  const { error } = await sb.from('games').insert({
    title,
    image_url:   document.getElementById('ag-img-url').value || null,
    min_players: minP, max_players: maxP,
    min_time:    minT, max_time:    maxT,
    genre:       document.getElementById('ag-genre').value,
    difficulty:  +document.getElementById('ag-diff').value || 1,
    description: document.getElementById('ag-desc').value.trim() || null,
    youtube_url: document.getElementById('ag-yt').value.trim()   || null,
    is_available: document.getElementById('ag-avail').value === 'true',
  });
  if (error) { showToast('오류: ' + error.message); return; }
  ['ag-title','ag-desc','ag-yt','ag-img-url','ag-minp','ag-maxp','ag-mint','ag-maxt'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('img-drop').innerHTML = `<span style="font-size:1.8rem">📸</span><div class="img-drop-txt">탭하여 이미지 업로드</div>`;
  setDiff(1);
  showToast('🎲 게임이 등록됐어요!');
}

/* ── 공지 관리 ── */
async function loadAdminNotices() {
  const el = document.getElementById('admin-notice-list');
  el.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data } = await sb.from('notices').select('*').order('created_at', { ascending: false });
  const list = data || [];
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="ei">📭</div><p>공지가 없어요</p></div>'; return; }
  el.innerHTML = list.map(n => `
    <div class="ritem" style="margin-bottom:.5rem">
      <div class="ritem-head">
        <div>
          <span class="pill ${catPill(n.category)}" style="margin-bottom:.3rem">${catLabel(n.category)}</span>
          <div class="ritem-title">${esc(n.title)}</div>
          <div class="ritem-meta">${fmt(n.created_at)}</div>
        </div>
      </div>
      <div style="font-size:.8rem;color:var(--text2);margin:.4rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.content)}</div>
      <div class="ritem-foot"><div></div>
        <div class="ritem-actions">
          <button class="btn btn-outline btn-sm" onclick="editNotice('${n.id}')">✏️ 수정</button>
          <button class="btn btn-red btn-sm" onclick="deleteNotice('${n.id}')">🗑 삭제</button>
        </div>
      </div>
    </div>`).join('');
}

async function submitNotice() {
  const title    = document.getElementById('an-title').value.trim();
  const content  = document.getElementById('an-content').value.trim();
  const category = document.getElementById('an-cat').value;
  const editId   = document.getElementById('an-edit-id').value;
  if (!title || !content) { showToast('제목과 내용을 입력해주세요'); return; }
  if (editId) {
    await sb.from('notices').update({ title, content, category, updated_at: new Date().toISOString() }).eq('id', editId);
    showToast('✅ 공지가 수정됐어요!');
    cancelNoticeEdit();
  } else {
    await sb.from('notices').insert({ title, content, category });
    showToast('📢 공지가 등록됐어요!');
  }
  document.getElementById('an-title').value   = '';
  document.getElementById('an-content').value = '';
  loadAdminNotices();
}

async function editNotice(id) {
  const { data: n } = await sb.from('notices').select('*').eq('id', id).single();
  if (!n) return;
  document.getElementById('an-edit-id').value  = n.id;
  document.getElementById('an-cat').value      = n.category;
  document.getElementById('an-title').value    = n.title;
  document.getElementById('an-content').value  = n.content;
  document.getElementById('notice-form-title').textContent = '✏️ 공지 수정';
  document.getElementById('an-submit-btn').textContent     = '✅ 수정하기';
  document.getElementById('an-cancel-btn').style.display   = '';
  document.getElementById('notice-form-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelNoticeEdit() {
  document.getElementById('an-edit-id').value = '';
  document.getElementById('an-title').value   = '';
  document.getElementById('an-content').value = '';
  document.getElementById('notice-form-title').textContent = '📢 공지 등록';
  document.getElementById('an-submit-btn').textContent     = '📢 등록하기';
  document.getElementById('an-cancel-btn').style.display   = 'none';
}

async function deleteNotice(id) {
  if (!confirm('공지를 삭제할까요?')) return;
  await sb.from('notices').delete().eq('id', id);
  loadAdminNotices();
  showToast('🗑 삭제됐어요.');
}

/* ── 게임 목록 관리 ── */
async function loadAdminGameList() {
  const el = document.getElementById('admin-game-list');
  el.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  const { data } = await sb.from('games').select('*').order('registered_at', { ascending: false });
  const list = data || [];
  if (!list.length) { el.innerHTML = '<div class="empty"><div class="ei">🎲</div><p>게임이 없어요</p></div>'; return; }
  el.innerHTML = list.map(g => `
    <div class="ag-row">
      <div class="ag-thumb">
        ${g.image_url ? `<img src="${esc(g.image_url)}" onerror="this.parentElement.innerHTML='🎲'">` : '🎲'}
      </div>
      <div class="ag-title">${esc(g.title)}</div>
      <span class="pill ${g.is_available ? 'p-green' : 'p-red'}" style="flex-shrink:0">${g.is_available ? '가능' : '대여중'}</span>
      <div class="ag-acts">
        <button class="btn btn-outline btn-sm" onclick="toggleAvail('${g.id}',${g.is_available})">${g.is_available ? '🔒' : '🔓'}</button>
        <button class="btn btn-red btn-sm" onclick="deleteGame('${g.id}')">🗑</button>
      </div>
    </div>`).join('');
}

async function toggleAvail(id, current) {
  await sb.from('games').update({ is_available: !current }).eq('id', id);
  loadAdminGameList();
  showToast(`${!current ? '✅ 대여 가능' : '🔒 대여 불가'}으로 변경됐어요`);
}

async function deleteGame(id) {
  if (!confirm('게임을 삭제할까요?')) return;
  await sb.from('games').delete().eq('id', id);
  loadAdminGameList();
  showToast('🗑 게임이 삭제됐어요.');
}

/* ══════════════════════════════════════
   CSV 일괄 등록
══════════════════════════════════════ */
function initCsvDrop() {
  const dropEl = document.getElementById('csv-drop');
  const fileInput = document.getElementById('csv-file-input');

  dropEl.addEventListener('click', () => fileInput.click());
  dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', e => {
    e.preventDefault(); dropEl.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleCsvFile(file);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleCsvFile(e.target.files[0]);
  });
}

function handleCsvFile(file) {
  const reader = new FileReader();
  // EUC-KR 인코딩 시도
  reader.onload = e => parseCsv(e.target.result);
  reader.readAsText(file, 'EUC-KR');
}

const GENRE_MAP = {
  '전략':'전략','파티':'파티','협력':'협력','추상':'추상','경제':'경제',
  '추리':'추리','가족':'가족','주사위':'전략','카드':'파티','디덕션':'추리',
  '워커배치':'전략','경매':'경제','롤플레잉':'파티','기타':'파티'
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { showToast('CSV 파일을 읽을 수 없어요'); return; }

  // 헤더 파싱
  const headers = splitCsvLine(lines[0]);
  const idx = {
    title:   headers.findIndex(h => h.includes('게임명')),
    players: headers.findIndex(h => h.includes('인원')),
    time:    headers.findIndex(h => h.includes('시간')),
    genre:   headers.findIndex(h => h.includes('장르')),
    diff:    headers.findIndex(h => h.includes('난이도')),
    desc:    headers.findIndex(h => h.includes('설명')),
    yt:      headers.findIndex(h => h.includes('규칙') || h.includes('유튜브') || h.includes('링크')),
  };

  csvParsed = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols[idx.title]?.trim()) continue;

    const title = cols[idx.title].trim();
    const [minP, maxP] = parsePlayers(cols[idx.players] || '');
    const [minT, maxT] = parseTime(cols[idx.time] || '');
    const diff         = parseDiff(cols[idx.diff] || '');
    const genre        = parseGenre(cols[idx.genre] || '');
    const desc         = (cols[idx.desc] || '').trim();
    const yt           = (cols[idx.yt] || '').trim();

    csvParsed.push({
      title, min_players: minP, max_players: maxP,
      min_time: minT, max_time: maxT,
      genre, difficulty: diff,
      description: desc || null,
      youtube_url: yt.startsWith('http') ? yt : null,
      is_available: true,
      image_url: null,
    });
  }

  renderCsvPreview();
}

function splitCsvLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result.map(s => s.trim());
}

function parsePlayers(s) {
  const nums = s.replace(/\(.*\)/g,'').match(/\d+/g);
  if (!nums) return [2, 4];
  if (nums.length >= 2) return [+nums[0], +nums[1]];
  return [+nums[0], +nums[0]];
}
function parseTime(s) {
  const nums = s.match(/\d+/g);
  if (!nums) return [30, 60];
  if (nums.length >= 2) return [+nums[0], +nums[1]];
  return [+nums[0], +nums[0]];
}
function parseDiff(s) {
  const filled = (s.match(/★/g) || []).length;
  return Math.max(1, Math.min(5, filled || 2));
}
function parseGenre(s) {
  for (const [k, v] of Object.entries(GENRE_MAP)) {
    if (s.includes(k)) return v;
  }
  return '파티';
}

function renderCsvPreview() {
  const wrap = document.getElementById('csv-preview-wrap');
  if (!csvParsed.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div style="font-size:.82rem;font-weight:700;margin-bottom:.6rem;color:var(--text)">
      📋 총 <span style="color:var(--pink)">${csvParsed.length}개</span> 게임이 파싱됐어요
    </div>
    <div class="csv-preview">
      ${csvParsed.map((g, i) => `
        <div class="csv-row">
          <div class="csv-num">${i+1}</div>
          <div class="csv-name">${esc(g.title)}</div>
          <div class="csv-meta">👥${g.min_players}~${g.max_players} · ⏱${g.min_time}~${g.max_time}분 · ${g.genre} · ${'★'.repeat(g.difficulty)}</div>
        </div>`).join('')}
    </div>
    <div class="progress-bar-wrap" id="csv-progress-wrap" style="display:none">
      <div class="progress-bar" id="csv-progress-bar"></div>
    </div>
    <div id="csv-progress-text" style="font-size:.78rem;color:var(--text2);text-align:center;margin-bottom:.6rem;display:none"></div>
    <button class="btn btn-primary btn-full" onclick="bulkInsertGames()" id="csv-insert-btn">
      🚀 ${csvParsed.length}개 게임 일괄 등록하기
    </button>`;
}

async function bulkInsertGames() {
  if (!csvParsed.length) return;
  const btn  = document.getElementById('csv-insert-btn');
  const pWrap = document.getElementById('csv-progress-wrap');
  const pBar  = document.getElementById('csv-progress-bar');
  const pText = document.getElementById('csv-progress-text');
  btn.disabled = true; btn.textContent = '등록 중...';
  pWrap.style.display = ''; pText.style.display = '';

  const BATCH = 10;
  let done = 0, errors = 0;

  for (let i = 0; i < csvParsed.length; i += BATCH) {
    const batch = csvParsed.slice(i, i + BATCH);
    const { error } = await sb.from('games').insert(batch);
    if (error) { errors += batch.length; console.error(error); }
    else done += batch.length;
    const pct = Math.round(((i + batch.length) / csvParsed.length) * 100);
    pBar.style.width = pct + '%';
    pText.textContent = `${Math.min(i + BATCH, csvParsed.length)} / ${csvParsed.length} 완료`;
  }

  btn.disabled = false;
  if (errors === 0) {
    showToast(`🎲 ${done}개 게임이 등록됐어요!`);
    csvParsed = [];
    document.getElementById('csv-preview-wrap').innerHTML = '';
    document.getElementById('csv-file-input').value = '';
  } else {
    showToast(`⚠️ ${done}개 성공, ${errors}개 실패`);
  }
}

/* ══════════════════════════════════════
   UTILS
══════════════════════════════════════ */
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function catPill(c)  { return { important: 'p-pink', event: 'p-orange', general: 'p-gray' }[c] || 'p-gray'; }
function catLabel(c) { return { important: '📌 중요', event: '🎉 이벤트', general: '일반' }[c] || '일반'; }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('srch-q')?.addEventListener('input', renderGames);
  initCsvDrop();
});
