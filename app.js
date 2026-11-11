/* ==========================================================================
   ỨNG DỤNG KHẢO SÁT LÚA THỰC ĐỊA ĐBSCL - 9 ĐỢT × 50 ĐIỂM RUỘNG CỐ ĐỊNH
   Full Offline PWA + Satellite GIS + 3 Stamped Code Photos + Zalo ZIP Export
   ========================================================================== */

(function () {
  'use strict';

  // --- CONSTANTS & CATALOGS ---
  const DB_NAME = 'KhaoSatLuaDB_v2';
  const DB_VERSION = 1;
  const TOTAL_TARGET_PLOTS = 50;

  const RICE_STAGES = [
    { code: 1, vi: 'Nảy mầm', en: 'Seedling', dasRange: '0–7 ngày' },
    { code: 2, vi: 'Mạ', en: '2/3 leaves', dasRange: '8–14 ngày' },
    { code: 3, vi: 'Đẻ nhánh', en: 'Tillering start', dasRange: '15–28 ngày' },
    { code: 4, vi: 'Nhảy chồi', en: 'Tillering max', dasRange: '29–40 ngày' },
    { code: 5, vi: 'Phân đòng', en: 'Stem Elongation', dasRange: '41–50 ngày' },
    { code: 6, vi: 'Làm đòng', en: 'Booting', dasRange: '51–60 ngày' },
    { code: 7, vi: 'Trổ cờ', en: 'Heading', dasRange: '61–67 ngày' },
    { code: 8, vi: 'Trổ bông', en: 'Flowering', dasRange: '68–75 ngày' },
    { code: 9, vi: 'Ngậm sữa', en: 'Milky stage', dasRange: '76–83 ngày' },
    { code: 10, vi: 'Chín sữa', en: 'Milky-hard stage', dasRange: '84–90 ngày' },
    { code: 11, vi: 'Đỏ đuôi', en: 'Maturing', dasRange: '91–97 ngày' },
    { code: 12, vi: 'Chín', en: 'Maturity', dasRange: '98–110+ ngày' }
  ];

  const VARIETIES_DBSCL = [
    'OM5454', 'OM18', 'Đài Thơm 8', 'OM380', 'ST25',
    'ST24', 'IR50404', 'Jasmine 85', 'DS1', 'RVT'
  ];

  const SOWING_METHODS = [
    'Sạ hàng', 'Sạ lan', 'Sạ cụm', 'Cấy', 'Drone'
  ];

  const PHOTO_TYPES = {
    TongQuan: { label: 'TỔNG QUAN', titleVi: 'Ảnh Tổng Quan', suffix: 'TongQuan' },
    Can1: { label: 'CẬN 1', titleVi: 'Ảnh Cận 1', suffix: 'Can1' },
    Can2: { label: 'CẬN 2', titleVi: 'Ảnh Cận 2', suffix: 'Can2' }
  };

  // --- APPLICATION STATE ---
  const state = {
    db: null,
    currentRound: parseInt(localStorage.getItem('ksl_currentRound') || '1', 10),
    surveyorName: localStorage.getItem('ksl_surveyorName') || 'Nguyễn Văn Minh',
    saveRawPhotos: localStorage.getItem('ksl_saveRawPhotos') === 'true',
    themeLight: localStorage.getItem('ksl_themeLight') === 'true',
    coordUnlockedInRepeatRound: false,
    masterPlots: new Map(),      // stt -> plot object
    surveyRecords: new Map(),    // R<round>_<stt> -> record object
    currentPlotStt: 'CT01',
    currentPhotos: {
      TongQuan: null, // { rawDataUrl, stampedDataUrl, fileName, sizeKB }
      Can1: null,
      Can2: null
    },
    userGPS: {
      x: null,
      y: null,
      accuracy: null,
      heading: null,
      updatedAt: null
    },
    miniMap: null,
    fullMap: null,
    miniMarkersLayer: null,
    fullMarkersLayer: null,
    activeMiniPin: null,
    userMiniCircle: null,
    userFullCircle: null,
    mapFilter: 'all',
    lightboxActiveType: null
  };

  // --- UTILITY FUNCTIONS ---
  function removeVietnameseTones(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  function getSurveyorCode(fullName) {
    const clean = removeVietnameseTones((fullName || '').trim())
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();
    if (!clean) return 'KS';
    const parts = clean.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 10);
    }
    const lastName = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase()).join('');
    return (lastName.charAt(0).toUpperCase() + lastName.slice(1) + initials).slice(0, 14);
  }

  function normalizeStt(val) {
    const raw = (val || '').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!raw) return 'CT01';
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10);
      return 'CT' + String(n).padStart(2, '0');
    }
    const match = raw.match(/^([A-Z]+)(\d+)$/);
    if (match && match[2].length === 1) {
      return match[1] + '0' + match[2];
    }
    return raw;
  }

  function formatNowDateTime() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  function formatFileTimestamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}`;
  }

  function parseVNDate(dateStr) {
    if (!dateStr) return null;
    const clean = dateStr.trim().split(/\s+/)[0];
    const parts = clean.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    let day, month, year;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
    const dt = new Date(year, month, day);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function computeDAS(sowingDateStr, surveyDateTimeStr) {
    const dSow = parseVNDate(sowingDateStr);
    const dSurv = parseVNDate(surveyDateTimeStr) || new Date();
    if (!dSow || !dSurv) return null;
    const diffMs = dSurv.setHours(0, 0, 0, 0) - dSow.setHours(0, 0, 0, 0);
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function suggestStageFromDAS(das) {
    if (das === null || das < 0) return null;
    if (das <= 7) return 1;
    if (das <= 14) return 2;
    if (das <= 28) return 3;
    if (das <= 40) return 4;
    if (das <= 50) return 5;
    if (das <= 60) return 6;
    if (das <= 67) return 7;
    if (das <= 75) return 8;
    if (das <= 83) return 9;
    if (das <= 90) return 10;
    if (das <= 97) return 11;
    return 12;
  }

  // Haversine distance in meters between two WGS84 points (lon1, lat1) and (lon2, lat2)
  function calcDistanceMeters(lon1, lat1, lon2, lat2) {
    const x1 = parseFloat(lon1);
    const y1 = parseFloat(lat1);
    const x2 = parseFloat(lon2);
    const y2 = parseFloat(lat2);
    if ([x1, y1, x2, y2].some(v => isNaN(v))) return null;
    const R = 6371000;
    const toRad = deg => (deg * Math.PI) / 180;
    const dLat = toRad(y2 - y1);
    const dLon = toRad(x2 - x1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(y1)) * Math.cos(toRad(y2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(meters) {
    if (meters === null || isNaN(meters)) return 'Chưa có GPS';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  }

  // --- TOAST & CUSTOM MODAL (NO NATIVE ALERT/CONFIRM) ---
  function showToast(message, type = 'success', duration = 3400) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `toast-item ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : ''}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.25s ease';
      setTimeout(() => item.remove(), 260);
    }, duration);
  }

  function showModal({ title, html, buttons }) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('customModalTitle');
    const bodyEl = document.getElementById('customModalBody');
    const footerEl = document.getElementById('customModalFooter');

    titleEl.textContent = title || 'Thông báo';
    bodyEl.innerHTML = html || '';
    footerEl.innerHTML = '';

    (buttons || [{ label: 'Đóng', className: 'btn btn-primary btn-sm' }]).forEach(btnCfg => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = btnCfg.className || 'btn btn-outline btn-sm';
      b.textContent = btnCfg.label;
      b.addEventListener('click', () => {
        modal.classList.remove('open');
        if (typeof btnCfg.onClick === 'function') btnCfg.onClick();
      });
      footerEl.appendChild(b);
    });

    modal.classList.add('open');
  }

  // --- INDEXEDDB LAYER ---
  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('master_plots')) {
          db.createObjectStore('master_plots', { keyPath: 'stt' });
        }
        if (!db.objectStoreNames.contains('survey_records')) {
          const store = db.createObjectStore('survey_records', { keyPath: 'id' });
          store.createIndex('by_round', 'round', { unique: false });
          store.createIndex('by_stt', 'stt', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        state.db = e.target.result;
        resolve(state.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function dbPut(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function loadAllDataFromDB() {
    const masters = await dbGetAll('master_plots');
    state.masterPlots.clear();
    masters.sort((a, b) => a.stt.localeCompare(b.stt, undefined, { numeric: true }));
    masters.forEach(m => state.masterPlots.set(m.stt, m));

    const records = await dbGetAll('survey_records');
    state.surveyRecords.clear();
    records.forEach(r => state.surveyRecords.set(r.id, r));

    // If completely empty on first launch, seed 50 default Mekong Delta plots (Dong Thap / Can Tho) in master_plots so user can immediately explore the 50-plot map or start Round 1
    if (state.masterPlots.size === 0 && window.DBSCL_PRESETS && window.DBSCL_PRESETS.dong_thap_50) {
      for (const item of window.DBSCL_PRESETS.dong_thap_50) {
        await dbPut('master_plots', item);
        state.masterPlots.set(item.stt, item);
      }
    }
  }

  function getRecord(round, stt) {
    return state.surveyRecords.get(`R${round}_${stt}`) || null;
  }

  function getRecordsForRound(round) {
    const list = [];
    state.surveyRecords.forEach(rec => {
      if (Number(rec.round) === Number(round)) list.push(rec);
    });
    return list.sort((a, b) => a.stt.localeCompare(b.stt, undefined, { numeric: true }));
  }

  function getAllOrderedPlotCodes() {
    const codes = new Set();
    for (let i = 1; i <= TOTAL_TARGET_PLOTS; i++) {
      codes.add('CT' + String(i).padStart(2, '0'));
    }
    state.masterPlots.forEach((_, stt) => codes.add(stt));
    state.surveyRecords.forEach(rec => codes.add(rec.stt));
    return Array.from(codes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  // --- UI RENDERING & BINDING ---
  function renderStagesGrid() {
    const grid = document.getElementById('stagesGrid');
    grid.innerHTML = '';
    const currentStage = parseInt(document.getElementById('selectedStageInput').value || '3', 10);

    RICE_STAGES.forEach(st => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `stage-btn ${st.code === currentStage ? 'selected' : ''}`;
      btn.dataset.stage = st.code;
      btn.innerHTML = `
        <span class="stage-num">${st.code}</span>
        <div>
          <span class="stage-text-vi">${st.vi}</span>
          <span class="stage-text-en">${st.en} (${st.dasRange})</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        document.getElementById('selectedStageInput').value = String(st.code);
        document.querySelectorAll('#stagesGrid .stage-btn').forEach(b => {
          b.classList.toggle('selected', Number(b.dataset.stage) === st.code);
        });
        reStampExistingPhotos();
      });
      grid.appendChild(btn);
    });
  }

  function renderVarietyAndMethodChips() {
    const vContainer = document.getElementById('varietyChips');
    const mContainer = document.getElementById('methodChips');
    const vInput = document.getElementById('varietyInput');
    const mInput = document.getElementById('methodInput');

    vContainer.innerHTML = '';
    VARIETIES_DBSCL.forEach(v => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn ${vInput.value.trim() === v ? 'selected' : ''}`;
      btn.textContent = v;
      btn.addEventListener('click', () => {
        vInput.value = v;
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        reStampExistingPhotos();
      });
      vContainer.appendChild(btn);
    });

    mContainer.innerHTML = '';
    SOWING_METHODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn ${mInput.value.trim() === m ? 'selected' : ''}`;
      btn.textContent = m;
      btn.addEventListener('click', () => {
        mInput.value = m;
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        reStampExistingPhotos();
      });
      mContainer.appendChild(btn);
    });
  }

  function syncVarietyMethodChips() {
    const vVal = document.getElementById('varietyInput').value.trim();
    const mVal = document.getElementById('methodInput').value.trim();
    document.querySelectorAll('#varietyChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', b.textContent === vVal);
    });
    document.querySelectorAll('#methodChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', b.textContent === mVal);
    });
  }

  function updateCombinedNotePreview() {
    const v = document.getElementById('varietyInput').value.trim();
    const m = document.getElementById('methodInput').value.trim();
    const extra = document.getElementById('roundExtraNoteInput').value.trim();
    let base = '';
    if (v && m) base = `${v} - ${m}`;
    else if (v) base = v;
    else if (m) base = m;

    let combined = base;
    if (extra) {
      combined = base ? `${base} (${extra})` : extra;
    }
    document.getElementById('finalNotePreview').value = combined;
  }

  function setWaterRegime(code) {
    const strCode = String(code);
    document.getElementById('selectedWaterInput').value = strCode;
    document.querySelectorAll('#waterRegimeGrid .water-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.water === strCode);
    });
    const section = document.getElementById('waterLevelSection');
    if (strCode === '1') {
      section.style.display = 'block';
      recalcWaterAverage();
    } else {
      section.style.display = 'none';
      document.getElementById('waterAvgOutput').value = '';
    }
    reStampExistingPhotos();
  }

  function recalcWaterAverage() {
    const waterCode = document.getElementById('selectedWaterInput').value;
    const out = document.getElementById('waterAvgOutput');
    if (waterCode !== '1') {
      out.value = '';
      return '';
    }
    const vals = ['waterM1', 'waterM2', 'waterM3']
      .map(id => parseFloat(document.getElementById(id).value))
      .filter(v => !isNaN(v) && v >= 0);
    if (vals.length === 0) {
      out.value = '';
      return '';
    }
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    out.value = avg;
    return avg;
  }

  function updateDASAndStageHints() {
    const sowStr = document.getElementById('sowingDateInput').value.trim();
    const survStr = document.getElementById('surveyDateTimeInput').value.trim();
    const banner = document.getElementById('dasHintBanner');
    const das = computeDAS(sowStr, survStr);

    if (das === null) {
      banner.innerHTML = '🌱 Nhập <strong>Ngày sạ/cấy (dd/mm/yyyy)</strong> để tự động tính số ngày sau sạ (NSS / DAS) và đối chiếu giai đoạn lúa.';
      return;
    }
    const suggestedCode = suggestStageFromDAS(das);
    const stObj = RICE_STAGES.find(s => s.code === suggestedCode);
    banner.innerHTML = `
      ⏱️ Tuổi lúa tính đến ngày khảo sát: <strong>${das} ngày sau sạ/cấy (NSS/DAS)</strong>
      ${stObj ? ` • Gợi ý sinh học: <strong>GĐ ${stObj.code} - ${stObj.vi} (${stObj.en})</strong> <button type="button" id="btnApplySuggestedStage" class="btn btn-yellow btn-sm" style="padding:2px 8px;font-size:0.74rem;margin-left:6px;">Chọn GĐ ${stObj.code}</button>` : ''}
    `;
    const btnApply = document.getElementById('btnApplySuggestedStage');
    if (btnApply && stObj) {
      btnApply.addEventListener('click', () => {
        document.getElementById('selectedStageInput').value = String(stObj.code);
        renderStagesGrid();
        reStampExistingPhotos();
      });
    }
  }

  function updateHeaderAndProgressUI() {
    const round = state.currentRound;
    document.getElementById('roundSelect').value = String(round);
    document.getElementById('surveyorInput').value = state.surveyorName;

    const sCode = getSurveyorCode(state.surveyorName);
    document.getElementById('surveyorCodeBadge').textContent = sCode;

    const modeTag = document.getElementById('roundModeTag');
    const instrBox = document.getElementById('roundInstructionBox');
    if (round === 1) {
      modeTag.textContent = 'SETUP 50 RUỘNG GỐC';
      modeTag.style.background = '#facc15';
      instrBox.innerHTML = `🌱 <strong>ĐỢT 1 (Thiết lập 50 điểm ruộng gốc):</strong> Bấm "Lấy vị trí GPS hiện tại", kéo ghim hoặc chạm vào giữa thửa ruộng trên bản đồ vệ tinh để chốt tọa độ gốc <code>X, Y</code> cùng Ngày sạ/cấy, Giống lúa cho cả vụ.`;
    } else {
      modeTag.textContent = `ĐỢT LẶP LẠI (${round}/9)`;
      modeTag.style.background = '#4ade80';
      instrBox.innerHTML = `🔄 <strong>ĐỢT ${round} (Khảo sát lặp lại 50 điểm cố định):</strong> Tọa độ gốc <code>X, Y</code>, Ngày sạ/cấy, Giống lúa và Phương pháp được <strong>tự động điền và khóa theo Đợt 1</strong>. Chỉ cần đi tới ghim màu Cam trên bản đồ, chọn Giai đoạn mới, Chế độ nước và chụp 3 ảnh Đợt ${round}.`;
    }

    const roundRecords = getRecordsForRound(round);
    const doneCount = roundRecords.length;
    const remainCount = Math.max(0, TOTAL_TARGET_PLOTS - doneCount);
    const pct = Math.min(100, Math.round((doneCount / TOTAL_TARGET_PLOTS) * 100));

    document.getElementById('progressText').textContent =
      `Tiến độ Đợt ${round}: Đã đo ${doneCount} / ${TOTAL_TARGET_PLOTS} điểm ruộng (Còn lại ${remainCount} điểm)`;
    document.getElementById('progressBarFill').style.width = `${pct}%`;
    document.getElementById('masterRegistryBadge').textContent =
      `Danh mục gốc: ${state.masterPlots.size}/${TOTAL_TARGET_PLOTS} ruộng`;

    const badgeTodo = document.getElementById('navBadgeTodo');
    if (remainCount > 0) {
      badgeTodo.style.display = 'inline-block';
      badgeTodo.textContent = String(remainCount);
    } else {
      badgeTodo.style.display = 'none';
    }

    populatePlotQuickSelect();
    renderNearestSuggestions();
    renderRoundsMatrix();
    renderPlotListTab();
    updateExportPreviewUI();
  }

  function populatePlotQuickSelect() {
    const sel = document.getElementById('plotSelectQuick');
    const allCodes = getAllOrderedPlotCodes();
    sel.innerHTML = '';

    allCodes.forEach(stt => {
      const rec = getRecord(state.currentRound, stt);
      const master = state.masterPlots.get(stt);
      let distLabel = '';
      if (state.userGPS.x !== null && master && master.x && master.y) {
        const d = calcDistanceMeters(state.userGPS.x, state.userGPS.y, master.x, master.y);
        if (d !== null) distLabel = ` • cách ${formatDistance(d)}`;
      }
      const statusIcon = rec ? '🟢 ✓ Đã đo' : '🟠 Chưa đo';
      const info = master
        ? `${master.variety || ''} ${master.xa ? '- ' + master.xa : ''}`.trim()
        : 'Chưa có tọa độ gốc';

      const opt = document.createElement('option');
      opt.value = stt;
      opt.textContent = `${stt} [${statusIcon}] ${info ? '— ' + info : ''}${distLabel}`;
      if (stt === state.currentPlotStt) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // Load selected plot into the Tab 1 Survey Form (inheriting Master Plot data in Rounds 2-9)
  function selectPlotIntoForm(sttRaw, options = {}) {
    const stt = normalizeStt(sttRaw);
    state.currentPlotStt = stt;
    state.coordUnlockedInRepeatRound = false;

    document.getElementById('sttInput').value = stt;
    const quickSel = document.getElementById('plotSelectQuick');
    if (quickSel) quickSel.value = stt;

    const round = state.currentRound;
    const existingRec = getRecord(round, stt);
    const master = state.masterPlots.get(stt) || (state.surveyRecords.get(`R1_${stt}`) ? {
      stt,
      x: state.surveyRecords.get(`R1_${stt}`).x,
      y: state.surveyRecords.get(`R1_${stt}`).y,
      sowingDate: state.surveyRecords.get(`R1_${stt}`).sowingDate,
      variety: state.surveyRecords.get(`R1_${stt}`).variety,
      method: state.surveyRecords.get(`R1_${stt}`).method
    } : null);

    // Check previous round stage for comparison
    const prevBanner = document.getElementById('prevStageComparisonBanner');
    let prevRec = null;
    for (let r = round - 1; r >= 1; r--) {
      const candidate = getRecord(r, stt);
      if (candidate) {
        prevRec = candidate;
        break;
      }
    }
    if (prevRec) {
      const stObj = RICE_STAGES.find(s => s.code === Number(prevRec.growthStage));
      prevBanner.style.display = 'block';
      prevBanner.innerHTML = `📌 <strong>Đối chiếu chuỗi thời gian (${stt}):</strong> Ở <strong>Đợt ${prevRec.round}</strong> (${prevRec.surveyDateTime}), ruộng này ở <strong>Giai đoạn ${prevRec.growthStage} (${stObj ? stObj.vi : ''})</strong> • Chế độ nước: <strong>Mã ${prevRec.waterRegime}</strong>.`;
    } else {
      prevBanner.style.display = 'none';
    }

    const xInput = document.getElementById('coordXInput');
    const yInput = document.getElementById('coordYInput');
    const lockBtn = document.getElementById('btnToggleCoordLock');

    if (existingRec) {
      // Editing an already-saved record in current round
      xInput.value = Number(existingRec.x).toFixed(6);
      yInput.value = Number(existingRec.y).toFixed(6);
      document.getElementById('surveyDateTimeInput').value = existingRec.surveyDateTime || formatNowDateTime();
      document.getElementById('sowingDateInput').value = existingRec.sowingDate || (master ? master.sowingDate : '');
      document.getElementById('selectedStageInput').value = String(existingRec.growthStage || 3);
      setWaterRegime(existingRec.waterRegime || '1');
      document.getElementById('waterM1').value = existingRec.waterM1 !== undefined ? existingRec.waterM1 : '';
      document.getElementById('waterM2').value = existingRec.waterM2 !== undefined ? existingRec.waterM2 : '';
      document.getElementById('waterM3').value = existingRec.waterM3 !== undefined ? existingRec.waterM3 : '';
      document.getElementById('waterAvgOutput').value = existingRec.waterLevelAvg || '';
      document.getElementById('varietyInput').value = existingRec.variety || (master ? master.variety : 'OM5454');
      document.getElementById('methodInput').value = existingRec.method || (master ? master.method : 'Sạ hàng');
      document.getElementById('roundExtraNoteInput').value = existingRec.extraNote || '';
      document.getElementById('finalNotePreview').value = existingRec.note || '';

      state.currentPhotos = {
        TongQuan: existingRec.photos && existingRec.photos.TongQuan ? { ...existingRec.photos.TongQuan } : null,
        Can1: existingRec.photos && existingRec.photos.Can1 ? { ...existingRec.photos.Can1 } : null,
        Can2: existingRec.photos && existingRec.photos.Can2 ? { ...existingRec.photos.Can2 } : null
      };
    } else {
      // New measurement for this plot in current round -> inherit from Master Plot (Đợt 1)
      if (master && master.x && master.y) {
        xInput.value = Number(master.x).toFixed(6);
        yInput.value = Number(master.y).toFixed(6);
      } else if (state.userGPS.x && state.userGPS.y && round === 1) {
        xInput.value = Number(state.userGPS.x).toFixed(6);
        yInput.value = Number(state.userGPS.y).toFixed(6);
      } else {
        xInput.value = '105.741040';
        yInput.value = '10.546230';
      }

      document.getElementById('surveyDateTimeInput').value = formatNowDateTime();
      document.getElementById('sowingDateInput').value = master && master.sowingDate ? master.sowingDate : '15/10/2026';
      document.getElementById('varietyInput').value = master && master.variety ? master.variety : 'OM5454';
      document.getElementById('methodInput').value = master && master.method ? master.method : 'Sạ hàng';
      document.getElementById('roundExtraNoteInput').value = '';

      // Auto-suggest stage from DAS or increment from previous round
      const das = computeDAS(document.getElementById('sowingDateInput').value, document.getElementById('surveyDateTimeInput').value);
      const suggestedStage = suggestStageFromDAS(das) || (prevRec ? Math.min(12, Number(prevRec.growthStage) + 1) : 3);
      document.getElementById('selectedStageInput').value = String(suggestedStage);

      setWaterRegime('1');
      document.getElementById('waterM1').value = '';
      document.getElementById('waterM2').value = '';
      document.getElementById('waterM3').value = '';
      document.getElementById('waterAvgOutput').value = '';

      state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };
    }

    // Lock or unlock coordinates based on Round 1 vs Rounds 2-9
    if (round > 1 && master && master.x && master.y) {
      xInput.readOnly = true;
      yInput.readOnly = true;
      lockBtn.style.display = 'inline-flex';
      lockBtn.textContent = '🔒 Đang khóa tọa độ gốc Đợt 1 (Bấm để mở khóa)';
    } else {
      xInput.readOnly = false;
      yInput.readOnly = false;
      lockBtn.style.display = 'none';
    }

    renderStagesGrid();
    syncVarietyMethodChips();
    updateCombinedNotePreview();
    updateDASAndStageHints();
    updatePhotoCardsUI();
    updateSaveButtonLabel();
    updateDistanceCheckBanner();
    syncMapsToCurrentPlot(options.panMap !== false);
  }

  function updateSaveButtonLabel() {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const round = state.currentRound;
    const existing = getRecord(round, stt);
    document.getElementById('btnSavePlotLabel').textContent =
      existing ? `CẬP NHẬT ${stt} - ĐỢT ${round}` : `${stt} - ĐỢT ${round}`;
  }

  function updateDistanceCheckBanner() {
    const banner = document.getElementById('distanceCheckBanner');
    const plotX = parseFloat(document.getElementById('coordXInput').value);
    const plotY = parseFloat(document.getElementById('coordYInput').value);
    if (state.userGPS.x === null || isNaN(plotX) || isNaN(plotY)) {
      banner.style.display = 'none';
      return;
    }
    const dist = calcDistanceMeters(state.userGPS.x, state.userGPS.y, plotX, plotY);
    if (dist === null) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    if (dist <= 100) {
      banner.style.background = 'rgba(34, 197, 94, 0.16)';
      banner.style.border = '1.5px solid #4ade80';
      banner.style.color = '#bbf7d0';
      banner.innerHTML = `✅ Vị trí GPS của bạn đang cách tâm ruộng <strong>${state.currentPlotStt}</strong> khoảng <strong>${formatDistance(dist)}</strong> (Trong phạm vi chuẩn ≤ 100m).`;
    } else {
      banner.style.background = 'rgba(245, 158, 11, 0.18)';
      banner.style.border = '1.5px solid #facc15';
      banner.style.color = '#fef08a';
      banner.innerHTML = `⚠️ Chú ý: GPS hiện tại của điện thoại cách tâm điểm <strong>${state.currentPlotStt}</strong> khoảng <strong>${formatDistance(dist)}</strong> (> 100m). Hãy kiểm tra kỹ mã ruộng hoặc bấm "Chỉ đường Google Maps".`;
    }
  }

  // --- NEAREST UNVISITED PLOTS SUGGESTION ---
  function renderNearestSuggestions() {
    const container1 = document.getElementById('nearestChipsContainer');
    const container2 = document.getElementById('mapNearestList');
    const allCodes = getAllOrderedPlotCodes();

    const refX = state.userGPS.x !== null ? state.userGPS.x : parseFloat(document.getElementById('coordXInput').value || '105.741040');
    const refY = state.userGPS.y !== null ? state.userGPS.y : parseFloat(document.getElementById('coordYInput').value || '10.546230');

    const unvisited = [];
    allCodes.forEach(stt => {
      if (getRecord(state.currentRound, stt)) return; // skip already visited in this round
      const master = state.masterPlots.get(stt);
      if (!master || !master.x || !master.y) return;
      const dist = calcDistanceMeters(refX, refY, master.x, master.y);
      unvisited.push({ stt, master, dist });
    });

    unvisited.sort((a, b) => (a.dist ?? 999999) - (b.dist ?? 999999));
    const topItems = unvisited.slice(0, 12);

    const buildHTML = () => {
      if (topItems.length === 0) {
        return `<div style="padding:8px;color:#86efac;font-weight:800;">🎉 Tuyệt vời! Đã hoàn thành khảo sát toàn bộ 50/50 điểm ruộng của Đợt ${state.currentRound}.</div>`;
      }
      return topItems.map(item => {
        const isCurrent = item.stt === state.currentPlotStt;
        const distBadge = state.userGPS.x !== null
          ? `Cách ${formatDistance(item.dist)}`
          : `${formatDistance(item.dist)}`;
        return `
          <div class="nearest-chip ${isCurrent ? 'active' : ''}" data-select-stt="${item.stt}">
            <div class="nearest-chip-top">
              <span>📍 ${item.stt}</span>
              <span class="nearest-dist">${distBadge}</span>
            </div>
            <div class="nearest-chip-sub">${item.master.variety || 'Lúa'} • ${item.master.xa || 'ĐBSCL'}</div>
          </div>
        `;
      }).join('');
    };

    const html = buildHTML();
    if (container1) container1.innerHTML = html;
    if (container2) container2.innerHTML = html;

    document.querySelectorAll('[data-select-stt]').forEach(el => {
      el.addEventListener('click', () => {
        const stt = el.getAttribute('data-select-stt');
        selectPlotIntoForm(stt, { panMap: true });
        renderNearestSuggestions();
        showToast(`Đã chọn điểm ruộng ${stt} (Đợt ${state.currentRound})`);
      });
    });
  }

  // --- INTERACTIVE SATELLITE MAPS (LEAFLET + ESRI WORLD IMAGERY) ---
  function createSatelliteLayers() {
    const esriSat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
      }
    );
    const roadLabels = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        pane: 'overlayPane'
      }
    );
    const hybridGroup = L.layerGroup([esriSat, roadLabels]);
    const osmStreet = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }
    );
    return { hybridGroup, osmStreet };
  }

  function initMaps() {
    const defaultLat = 10.546230;
    const defaultLon = 105.741040;

    // 1. Mini Map inside Form (Tab 1)
    const layers1 = createSatelliteLayers();
    state.miniMap = L.map('miniMap', {
      center: [defaultLat, defaultLon],
      zoom: 17,
      layers: [layers1.hybridGroup],
      zoomControl: true
    });
    L.control.layers(
      { '🛰️ Vệ tinh + Nhãn địa danh': layers1.hybridGroup, '🗺️ Bản đồ đường phố': layers1.osmStreet },
      null,
      { position: 'topright' }
    ).addTo(state.miniMap);

    state.miniMarkersLayer = L.layerGroup().addTo(state.miniMap);

    // Tap on miniMap to set coordinates when in Round 1 or unlocked
    state.miniMap.on('click', (e) => {
      if (state.currentRound > 1 && !state.coordUnlockedInRepeatRound) {
        showToast('Tọa độ đang khóa theo Đợt 1. Bấm "Mở khóa" nếu muốn dời tâm ruộng.', 'warn');
        return;
      }
      setFormCoordinates(e.latlng.lng, e.latlng.lat, true);
    });

    // 2. Full Map of 50 Plots (Tab 2)
    const layers2 = createSatelliteLayers();
    state.fullMap = L.map('fullMap', {
      center: [defaultLat, defaultLon],
      zoom: 12,
      layers: [layers2.hybridGroup],
      zoomControl: true
    });
    L.control.layers(
      { '🛰️ Ảnh Vệ Tinh Độ Phân Giải Cao': layers2.hybridGroup, '🗺️ Bản Đồ Đường Phố': layers2.osmStreet },
      null,
      { position: 'topright' }
    ).addTo(state.fullMap);

    state.fullMarkersLayer = L.layerGroup().addTo(state.fullMap);

    state.fullMap.on('click', (e) => {
      if (state.currentRound === 1 || state.coordUnlockedInRepeatRound) {
        setFormCoordinates(e.latlng.lng, e.latlng.lat, true);
      }
    });

    refreshMapMarkers();
  }

  function setFormCoordinates(lon, lat, fromMapTap = false) {
    const xStr = Number(lon).toFixed(6);
    const yStr = Number(lat).toFixed(6);
    document.getElementById('coordXInput').value = xStr;
    document.getElementById('coordYInput').value = yStr;
    updateDistanceCheckBanner();
    reStampExistingPhotos();
    refreshMapMarkers();
    if (fromMapTap) {
      showToast(`Đã chốt tọa độ ruộng ${state.currentPlotStt}: X=${xStr}, Y=${yStr}`);
    }
  }

  function refreshMapMarkers() {
    if (!state.miniMap || !state.fullMap) return;
    state.miniMarkersLayer.clearLayers();
    state.fullMarkersLayer.clearLayers();

    const allCodes = getAllOrderedPlotCodes();
    const curX = parseFloat(document.getElementById('coordXInput').value);
    const curY = parseFloat(document.getElementById('coordYInput').value);
    const canDragCurrent = (state.currentRound === 1 || state.coordUnlockedInRepeatRound);

    let countAll = 0;
    let countDone = 0;
    let countTodo = 0;

    allCodes.forEach(stt => {
      const master = state.masterPlots.get(stt);
      const rec = getRecord(state.currentRound, stt);
      const isSelected = (stt === state.currentPlotStt);

      const lon = isSelected && !isNaN(curX) ? curX : (master ? parseFloat(master.x) : NaN);
      const lat = isSelected && !isNaN(curY) ? curY : (master ? parseFloat(master.y) : NaN);
      if (isNaN(lon) || isNaN(lat)) return;

      countAll++;
      if (rec) countDone++;
      else countTodo++;

      if (state.mapFilter === 'done' && !rec) return;
      if (state.mapFilter === 'todo' && rec) return;

      const shortNum = stt.replace(/^CT/, '');
      const pinClass = isSelected
        ? 'plot-pin plot-pin-selected'
        : rec
          ? 'plot-pin plot-pin-done'
          : 'plot-pin plot-pin-todo';
      const pinLabel = rec ? `${shortNum}✓` : shortNum;

      const icon = L.divIcon({
        className: '',
        html: `<div class="${pinClass}" style="width:34px;height:34px;">${pinLabel}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16]
      });

      const distM = state.userGPS.x !== null
        ? calcDistanceMeters(state.userGPS.x, state.userGPS.y, lon, lat)
        : null;

      const popupHTML = `
        <div style="min-width:210px;color:#0f172a;font-family:sans-serif;">
          <div style="font-weight:900;font-size:1rem;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
            <span>🌾 Điểm ${stt}</span>
            <span style="padding:2px 7px;border-radius:99px;font-size:0.74rem;color:#fff;background:${rec ? '#15803d' : '#ea580c'};">
              ${rec ? `Đã đo Đợt ${state.currentRound} ✓` : `Chưa đo Đợt ${state.currentRound}`}
            </span>
          </div>
          <div style="font-size:0.8rem;line-height:1.4;margin-bottom:8px;">
            <div><strong>X (Lon):</strong> ${lon.toFixed(6)} | <strong>Y (Lat):</strong> ${lat.toFixed(6)}</div>
            ${master && master.xa ? `<div><strong>Địa bàn:</strong> ${master.xa} (${master.huyen || ''})</div>` : ''}
            <div><strong>Giống &amp; PP:</strong> ${master ? `${master.variety || 'OM5454'} - ${master.method || 'Sạ hàng'}` : 'Chưa thiết lập'}</div>
            <div><strong>Ngày sạ/cấy:</strong> ${master && master.sowingDate ? master.sowingDate : 'Chưa rõ'}</div>
            ${distM !== null ? `<div style="color:#0369a1;font-weight:800;">📍 Cách vị trí bạn: ${formatDistance(distM)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button type="button" onclick="window.__kslStartPlot('${stt}')" style="background:#16a34a;color:#fff;border:none;padding:8px 10px;border-radius:8px;font-weight:800;cursor:pointer;width:100%;">
              📝 Khảo sát ruộng ${stt} (Đợt ${state.currentRound})
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=two-wheeler" target="_blank" rel="noopener" style="background:#0284c7;color:#fff;text-decoration:none;text-align:center;padding:7px 10px;border-radius:8px;font-weight:800;font-size:0.82rem;">
              🛵 Chỉ đường tới ruộng (Google Maps)
            </a>
          </div>
        </div>
      `;

      // Full Map Marker
      const fMarker = L.marker([lat, lon], {
        icon,
        draggable: isSelected && canDragCurrent
      }).bindPopup(popupHTML);

      fMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setFormCoordinates(pos.lng, pos.lat, true);
      });
      state.fullMarkersLayer.addLayer(fMarker);

      // Mini Map Marker (show current plot as draggable + nearby plots)
      const mMarker = L.marker([lat, lon], {
        icon,
        draggable: isSelected && canDragCurrent
      }).bindPopup(popupHTML);

      mMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setFormCoordinates(pos.lng, pos.lat, true);
      });
      state.miniMarkersLayer.addLayer(mMarker);
    });

    document.getElementById('mapCountAll').textContent = String(countAll);
    document.getElementById('mapCountTodo').textContent = String(countTodo);
    document.getElementById('mapCountDone').textContent = String(countDone);
  }

  window.__kslStartPlot = function (stt) {
    selectPlotIntoForm(stt, { panMap: true });
    switchTab('tab-survey');
    showToast(`Đang khảo sát điểm ${stt} - Đợt ${state.currentRound}`);
  };

  function syncMapsToCurrentPlot(pan = true) {
    refreshMapMarkers();
    if (!pan) return;
    const x = parseFloat(document.getElementById('coordXInput').value);
    const y = parseFloat(document.getElementById('coordYInput').value);
    if (!isNaN(x) && !isNaN(y)) {
      if (state.miniMap) state.miniMap.setView([y, x], Math.max(state.miniMap.getZoom(), 17));
      if (state.fullMap) state.fullMap.panTo([y, x]);
    }
  }

  function fitAllMasterPlotsOnMap() {
    if (!state.fullMap) return;
    const latlngs = [];
    state.masterPlots.forEach(m => {
      if (!isNaN(parseFloat(m.y)) && !isNaN(parseFloat(m.x))) {
        latlngs.push([parseFloat(m.y), parseFloat(m.x)]);
      }
    });
    if (latlngs.length > 0) {
      state.fullMap.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 16 });
    }
  }

  // --- GPS HIGH ACCURACY & COMPASS HEADING ---
  function requestCurrentGPS(updatePlotCoordsIfRound1 = true) {
    const statusEl = document.getElementById('gpsStatusText');
    if (!navigator.geolocation) {
      statusEl.textContent = '⚠️ Trình duyệt không hỗ trợ GPS';
      showToast('Thiết bị không hỗ trợ định vị GPS', 'error');
      return;
    }

    statusEl.textContent = '🛰️ Đang thu tín hiệu vệ tinh GPS độ chính xác cao...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const acc = Math.round(pos.coords.accuracy || 10);

        state.userGPS.x = lon;
        state.userGPS.y = lat;
        state.userGPS.accuracy = acc;
        state.userGPS.updatedAt = new Date();

        statusEl.innerHTML = `🛰️ GPS thực tế: <strong>${lon.toFixed(6)}, ${lat.toFixed(6)}</strong> (Sai số <strong>±${acc}m</strong>)`;

        // Draw user GPS accuracy circle on both maps
        if (state.miniMap) {
          if (state.userMiniCircle) state.miniMap.removeLayer(state.userMiniCircle);
          state.userMiniCircle = L.circle([lat, lon], {
            radius: acc,
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.22,
            weight: 2
          }).addTo(state.miniMap);
        }
        if (state.fullMap) {
          if (state.userFullCircle) state.fullMap.removeLayer(state.userFullCircle);
          state.userFullCircle = L.circle([lat, lon], {
            radius: acc,
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.22,
            weight: 2
          }).addTo(state.fullMap);
        }

        if (updatePlotCoordsIfRound1 && (state.currentRound === 1 || state.coordUnlockedInRepeatRound)) {
          setFormCoordinates(lon, lat, false);
          if (state.miniMap) state.miniMap.setView([lat, lon], 18);
        }

        populatePlotQuickSelect();
        renderNearestSuggestions();
        updateDistanceCheckBanner();
        showToast(`Đã lấy vị trí GPS (±${acc}m)`);
      },
      (err) => {
        statusEl.textContent = `⚠️ Không lấy được GPS (${err.message}). Vui lòng bật Vị trí hoặc chạm chọn trên bản đồ vệ tinh.`;
        showToast('Không lấy được GPS. Bạn có thể chạm trực tiếp vào ruộng trên bản đồ vệ tinh!', 'warn');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function initCompassListener() {
    window.addEventListener('deviceorientation', (e) => {
      let heading = null;
      if (typeof e.webkitCompassHeading === 'number') {
        heading = Math.round(e.webkitCompassHeading);
      } else if (typeof e.alpha === 'number') {
        heading = Math.round(360 - e.alpha);
      }
      if (heading !== null && !isNaN(heading)) {
        state.userGPS.heading = heading;
        const dirs = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
        const dirName = dirs[Math.round(heading / 45) % 8];
        const el = document.getElementById('compassHeadingText');
        if (el) el.textContent = `🧭 Hướng: ${heading}° (${dirName})`;
      }
    });
  }

  // --- HTML5 CANVAS 3-PHOTO STAMPING ("HÌNH CÓ CODE") ---
  function getPhotoFileName(typeKey) {
    const round = state.currentRound;
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const sCode = getSurveyorCode(state.surveyorName);
    const suffix = PHOTO_TYPES[typeKey].suffix;
    return `Dot${round}_${stt}_${sCode}_${suffix}.jpg`;
  }

  function stampImageWithCode(rawDataUrl, typeKey) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w >= h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // 1. Draw base field photo
        ctx.drawImage(img, 0, 0, w, h);

        // Collect metadata for watermark
        const round = state.currentRound;
        const stt = normalizeStt(document.getElementById('sttInput').value);
        const typeLabel = PHOTO_TYPES[typeKey].label;
        const sName = (state.surveyorName || 'Chưa nhập').trim();
        const xVal = (document.getElementById('coordXInput').value || '').trim();
        const yVal = (document.getElementById('coordYInput').value || '').trim();
        const dtVal = (document.getElementById('surveyDateTimeInput').value || formatNowDateTime()).trim();
        const stageCode = document.getElementById('selectedStageInput').value || '3';
        const stObj = RICE_STAGES.find(s => String(s.code) === String(stageCode));
        const waterCode = document.getElementById('selectedWaterInput').value || '1';
        const waterAvg = document.getElementById('waterAvgOutput').value;
        const noteVal = document.getElementById('finalNotePreview').value || '';

        const scale = Math.max(0.75, w / 1000);
        const pad = Math.round(16 * scale);

        // 2. Top-Left Code Badge: ĐỢT <N> • <STT> • <LOẠI ẢNH>
        const topText = `ĐỢT ${round} • ${stt} • ${typeLabel}`;
        ctx.font = `900 ${Math.round(28 * scale)}px sans-serif`;
        const topMetrics = ctx.measureText(topText);
        const badgeW = topMetrics.width + pad * 2;
        const badgeH = Math.round(48 * scale);

        ctx.fillStyle = 'rgba(11, 41, 25, 0.88)';
        ctx.fillRect(pad, pad, badgeW, badgeH);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(2, Math.round(3 * scale));
        ctx.strokeRect(pad, pad, badgeW, badgeH);

        ctx.fillStyle = '#facc15';
        ctx.textBaseline = 'middle';
        ctx.fillText(topText, pad * 2, pad + badgeH / 2);

        // 3. Bottom Semi-Transparent Info Banner
        const bannerH = Math.round(96 * scale);
        const bannerY = h - bannerH;
        ctx.fillStyle = 'rgba(7, 20, 13, 0.82)';
        ctx.fillRect(0, bannerY, w, bannerH);

        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, bannerY, w, Math.max(2, Math.round(3 * scale)));

        const line1 = `KS: ${sName} | X(Lon): ${xVal} | Y(Lat): ${yVal}`;
        const waterDetail = waterCode === '1' && waterAvg ? `1 (${waterAvg}cm)` : waterCode;
        const line2 = `${dtVal} • GĐ: ${stageCode} (${stObj ? stObj.vi : ''}) • Nước: ${waterDetail} • ${noteVal}`;

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(22 * scale)}px sans-serif`;
        ctx.fillText(line1, pad, bannerY + Math.round(32 * scale));

        ctx.fillStyle = '#fde047';
        ctx.font = `bold ${Math.round(20 * scale)}px sans-serif`;
        ctx.fillText(line2, pad, bannerY + Math.round(68 * scale));

        const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const approxBytes = Math.round((stampedDataUrl.length * 3) / 4);
        const sizeKB = Math.round(approxBytes / 1024);

        resolve({
          rawDataUrl,
          stampedDataUrl,
          fileName: getPhotoFileName(typeKey),
          sizeKB
        });
      };
      img.onerror = reject;
      img.src = rawDataUrl;
    });
  }

  async function handlePhotoFileInput(file, typeKey) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawDataUrl = e.target.result;
        const stamped = await stampImageWithCode(rawDataUrl, typeKey);
        state.currentPhotos[typeKey] = stamped;
        updatePhotoCardsUI();
        showToast(`Đã đóng dấu mã Code lên ${PHOTO_TYPES[typeKey].titleVi} (${stamped.sizeKB} KB)`);
      } catch (err) {
        showToast('Lỗi xử lý ảnh: ' + err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  async function reStampExistingPhotos() {
    for (const typeKey of Object.keys(PHOTO_TYPES)) {
      const existing = state.currentPhotos[typeKey];
      if (existing && existing.rawDataUrl) {
        existing.fileName = getPhotoFileName(typeKey);
        const updated = await stampImageWithCode(existing.rawDataUrl, typeKey);
        state.currentPhotos[typeKey] = updated;
      }
    }
    updatePhotoCardsUI();
  }

  function updatePhotoCardsUI() {
    Object.keys(PHOTO_TYPES).forEach(typeKey => {
      const card = document.getElementById(`photoCard_${typeKey}`);
      const sizeEl = document.getElementById(`photoSize_${typeKey}`);
      const nameEl = document.getElementById(`photoName_${typeKey}`);
      const wrapEl = document.getElementById(`photoPreviewWrap_${typeKey}`);

      const expectedName = getPhotoFileName(typeKey);
      nameEl.textContent = expectedName;

      const photoObj = state.currentPhotos[typeKey];
      if (photoObj && photoObj.stampedDataUrl) {
        card.classList.add('has-photo');
        sizeEl.textContent = `✓ Đã có Code (${photoObj.sizeKB || 240} KB)`;
        wrapEl.innerHTML = `<img src="${photoObj.stampedDataUrl}" alt="${typeKey}" class="photo-preview-img" />`;
      } else {
        card.classList.remove('has-photo');
        sizeEl.textContent = 'Chưa chụp';
        const icons = { TongQuan: '📷', Can1: '🌾', Can2: '🌱' };
        const desc = {
          TongQuan: 'Chụp toàn cảnh ruộng lúa',
          Can1: 'Chụp cận khóm lúa / mặt nước 1',
          Can2: 'Chụp cận khóm lúa / bông lúa 2'
        };
        wrapEl.innerHTML = `
          <div class="photo-placeholder">
            <div style="font-size:2rem;margin-bottom:4px;">${icons[typeKey]}</div>
            <div>${desc[typeKey]}</div>
          </div>
        `;
      }
    });
  }

  // Generate realistic synthetic rice field photo for 1-click Demo / Testing
  async function generateDemoPhotosForCurrentPlot() {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const stageCode = parseInt(document.getElementById('selectedStageInput').value || '3', 10);

    for (const typeKey of ['TongQuan', 'Can1', 'Can2']) {
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = 960;
      const ctx = c.getContext('2d');

      if (typeKey === 'TongQuan') {
        // Sky & Mekong Delta horizon
        const skyGrad = ctx.createLinearGradient(0, 0, 0, 340);
        skyGrad.addColorStop(0, '#0284c7');
        skyGrad.addColorStop(1, '#bae6fd');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, 1280, 340);

        // Paddy field green carpet
        const fieldGrad = ctx.createLinearGradient(0, 340, 0, 960);
        fieldGrad.addColorStop(0, stageCode >= 10 ? '#ca8a04' : '#15803d');
        fieldGrad.addColorStop(1, stageCode >= 10 ? '#eab308' : '#22c55e');
        ctx.fillStyle = fieldGrad;
        ctx.fillRect(0, 340, 1280, 620);

        // Draw rice rows perspective
        ctx.strokeStyle = stageCode >= 10 ? '#fef08a' : '#86efac';
        ctx.lineWidth = 3;
        for (let i = -600; i <= 1880; i += 65) {
          ctx.beginPath();
          ctx.moveTo(640 + (i - 640) * 0.15, 340);
          ctx.lineTo(i, 960);
          ctx.stroke();
        }
      } else {
        // Close-up soil/water + rice stems
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
        bgGrad.addColorStop(0, '#064e3b');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1280, 960);

        // Draw lush rice blades
        for (let i = 0; i < 48; i++) {
          ctx.beginPath();
          const startX = 120 + (i * 22);
          ctx.moveTo(startX, 900);
          ctx.quadraticCurveTo(startX + (i % 2 === 0 ? -90 : 90), 450, startX + (i % 3 - 1) * 140, 110);
          ctx.strokeStyle = stageCode >= 10 ? '#facc15' : (i % 2 === 0 ? '#4ade80' : '#22c55e');
          ctx.lineWidth = 10;
          ctx.stroke();
        }
      }

      // Subtle center watermark indicating simulated field capture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`ẢNH THỰC ĐỊA MẪU • ${stt} (${PHOTO_TYPES[typeKey].label})`, 300, 480);

      const rawDataUrl = c.toDataURL('image/jpeg', 0.85);
      state.currentPhotos[typeKey] = await stampImageWithCode(rawDataUrl, typeKey);
    }
    updatePhotoCardsUI();
    showToast(`Đã tạo & đóng dấu Code đủ 3 ảnh cho điểm ${stt}!`);
  }

  // --- SAVE RECORD WORKFLOW (WITH 100m SAFETY CHECK) ---
  async function handleSaveSurveyRecord(bypassDistanceWarning = false) {
    const sName = document.getElementById('surveyorInput').value.trim();
    if (!sName) {
      showToast('Vui lòng nhập Tên người khảo sát ở thanh đầu trang trước khi lưu!', 'error');
      document.getElementById('surveyorInput').focus();
      return;
    }
    state.surveyorName = sName;
    localStorage.setItem('ksl_surveyorName', sName);

    const stt = normalizeStt(document.getElementById('sttInput').value);
    const xVal = parseFloat(document.getElementById('coordXInput').value);
    const yVal = parseFloat(document.getElementById('coordYInput').value);

    if (isNaN(xVal) || isNaN(yVal)) {
      showToast('Tọa độ X (Kinh độ) và Y (Vĩ độ) không hợp lệ!', 'error');
      return;
    }

    // Check >100m warning in Rounds 2-9 if phone GPS is active
    const round = state.currentRound;
    const distFromGPS = state.userGPS.x !== null
      ? calcDistanceMeters(state.userGPS.x, state.userGPS.y, xVal, yVal)
      : null;

    if (!bypassDistanceWarning && round > 1 && distFromGPS !== null && distFromGPS > 100) {
      showModal({
        title: `⚠️ Cảnh báo khoảng cách GPS (> 100m)`,
        html: `
          <p style="margin-bottom:8px;">
            Vị trí GPS hiện tại của điện thoại đang cách tâm điểm ruộng <strong>${stt}</strong> khoảng <strong>${formatDistance(distFromGPS)}</strong>.
          </p>
          <p style="color:#fde047;font-weight:700;">
            Hãy kiểm tra xem bạn có chọn nhầm mã ruộng không, hoặc bấm "Vẫn xác nhận lưu" nếu bạn đang đứng từ bờ đê/đường lộ chụp vào ruộng.
          </p>
        `,
        buttons: [
          { label: 'Kiểm tra lại', className: 'btn btn-outline btn-sm' },
          {
            label: `✅ Vẫn xác nhận lưu ${stt}`,
            className: 'btn btn-yellow btn-sm',
            onClick: () => handleSaveSurveyRecord(true)
          }
        ]
      });
      return;
    }

    // Re-stamp photos one final time so filenames & burned-in text match 100%
    await reStampExistingPhotos();

    const waterRegime = document.getElementById('selectedWaterInput').value || '1';
    const waterAvg = waterRegime === '1' ? recalcWaterAverage() : '';
    const sowingDate = document.getElementById('sowingDateInput').value.trim();
    const variety = document.getElementById('varietyInput').value.trim();
    const method = document.getElementById('methodInput').value.trim();
    const extraNote = document.getElementById('roundExtraNoteInput').value.trim();
    updateCombinedNotePreview();
    const finalNote = document.getElementById('finalNotePreview').value.trim();

    const record = {
      id: `R${round}_${stt}`,
      round,
      surveyorName: sName,
      surveyorCode: getSurveyorCode(sName),
      stt,
      x: Number(xVal).toFixed(6),
      y: Number(yVal).toFixed(6),
      surveyDateTime: document.getElementById('surveyDateTimeInput').value.trim() || formatNowDateTime(),
      growthStage: parseInt(document.getElementById('selectedStageInput').value || '3', 10),
      waterRegime,
      waterM1: waterRegime === '1' ? document.getElementById('waterM1').value : '',
      waterM2: waterRegime === '1' ? document.getElementById('waterM2').value : '',
      waterM3: waterRegime === '1' ? document.getElementById('waterM3').value : '',
      waterLevelAvg: waterAvg,
      sowingDate,
      variety,
      method,
      extraNote,
      note: finalNote,
      photos: {
        TongQuan: state.currentPhotos.TongQuan ? { ...state.currentPhotos.TongQuan } : null,
        Can1: state.currentPhotos.Can1 ? { ...state.currentPhotos.Can1 } : null,
        Can2: state.currentPhotos.Can2 ? { ...state.currentPhotos.Can2 } : null
      },
      gpsActual: {
        x: state.userGPS.x,
        y: state.userGPS.y,
        accuracy: state.userGPS.accuracy,
        distanceToMasterM: distFromGPS !== null ? Math.round(distFromGPS) : null,
        heading: state.userGPS.heading
      },
      savedAt: new Date().toISOString()
    };

    await dbPut('survey_records', record);
    state.surveyRecords.set(record.id, record);

    // If Round 1 OR if plot is not yet in master_plots OR user unlocked coords, update Master Plot Registry
    const existingMaster = state.masterPlots.get(stt);
    if (round === 1 || !existingMaster || state.coordUnlockedInRepeatRound) {
      const updatedMaster = {
        ...(existingMaster || {}),
        stt,
        x: Number(xVal),
        y: Number(yVal),
        sowingDate: sowingDate || (existingMaster ? existingMaster.sowingDate : ''),
        variety: variety || (existingMaster ? existingMaster.variety : ''),
        method: method || (existingMaster ? existingMaster.method : ''),
        baseNote: `${variety} - ${method}`.replace(/^ - | - $/g, ''),
        updatedAt: new Date().toISOString()
      };
      await dbPut('master_plots', updatedMaster);
      state.masterPlots.set(stt, updatedMaster);
    }

    updateHeaderAndProgressUI();
    refreshMapMarkers();
    showToast(`✅ Đã lưu thành công điểm ${stt} (Đợt ${round})!`);

    // Automatically jump to the next unvisited plot
    jumpToNextUnvisitedPlot();
  }

  function jumpToNextUnvisitedPlot() {
    const allCodes = getAllOrderedPlotCodes();
    const curIdx = allCodes.indexOf(state.currentPlotStt);
    for (let offset = 1; offset <= allCodes.length; offset++) {
      const candidate = allCodes[(curIdx + offset) % allCodes.length];
      if (!getRecord(state.currentRound, candidate)) {
        selectPlotIntoForm(candidate, { panMap: true });
        return;
      }
    }
    selectPlotIntoForm(state.currentPlotStt, { panMap: false });
  }

  // --- TAB 3: ROUNDS MATRIX & PLOT LIST ---
  function renderRoundsMatrix() {
    const container = document.getElementById('roundsMatrixContainer');
    if (!container) return;
    container.innerHTML = '';

    for (let r = 1; r <= 9; r++) {
      const count = getRecordsForRound(r).length;
      const box = document.createElement('div');
      box.className = `round-stat-box ${r === state.currentRound ? 'active' : ''}`;
      box.innerHTML = `
        <div style="font-size:0.76rem;font-weight:800;color:${r === state.currentRound ? '#facc15' : 'var(--text-secondary)'};">
          ĐỢT ${r} ${r === 1 ? '(Gốc)' : ''}
        </div>
        <div style="font-size:1rem;font-weight:900;color:${count > 0 ? '#4ade80' : 'var(--text-primary)'};">
          ${count}/50
        </div>
      `;
      box.addEventListener('click', () => {
        state.currentRound = r;
        localStorage.setItem('ksl_currentRound', String(r));
        updateHeaderAndProgressUI();
        selectPlotIntoForm(state.currentPlotStt, { panMap: false });
        showToast(`Đã chuyển sang Đợt ${r}`);
      });
      container.appendChild(box);
    }
  }

  function renderPlotListTab() {
    const container = document.getElementById('plotListContainer');
    if (!container) return;
    document.getElementById('listRoundTitle').textContent = `Đợt ${state.currentRound}`;

    const searchQ = (document.getElementById('searchPlotInput').value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('filterStatusSelect').value || 'all';
    const allCodes = getAllOrderedPlotCodes();

    const htmlList = [];
    allCodes.forEach(stt => {
      const rec = getRecord(state.currentRound, stt);
      const master = state.masterPlots.get(stt);
      if (statusFilter === 'done' && !rec) return;
      if (statusFilter === 'todo' && rec) return;

      const textBlob = `${stt} ${master ? (master.variety || '') + ' ' + (master.xa || '') + ' ' + (master.huyen || '') : ''} ${rec ? rec.note || '' : ''}`.toLowerCase();
      if (searchQ && !textBlob.includes(searchQ)) return;

      const xDisp = rec ? rec.x : (master && master.x ? Number(master.x).toFixed(6) : '—');
      const yDisp = rec ? rec.y : (master && master.y ? Number(master.y).toFixed(6) : '—');
      const sowDisp = (rec && rec.sowingDate) || (master && master.sowingDate) || '—';
      const noteDisp = (rec && rec.note) || (master && master.baseNote) || '—';
      const stageObj = rec ? RICE_STAGES.find(s => s.code === Number(rec.growthStage)) : null;

      let thumbsHTML = '';
      if (rec && rec.photos) {
        ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
          const p = rec.photos[tk];
          if (p && p.stampedDataUrl) {
            thumbsHTML += `<img src="${p.stampedDataUrl}" class="plot-thumb-mini" title="${p.fileName}" onclick="window.__kslViewPhoto('${rec.id}','${tk}')" />`;
          }
        });
      }

      htmlList.push(`
        <div class="plot-item ${rec ? 'done' : ''}">
          <div class="plot-item-top">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="plot-stt-badge">${stt}</span>
              <span class="${rec ? 'status-pill-done' : 'status-pill-todo'}">
                ${rec ? `✓ Đã khảo sát (${rec.surveyDateTime})` : `⏳ Chưa đo Đợt ${state.currentRound}`}
              </span>
              ${master && master.xa ? `<span style="font-size:0.8rem;color:var(--text-secondary);font-weight:700;">📍 ${master.xa}</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.__kslStartPlot('${stt}')">
                ${rec ? '✏️ Sửa / Xem' : '📝 Đo ngay'}
              </button>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${yDisp},${xDisp}&travelmode=two-wheeler" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                🛵 Chỉ đường
              </a>
              ${rec ? `<button type="button" class="btn btn-danger btn-sm" onclick="window.__kslDeleteRecord('${rec.id}')">🗑️</button>` : ''}
            </div>
          </div>

          <div style="font-size:0.83rem;color:var(--text-secondary);display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px;">
            <div><strong>Tọa độ (X, Y):</strong> ${xDisp}, ${yDisp}</div>
            <div><strong>Ngày sạ/cấy:</strong> ${sowDisp}</div>
            <div><strong>Giống &amp; Ghi chú:</strong> ${noteDisp}</div>
            ${rec ? `<div><strong>Giai đoạn:</strong> Mã ${rec.growthStage} (${stageObj ? stageObj.vi : ''}) | <strong>Nước:</strong> Mã ${rec.waterRegime}${rec.waterLevelAvg ? ` (${rec.waterLevelAvg}cm)` : ''}</div>` : ''}
          </div>
          ${thumbsHTML ? `<div class="plot-thumbs">${thumbsHTML}</div>` : ''}
        </div>
      `);
    });

    container.innerHTML = htmlList.length > 0
      ? htmlList.join('')
      : `<div style="text-align:center;padding:24px;color:var(--text-secondary);">Không có điểm ruộng nào khớp bộ lọc.</div>`;
  }

  window.__kslDeleteRecord = function (recordId) {
    const rec = state.surveyRecords.get(recordId);
    if (!rec) return;
    showModal({
      title: `Xóa bản ghi ${rec.stt} (Đợt ${rec.round})?`,
      html: `<p>Bạn có chắc muốn xóa dữ liệu khảo sát của điểm <strong>${rec.stt}</strong> trong <strong>Đợt ${rec.round}</strong> không? (Danh mục tọa độ gốc Đợt 1 vẫn được giữ an toàn).</p>`,
      buttons: [
        { label: 'Hủy', className: 'btn btn-outline btn-sm' },
        {
          label: '🗑️ Xác nhận xóa',
          className: 'btn btn-danger btn-sm',
          onClick: async () => {
            await dbDelete('survey_records', recordId);
            state.surveyRecords.delete(recordId);
            updateHeaderAndProgressUI();
            refreshMapMarkers();
            showToast(`Đã xóa bản ghi ${rec.stt} (Đợt ${rec.round})`);
          }
        }
      ]
    });
  };

  window.__kslViewPhoto = function (recordId, typeKey) {
    const rec = state.surveyRecords.get(recordId);
    if (!rec || !rec.photos || !rec.photos[typeKey]) return;
    openLightbox(rec.photos[typeKey], null);
  };

  // --- MASTER PLOT REGISTRY SYNC (EXPORT / IMPORT JSON, XLSX, GEOJSON) ---
  function exportMasterRegistryJSON() {
    const list = Array.from(state.masterPlots.values()).sort((a, b) =>
      a.stt.localeCompare(b.stt, undefined, { numeric: true })
    );
    const payload = {
      version: '2.0',
      exportedAt: formatNowDateTime(),
      exportedBy: state.surveyorName,
      totalPlots: list.length,
      masterPlots: list
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownloadBlob(blob, 'DanhMuc_50RuongGoc.json');
    showToast(`Đã xuất DanhMuc_50RuongGoc.json (${list.length} điểm ruộng gốc)`);
  }

  async function importMasterRegistryFile(file) {
    if (!file) return;
    try {
      const name = file.name.toLowerCase();
      let importedPlots = [];

      if (name.endsWith('.json') || name.endsWith('.geojson')) {
        const text = await file.text();
        const obj = JSON.parse(text);
        if (Array.isArray(obj.masterPlots)) {
          importedPlots = obj.masterPlots;
        } else if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
          importedPlots = obj.features.map((f, idx) => {
            const p = f.properties || {};
            const coords = (f.geometry && f.geometry.coordinates) || [105.741, 10.546];
            return {
              stt: normalizeStt(p.stt || p['STT (GPS)'] || `CT${idx + 1}`),
              x: Number(coords[0]),
              y: Number(coords[1]),
              sowingDate: p.sowingDate || p['Ngày sạ/cấy'] || '15/10/2026',
              variety: p.variety || 'OM5454',
              method: p.method || 'Sạ hàng',
              baseNote: p.note || p.baseNote || 'OM5454 - Sạ hàng'
            };
          });
        } else if (Array.isArray(obj)) {
          importedPlots = obj;
        }
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        importedPlots = rows.map((r, idx) => {
          const stt = normalizeStt(r['STT (GPS)'] || r['stt'] || r['MaDiem_GPS'] || `CT${idx + 1}`);
          const x = parseFloat(r['X'] || r['x'] || r['KinhDo_E'] || r['Longitude']);
          const y = parseFloat(r['Y'] || r['y'] || r['ViDo_N'] || r['Latitude']);
          const noteRaw = String(r['Ghi chú - Note (giống lúa và phương pháp sạ/cấy)'] || r['baseNote'] || 'OM5454 - Sạ hàng');
          const parts = noteRaw.split('-').map(s => s.trim());
          return {
            stt,
            x,
            y,
            sowingDate: String(r['Ngày sạ/cấy sowing/transplanting date (if any) dd/mm/yy'] || r['sowingDate'] || '15/10/2026'),
            variety: r['variety'] || parts[0] || 'OM5454',
            method: r['method'] || parts[1] || 'Sạ hàng',
            baseNote: noteRaw
          };
        }).filter(p => !isNaN(p.x) && !isNaN(p.y));
      }

      if (importedPlots.length === 0) {
        showToast('Không tìm thấy dữ liệu tọa độ ruộng hợp lệ trong file!', 'error');
        return;
      }

      for (const p of importedPlots) {
        const cleanPlot = {
          stt: normalizeStt(p.stt),
          x: Number(parseFloat(p.x).toFixed(6)),
          y: Number(parseFloat(p.y).toFixed(6)),
          sowingDate: p.sowingDate || '15/10/2026',
          variety: p.variety || 'OM5454',
          method: p.method || 'Sạ hàng',
          baseNote: p.baseNote || `${p.variety || 'OM5454'} - ${p.method || 'Sạ hàng'}`,
          xa: p.xa || '',
          huyen: p.huyen || ''
        };
        await dbPut('master_plots', cleanPlot);
        state.masterPlots.set(cleanPlot.stt, cleanPlot);
      }

      updateHeaderAndProgressUI();
      selectPlotIntoForm(importedPlots[0].stt, { panMap: true });
      fitAllMasterPlotsOnMap();
      showToast(`✅ Đã nạp & đồng bộ thành công ${importedPlots.length} điểm ruộng gốc!`);
    } catch (err) {
      showToast('Lỗi đọc file danh mục: ' + err.message, 'error');
    }
  }

  // Load built-in preset (including 5-plot demo that populates Round 1 records and switches to Round 2 if desired)
  async function loadPresetDataset(presetKey) {
    if (!window.DBSCL_PRESETS || !window.DBSCL_PRESETS[presetKey]) return;
    const list = window.DBSCL_PRESETS[presetKey];

    state.masterPlots.clear();
    const tx = state.db.transaction('master_plots', 'readwrite');
    tx.objectStore('master_plots').clear();
    await new Promise(res => { tx.oncomplete = res; });

    for (const item of list) {
      await dbPut('master_plots', item);
      state.masterPlots.set(item.stt, item);
    }

    // If user clicked the 5-plot demo preset, also create 5 sample Round 1 survey records with stamped photos so they can immediately test Round 1 -> Round 2 transition!
    if (presetKey === 'demo_5_ct') {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const rec = {
          id: `R1_${p.stt}`,
          round: 1,
          surveyorName: state.surveyorName || 'Nguyễn Văn Minh',
          surveyorCode: getSurveyorCode(state.surveyorName || 'Nguyễn Văn Minh'),
          stt: p.stt,
          x: Number(p.x).toFixed(6),
          y: Number(p.y).toFixed(6),
          surveyDateTime: formatNowDateTime(),
          growthStage: 3,
          waterRegime: '1',
          waterM1: '4.5',
          waterM2: '5.5',
          waterM3: '5.0',
          waterLevelAvg: '5.0',
          sowingDate: p.sowingDate,
          variety: p.variety,
          method: p.method,
          extraNote: 'Lúa đẻ nhánh khỏe',
          note: `${p.variety} - ${p.method} (Lúa đẻ nhánh khỏe)`,
          photos: { TongQuan: null, Can1: null, Can2: null },
          gpsActual: { x: p.x, y: p.y, accuracy: 6, distanceToMasterM: 4, heading: 90 },
          savedAt: new Date().toISOString()
        };
        await dbPut('survey_records', rec);
        state.surveyRecords.set(rec.id, rec);
      }
      state.currentRound = 2;
      localStorage.setItem('ksl_currentRound', '2');
      showToast('🧪 Đã tạo 5 điểm gốc Đợt 1 và chuyển sang Đợt 2 để bạn thử nghiệm đi đo lặp lại!');
    } else {
      showToast(`✅ Đã nạp bộ 50 điểm ruộng gốc (${presetKey.replace('_50', '').toUpperCase()})!`);
    }

    updateHeaderAndProgressUI();
    selectPlotIntoForm(list[0].stt, { panMap: true });
    fitAllMasterPlotsOnMap();
  }

  // --- EXPORT EXCEL, CSV, GEOJSON, KML & ZALO ZIP PACKAGE ---
  function getRecordsToExport() {
    const scope = document.getElementById('exportScopeSelect').value || 'current';
    if (scope === 'all') {
      return Array.from(state.surveyRecords.values()).sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.stt.localeCompare(b.stt, undefined, { numeric: true });
      });
    }
    return getRecordsForRound(state.currentRound);
  }

  function buildStandardSheetRows(records) {
    // Exact 9 standard columns + Round & Surveyor metadata + 3 photo filenames
    return records.map(r => {
      const das = computeDAS(r.sowingDate, r.surveyDateTime);
      return {
        'STT (GPS)': r.stt,
        'X': Number(r.x),
        'Y': Number(r.y),
        'Ngày và giờ khảo sát (dd/mm/yy hh:mm)': r.surveyDateTime,
        'Giai đoạn sinh trưởng của lúa (ảnh, hoặc thông tin của người nông dân) - Rice growth stages': Number(r.growthStage),
        'Chế độ ngập nước': r.waterRegime,
        'Chiều cao mực nước (cm, trung bình 3 lần đo)': r.waterRegime === '1' && r.waterLevelAvg !== '' ? Number(r.waterLevelAvg) : '',
        'Ngày sạ/cấy sowing/transplanting date (if any) dd/mm/yy': r.sowingDate || '',
        'Ghi chú - Note (giống lúa và phương pháp sạ/cấy)': r.note || '',
        'Đợt khảo sát': Number(r.round),
        'Người khảo sát': r.surveyorName || '',
        'Mã người KS': r.surveyorCode || '',
        'Số ngày sau sạ (NSS/DAS)': das !== null ? das : '',
        'Ảnh Tổng quan': r.photos && r.photos.TongQuan ? r.photos.TongQuan.fileName : '',
        'Ảnh Cận 1': r.photos && r.photos.Can1 ? r.photos.Can1.fileName : '',
        'Ảnh Cận 2': r.photos && r.photos.Can2 ? r.photos.Can2.fileName : ''
      };
    });
  }

  function generateExcelWorkbookBuffer(records) {
    const wb = XLSX.utils.book_new();
    const surveyRows = buildStandardSheetRows(records);
    const wsSurvey = XLSX.utils.json_to_sheet(
      surveyRows.length > 0
        ? surveyRows
        : [{ 'STT (GPS)': 'Chưa có bản ghi', 'X': '', 'Y': '' }]
    );
    XLSX.utils.book_append_sheet(wb, wsSurvey, 'DuLieuKhaoSatLua');

    // Also include Master Plots sheet (50 ruộng gốc)
    const masterList = Array.from(state.masterPlots.values()).sort((a, b) =>
      a.stt.localeCompare(b.stt, undefined, { numeric: true })
    );
    const wsMaster = XLSX.utils.json_to_sheet(masterList);
    XLSX.utils.book_append_sheet(wb, wsMaster, 'DanhMuc_50RuongGoc');

    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function generateCSVWithBOM(records) {
    const rows = buildStandardSheetRows(records);
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return '\uFEFF' + csv;
  }

  function generateGeoJSONString(records) {
    const features = records.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(r.x), parseFloat(r.y)]
      },
      properties: {
        stt: r.stt,
        round: r.round,
        surveyorName: r.surveyorName,
        surveyDateTime: r.surveyDateTime,
        growthStage: Number(r.growthStage),
        waterRegime: r.waterRegime,
        waterLevelAvg: r.waterLevelAvg,
        sowingDate: r.sowingDate,
        note: r.note,
        photoTongQuan: r.photos && r.photos.TongQuan ? r.photos.TongQuan.fileName : '',
        photoCan1: r.photos && r.photos.Can1 ? r.photos.Can1.fileName : '',
        photoCan2: r.photos && r.photos.Can2 ? r.photos.Can2.fileName : ''
      }
    }));
    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
  }

  function generateKMLString(records) {
    const placemarks = records.map(r => {
      const stObj = RICE_STAGES.find(s => s.code === Number(r.growthStage));
      return `
    <Placemark>
      <name>${r.stt} (Đợt ${r.round})</name>
      <description><![CDATA[
        <b>Mã ruộng:</b> ${r.stt}<br/>
        <b>Đợt khảo sát:</b> Đợt ${r.round}<br/>
        <b>Người khảo sát:</b> ${r.surveyorName}<br/>
        <b>Ngày giờ:</b> ${r.surveyDateTime}<br/>
        <b>Giai đoạn lúa:</b> Mã ${r.growthStage} (${stObj ? stObj.vi : ''})<br/>
        <b>Chế độ nước:</b> Mã ${r.waterRegime} ${r.waterLevelAvg ? '(' + r.waterLevelAvg + ' cm)' : ''}<br/>
        <b>Ngày sạ/cấy:</b> ${r.sowingDate}<br/>
        <b>Ghi chú:</b> ${r.note}
      ]]></description>
      <Point>
        <coordinates>${r.x},${r.y},0</coordinates>
      </Point>
    </Placemark>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>KhaoSatLua_DBSCL_Dot${state.currentRound}</name>
    ${placemarks}
  </Document>
</kml>`;
  }

  function getBaseExportPrefix(records) {
    const scope = document.getElementById('exportScopeSelect').value || 'current';
    const roundTag = scope === 'all' ? 'CaVu9Dot' : `Dot${state.currentRound}`;
    const sCode = getSurveyorCode(state.surveyorName);
    const ts = formatFileTimestamp();
    return `KhaoSatLua_${roundTag}_${sCode}_${ts}_${records.length}diem`;
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  async function buildZipPackageBlob() {
    const records = getRecordsToExport();
    const prefix = getBaseExportPrefix(records);
    const zip = new JSZip();

    // 1. Excel .xlsx & .csv
    const xlsxBuf = generateExcelWorkbookBuffer(records);
    zip.file(`${prefix}.xlsx`, xlsxBuf);

    const csvStr = generateCSVWithBOM(records);
    zip.file(`${prefix}.csv`, csvStr);

    // 2. Master Plot Registry JSON
    const masterList = Array.from(state.masterPlots.values()).sort((a, b) =>
      a.stt.localeCompare(b.stt, undefined, { numeric: true })
    );
    zip.file('DanhMuc_50RuongGoc.json', JSON.stringify({
      version: '2.0',
      exportedAt: formatNowDateTime(),
      exportedBy: state.surveyorName,
      totalPlots: masterList.length,
      masterPlots: masterList
    }, null, 2));

    // 3. GIS .geojson & .kml
    zip.file(`${prefix}.geojson`, generateGeoJSONString(records));
    zip.file(`${prefix}.kml`, generateKMLString(records));

    // 4. Stamped Code Photos folder (Anh_Co_Code/) & Optional Raw Photos folder
    const folderCoded = zip.folder('Anh_Co_Code');
    const includeRaw = document.getElementById('chkSaveRawPhotos').checked;
    const folderRaw = includeRaw ? zip.folder('Anh_Goc_Sach_AI') : null;

    records.forEach(r => {
      if (!r.photos) return;
      ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
        const p = r.photos[tk];
        if (p && p.stampedDataUrl) {
          const fName = p.fileName || `Dot${r.round}_${r.stt}_${r.surveyorCode}_${tk}.jpg`;
          folderCoded.file(fName, dataUrlToUint8Array(p.stampedDataUrl));
          if (includeRaw && folderRaw && p.rawDataUrl) {
            folderRaw.file(fName.replace('.jpg', '_RAW.jpg'), dataUrlToUint8Array(p.rawDataUrl));
          }
        }
      });
    });

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, fileName: `${prefix}.zip`, count: records.length };
  }

  function triggerDownloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function updateExportPreviewUI() {
    const records = getRecordsToExport();
    const prefix = getBaseExportPrefix(records);
    let photoCount = 0;
    records.forEach(r => {
      if (r.photos) {
        ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
          if (r.photos[tk] && r.photos[tk].stampedDataUrl) photoCount++;
        });
      }
    });

    const previewEl = document.getElementById('exportPackagePreview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div style="font-weight:900;color:#facc15;margin-bottom:6px;word-break:break-all;">
          📁 Tên gói nén: ${prefix}.zip
        </div>
        <ul style="padding-left:18px;line-height:1.55;color:var(--text-secondary);">
          <li>📊 <strong>${prefix}.xlsx</strong> &amp; <strong>.csv</strong> (${records.length} điểm khảo sát, chuẩn 9 cột gốc)</li>
          <li>🗂️ <strong>DanhMuc_50RuongGoc.json</strong> (${state.masterPlots.size} điểm ruộng gốc đồng bộ Đợt 2–9)</li>
          <li>🌍 <strong>${prefix}.geojson</strong> &amp; <strong>.kml</strong> (Mở trực tiếp trên Google Earth / QGIS)</li>
          <li>🖼️ Thư mục <strong>Anh_Co_Code/</strong> (${photoCount} ảnh JPEG đã đóng dấu mã Code)</li>
        </ul>
      `;
    }

    // Build Zalo Quick Text Report
    const roundRecords = getRecordsForRound(state.currentRound);
    const doneStts = roundRecords.map(r => r.stt).join(', ');
    const allCodes = getAllOrderedPlotCodes();
    const todoStts = allCodes.filter(c => !getRecord(state.currentRound, c));
    const reportText = [
      `🌾 [BÁO CÁO KHẢO SÁT LÚA THỰC ĐỊA - ĐỢT ${state.currentRound}/9]`,
      `👤 Người khảo sát: ${state.surveyorName} (Mã: ${getSurveyorCode(state.surveyorName)})`,
      `🕒 Thời gian báo cáo: ${formatNowDateTime()}`,
      `✅ Tiến độ Đợt ${state.currentRound}: Đã đo ${roundRecords.length}/${TOTAL_TARGET_PLOTS} điểm ruộng (Còn lại ${todoStts.length} điểm)`,
      `📍 Các điểm đã đo (${roundRecords.length}): ${doneStts || 'Chưa có'}`,
      `⏳ Các điểm còn lại (${todoStts.length}): ${todoStts.slice(0, 15).join(', ')}${todoStts.length > 15 ? '...' : ''}`,
      `📦 File đính kèm: ${prefix}.zip`
    ].join('\n');

    const reportArea = document.getElementById('zaloReportTextarea');
    if (reportArea) reportArea.value = reportText;
  }

  // --- LIGHTBOX & QR MODAL ---
  function openLightbox(photoObj, activeTypeKey) {
    state.lightboxActiveType = activeTypeKey;
    const modal = document.getElementById('lightboxModal');
    document.getElementById('lightboxTitle').textContent = photoObj.fileName || 'Xem ảnh có Code';
    document.getElementById('lightboxImg').src = photoObj.stampedDataUrl;
    document.getElementById('lightboxMeta').textContent = `Tên file: ${photoObj.fileName} • Dung lượng: ~${photoObj.sizeKB || 240} KB`;

    const dlBtn = document.getElementById('btnDownloadSinglePhoto');
    dlBtn.href = photoObj.stampedDataUrl;
    dlBtn.download = photoObj.fileName || 'AnhKhaoSat.jpg';

    const delBtn = document.getElementById('btnDeletePhotoLightbox');
    delBtn.style.display = activeTypeKey ? 'inline-flex' : 'none';
    modal.classList.add('open');
  }

  function openQRModal() {
    const modal = document.getElementById('qrModal');
    const urlInput = document.getElementById('qrUrlInput');
    const isLocalOrFile = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const currentUrl = isLocalOrFile ? 'https://pdtien.github.io/khao-sat-lua-dbscl/' : window.location.href;
    urlInput.value = currentUrl;
    renderQRCode(currentUrl);
    modal.classList.add('open');
  }

  function renderQRCode(url) {
    const box = document.getElementById('qrCodeContainer');
    box.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(box, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#07140d',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // --- TAB NAVIGATION ---
  function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    if (tabId === 'tab-survey' && state.miniMap) {
      setTimeout(() => state.miniMap.invalidateSize(), 120);
    }
    if (tabId === 'tab-map' && state.fullMap) {
      setTimeout(() => {
        state.fullMap.invalidateSize();
        refreshMapMarkers();
      }, 120);
    }
    if (tabId === 'tab-export') {
      updateExportPreviewUI();
    }
  }

  // --- INITIALIZE EVENT LISTENERS ---
  function bindEvents() {
    // Bottom navigation tabs
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Online / Offline indicator
    const updateNetBadge = () => {
      const b = document.getElementById('netStatusBadge');
      if (navigator.onLine) {
        b.textContent = 'ONLINE';
        b.className = 'net-badge net-online';
      } else {
        b.textContent = 'OFFLINE';
        b.className = 'net-badge net-offline';
      }
    };
    window.addEventListener('online', updateNetBadge);
    window.addEventListener('offline', updateNetBadge);
    updateNetBadge();

    // Theme toggle
    if (state.themeLight) document.body.classList.add('theme-light');
    document.getElementById('btnToggleTheme').addEventListener('click', () => {
      state.themeLight = !state.themeLight;
      document.body.classList.toggle('theme-light', state.themeLight);
      localStorage.setItem('ksl_themeLight', String(state.themeLight));
    });

    // QR Code modal
    document.getElementById('btnShowQR').addEventListener('click', openQRModal);
    document.getElementById('btnCloseQRModal').addEventListener('click', () => {
      document.getElementById('qrModal').classList.remove('open');
    });
    document.getElementById('qrUrlInput').addEventListener('input', (e) => {
      renderQRCode(e.target.value.trim() || window.location.href);
    });
    document.getElementById('btnCopyQRUrl').addEventListener('click', () => {
      const url = document.getElementById('qrUrlInput').value;
      navigator.clipboard.writeText(url).then(() => showToast('Đã copy đường link mở trên điện thoại!'));
    });

    // Quick Demo button in Header
    document.getElementById('btnQuickDemoHeader').addEventListener('click', () => {
      showModal({
        title: '⚡ Nạp Nhanh Dữ Liệu Mẫu Thực Địa ĐBSCL',
        html: `
          <p style="margin-bottom:10px;">Chọn kịch bản dữ liệu mẫu để kiểm thử nhanh toàn bộ quy trình 9 đợt × 50 điểm ruộng cố định:</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button type="button" class="btn btn-yellow btn-sm" id="modalBtnDemo5">
              🧪 Kịch bản 1: Tạo 5 điểm Đợt 1 + Chuyển sang Đợt 2 đi đo lại (Khuyên dùng kiểm thử)
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="modalBtnDT50">
              🌾 Kịch bản 2: Nạp 50 điểm ruộng gốc Đồng Tháp (CT01–CT50)
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="modalBtnCT50">
              🌾 Kịch bản 3: Nạp 50 điểm ruộng gốc Cần Thơ - Cờ Đỏ (CT01–CT50)
            </button>
          </div>
        `,
        buttons: [{ label: 'Đóng', className: 'btn btn-outline btn-sm' }]
      });
      setTimeout(() => {
        const b1 = document.getElementById('modalBtnDemo5');
        const b2 = document.getElementById('modalBtnDT50');
        const b3 = document.getElementById('modalBtnCT50');
        if (b1) b1.onclick = () => { document.getElementById('customModal').classList.remove('open'); loadPresetDataset('demo_5_ct'); };
        if (b2) b2.onclick = () => { document.getElementById('customModal').classList.remove('open'); loadPresetDataset('dong_thap_50'); };
        if (b3) b3.onclick = () => { document.getElementById('customModal').classList.remove('open'); loadPresetDataset('can_tho_50'); };
      }, 50);
    });

    // Round selector & Surveyor input
    document.getElementById('roundSelect').addEventListener('change', (e) => {
      state.currentRound = parseInt(e.target.value, 10);
      localStorage.setItem('ksl_currentRound', String(state.currentRound));
      updateHeaderAndProgressUI();
      selectPlotIntoForm(state.currentPlotStt, { panMap: false });
      showToast(`Đã chuyển sang Đợt ${state.currentRound}`);
    });

    document.getElementById('surveyorInput').addEventListener('input', (e) => {
      state.surveyorName = e.target.value;
      localStorage.setItem('ksl_surveyorName', state.surveyorName);
      document.getElementById('surveyorCodeBadge').textContent = getSurveyorCode(state.surveyorName);
      reStampExistingPhotos();
      updateExportPreviewUI();
    });

    // Plot selection & STT input
    document.getElementById('plotSelectQuick').addEventListener('change', (e) => {
      selectPlotIntoForm(e.target.value, { panMap: true });
    });

    document.getElementById('sttInput').addEventListener('change', (e) => {
      selectPlotIntoForm(e.target.value, { panMap: true });
    });

    document.getElementById('btnNextUnvisited').addEventListener('click', jumpToNextUnvisitedPlot);

    // GPS & Map buttons in Form
    document.getElementById('btnGetGPS').addEventListener('click', () => requestCurrentGPS(true));
    document.getElementById('btnRefreshNearest').addEventListener('click', () => requestCurrentGPS(false));

    document.getElementById('btnOpenGMapsForm').addEventListener('click', () => {
      const x = parseFloat(document.getElementById('coordXInput').value);
      const y = parseFloat(document.getElementById('coordYInput').value);
      if (!isNaN(x) && !isNaN(y)) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${y.toFixed(6)},${x.toFixed(6)}&travelmode=two-wheeler`, '_blank');
      }
    });

    document.getElementById('btnToggleCoordLock').addEventListener('click', () => {
      state.coordUnlockedInRepeatRound = !state.coordUnlockedInRepeatRound;
      const xInput = document.getElementById('coordXInput');
      const yInput = document.getElementById('coordYInput');
      const btn = document.getElementById('btnToggleCoordLock');
      xInput.readOnly = !state.coordUnlockedInRepeatRound;
      yInput.readOnly = !state.coordUnlockedInRepeatRound;
      btn.textContent = state.coordUnlockedInRepeatRound
        ? '🔓 Đã mở khóa sửa tọa độ gốc (Bấm để khóa lại)'
        : '🔒 Đang khóa tọa độ gốc Đợt 1 (Bấm để mở khóa)';
      refreshMapMarkers();
    });

    ['coordXInput', 'coordYInput'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        updateDistanceCheckBanner();
        reStampExistingPhotos();
        syncMapsToCurrentPlot(true);
      });
    });

    // Date/time & Sowing date
    document.getElementById('btnNowDateTime').addEventListener('click', () => {
      document.getElementById('surveyDateTimeInput').value = formatNowDateTime();
      updateDASAndStageHints();
      reStampExistingPhotos();
    });

    document.getElementById('surveyDateTimeInput').addEventListener('input', () => {
      updateDASAndStageHints();
      reStampExistingPhotos();
    });

    document.getElementById('sowingDateInput').addEventListener('input', () => {
      updateDASAndStageHints();
    });

    document.getElementById('sowingDatePicker').addEventListener('change', (e) => {
      const val = e.target.value; // yyyy-mm-dd
      if (val) {
        const [yyyy, mm, dd] = val.split('-');
        document.getElementById('sowingDateInput').value = `${dd}/${mm}/${yyyy}`;
        updateDASAndStageHints();
      }
    });

    // Water regime & 3 measurements
    document.querySelectorAll('#waterRegimeGrid .water-btn').forEach(btn => {
      btn.addEventListener('click', () => setWaterRegime(btn.dataset.water));
    });

    ['waterM1', 'waterM2', 'waterM3'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        recalcWaterAverage();
        reStampExistingPhotos();
      });
    });

    // Variety, Method & Extra Note
    ['varietyInput', 'methodInput', 'roundExtraNoteInput'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        reStampExistingPhotos();
      });
    });

    // 3 Photo capture inputs & Lightbox
    document.querySelectorAll('[data-photo-input]').forEach(input => {
      input.addEventListener('change', (e) => {
        const typeKey = input.getAttribute('data-photo-input');
        const file = e.target.files && e.target.files[0];
        if (file) handlePhotoFileInput(file, typeKey);
        input.value = '';
      });
    });

    ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
      document.getElementById(`photoPreviewWrap_${tk}`).addEventListener('click', () => {
        const p = state.currentPhotos[tk];
        if (p && p.stampedDataUrl) {
          openLightbox(p, tk);
        }
      });
    });

    document.getElementById('btnGenerate3DemoPhotos').addEventListener('click', generateDemoPhotosForCurrentPlot);

    document.getElementById('chkSaveRawPhotos').checked = state.saveRawPhotos;
    document.getElementById('chkSaveRawPhotos').addEventListener('change', (e) => {
      state.saveRawPhotos = e.target.checked;
      localStorage.setItem('ksl_saveRawPhotos', String(state.saveRawPhotos));
    });

    document.getElementById('btnCloseLightbox').addEventListener('click', () => {
      document.getElementById('lightboxModal').classList.remove('open');
    });

    document.getElementById('btnDeletePhotoLightbox').addEventListener('click', () => {
      if (state.lightboxActiveType) {
        state.currentPhotos[state.lightboxActiveType] = null;
        updatePhotoCardsUI();
      }
      document.getElementById('lightboxModal').classList.remove('open');
    });

    // Save & Form Actions
    document.getElementById('btnSaveRecord').addEventListener('click', () => handleSaveSurveyRecord(false));

    document.getElementById('btnResetForm').addEventListener('click', () => {
      state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };
      document.getElementById('roundExtraNoteInput').value = '';
      document.getElementById('waterM1').value = '';
      document.getElementById('waterM2').value = '';
      document.getElementById('waterM3').value = '';
      recalcWaterAverage();
      updatePhotoCardsUI();
      showToast('Đã làm mới các trường nhập của điểm hiện tại');
    });

    document.getElementById('btnJumpToMap').addEventListener('click', () => switchTab('tab-map'));

    // Tab 2: Map controls
    document.getElementById('btnLocateMeMap').addEventListener('click', () => {
      requestCurrentGPS(false);
      setTimeout(() => {
        if (state.userGPS.x && state.userGPS.y && state.fullMap) {
          state.fullMap.setView([state.userGPS.y, state.userGPS.x], 16);
        }
      }, 600);
    });

    document.getElementById('btnFitAllPlots').addEventListener('click', fitAllMasterPlotsOnMap);

    document.querySelectorAll('[data-map-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mapFilter = btn.getAttribute('data-map-filter');
        document.querySelectorAll('[data-map-filter]').forEach(b => {
          b.classList.toggle('selected', b.getAttribute('data-map-filter') === state.mapFilter);
        });
        refreshMapMarkers();
      });
    });

    // Tab 3: Master Registry Sync & List controls
    document.getElementById('btnExportMasterJSON').addEventListener('click', exportMasterRegistryJSON);
    document.getElementById('btnDownloadMasterJSON2').addEventListener('click', exportMasterRegistryJSON);

    document.getElementById('inputImportMaster').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importMasterRegistryFile(f);
      e.target.value = '';
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => loadPresetDataset(btn.getAttribute('data-preset')));
    });

    document.getElementById('searchPlotInput').addEventListener('input', renderPlotListTab);
    document.getElementById('filterStatusSelect').addEventListener('change', renderPlotListTab);

    document.getElementById('btnClearCurrentRound').addEventListener('click', () => {
      const round = state.currentRound;
      const list = getRecordsForRound(round);
      if (list.length === 0) {
        showToast(`Đợt ${round} hiện chưa có bản ghi nào để xóa.`, 'warn');
        return;
      }
      showModal({
        title: `🗑️ Xóa toàn bộ ${list.length} bản ghi của Đợt ${round}?`,
        html: `<p>Danh mục 50 điểm ruộng gốc vẫn được giữ nguyên. Bạn có chắc chắn muốn xóa ${list.length} bản ghi khảo sát của <strong>Đợt ${round}</strong> không?</p>`,
        buttons: [
          { label: 'Hủy', className: 'btn btn-outline btn-sm' },
          {
            label: `Xóa Đợt ${round}`,
            className: 'btn btn-danger btn-sm',
            onClick: async () => {
              for (const r of list) {
                await dbDelete('survey_records', r.id);
                state.surveyRecords.delete(r.id);
              }
              updateHeaderAndProgressUI();
              refreshMapMarkers();
              showToast(`Đã xóa dữ liệu khảo sát của Đợt ${round}`);
            }
          }
        ]
      });
    });

    // Tab 4: Export & Share via Zalo
    document.getElementById('exportScopeSelect').addEventListener('change', updateExportPreviewUI);

    document.getElementById('btnShareZaloZip').addEventListener('click', async () => {
      try {
        showToast('⏳ Đang đóng gói file .ZIP (Excel + GIS + Ảnh có Code)...');
        const { blob, fileName } = await buildZipPackageBlob();
        const zipFile = new File([blob], fileName, { type: 'application/zip' });

        if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
          await navigator.share({
            title: `Khảo sát lúa Đợt ${state.currentRound} - ${state.surveyorName}`,
            text: document.getElementById('zaloReportTextarea').value,
            files: [zipFile]
          });
          showToast('✅ Đã mở bảng chia sẻ qua Zalo!');
        } else {
          triggerDownloadBlob(blob, fileName);
          showToast('✅ Đã tải gói .ZIP về máy! Bạn có thể đính kèm gửi qua Zalo.');
        }
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          showToast('Lỗi đóng gói chia sẻ: ' + err.message, 'error');
        }
      }
    });

    document.getElementById('btnDownloadZipOnly').addEventListener('click', async () => {
      showToast('⏳ Đang tạo gói nén .ZIP...');
      const { blob, fileName } = await buildZipPackageBlob();
      triggerDownloadBlob(blob, fileName);
      showToast(`✅ Đã tải xuống ${fileName}`);
    });

    document.getElementById('btnDownloadExcelOnly').addEventListener('click', () => {
      const records = getRecordsToExport();
      const prefix = getBaseExportPrefix(records);
      const buf = generateExcelWorkbookBuffer(records);
      triggerDownloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${prefix}.xlsx`);
      showToast(`Đã tải xuống ${prefix}.xlsx`);
    });

    document.getElementById('btnDownloadGeoJSONOnly').addEventListener('click', () => {
      const records = getRecordsToExport();
      const prefix = getBaseExportPrefix(records);
      triggerDownloadBlob(new Blob([generateGeoJSONString(records)], { type: 'application/geo+json;charset=utf-8' }), `${prefix}.geojson`);
      triggerDownloadBlob(new Blob([generateKMLString(records)], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }), `${prefix}.kml`);
      showToast('Đã tải xuống file bản đồ .GeoJSON và .KML');
    });

    document.getElementById('btnCopyZaloReport').addEventListener('click', () => {
      const txt = document.getElementById('zaloReportTextarea').value;
      navigator.clipboard.writeText(txt).then(() => {
        showToast('📋 Đã copy báo cáo tiến độ! Hãy dán vào nhóm Zalo.');
      });
    });
  }

  // --- REGISTER SERVICE WORKER FOR OFFLINE PWA ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // --- BOOTSTRAP APPLICATION ---
  async function bootstrap() {
    await initDB();
    await loadAllDataFromDB();
    renderStagesGrid();
    renderVarietyAndMethodChips();
    bindEvents();
    initMaps();
    initCompassListener();
    updateHeaderAndProgressUI();
    selectPlotIntoForm('CT01', { panMap: true });
    fitAllMasterPlotsOnMap();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
