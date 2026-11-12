/* ==========================================================================
   ỨNG DỤNG KHẢO SÁT LÚA THỰC ĐỊA ĐBSCL — ĐỢT 1
   Lưu Nhanh Ngoài Đồng (Có Báo Đã Lưu Rõ Ràng + Qua Điểm Mới)
   & Xuất Gói .ZIP Sau Khi Đi (Có Báo % Tiến Trình Đóng Gói 0-100% Đưa Lên Drive / Zalo)
   ========================================================================== */

(function () {
  'use strict';

  // --- CONSTANTS & CATALOGS ---
  const DB_NAME = 'KhaoSatLua_Dot1_DB_v3';
  const DB_VERSION = 1;
  const TOTAL_TARGET_PLOTS = 50;
  const CURRENT_ROUND = 1;
  const DRIVE_FOLDER_ID = '1N74C2GaXeEFN5C8oAbNU3amc0Y6fPASL';
  const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1N74C2GaXeEFN5C8oAbNU3amc0Y6fPASL?usp=sharing';
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxm1wvub6wh1WH3Mg3-dqgBsOHWOsrdcNu8fNjvha2-2vfcTZqClMVUy6e-U730KV666w/exec';

  const RICE_STAGES = [
    { code: 0, vi: 'Chưa sạ / Làm đất', en: 'Not sown / Land prep', dasRange: 'Chưa xuống giống', defaultDas: null },
    { code: 1, vi: 'Nảy mầm', en: 'Seedling', dasRange: '0–7 ngày', defaultDas: 4 },
    { code: 2, vi: 'Mạ', en: '2/3 leaves', dasRange: '8–14 ngày', defaultDas: 11 },
    { code: 3, vi: 'Đẻ nhánh', en: 'Tillering start', dasRange: '15–28 ngày', defaultDas: 22 },
    { code: 4, vi: 'Nhảy chồi', en: 'Tillering max', dasRange: '29–40 ngày', defaultDas: 35 },
    { code: 5, vi: 'Phân đòng', en: 'Stem Elongation', dasRange: '41–50 ngày', defaultDas: 45 },
    { code: 6, vi: 'Làm đòng', en: 'Booting', dasRange: '51–60 ngày', defaultDas: 55 },
    { code: 7, vi: 'Trổ cờ', en: 'Heading', dasRange: '61–67 ngày', defaultDas: 64 },
    { code: 8, vi: 'Trổ bông', en: 'Flowering', dasRange: '68–75 ngày', defaultDas: 71 },
    { code: 9, vi: 'Ngậm sữa', en: 'Milky stage', dasRange: '76–83 ngày', defaultDas: 80 },
    { code: 10, vi: 'Chín sữa', en: 'Milky-hard stage', dasRange: '84–90 ngày', defaultDas: 87 },
    { code: 11, vi: 'Đỏ đuôi', en: 'Maturing', dasRange: '91–97 ngày', defaultDas: 94 },
    { code: 12, vi: 'Chín', en: 'Maturity', dasRange: '98–110+ ngày', defaultDas: 102 },
    { code: 13, vi: 'Đã thu hoạch / Gốc rạ', en: 'Harvested / Stubble', dasRange: 'Đã gặt xong', defaultDas: null }
  ];

  const VARIETIES_DBSCL = [
    'Chưa biết', 'OM5454', 'OM18', 'Đài Thơm 8', 'OM380', 'ST25',
    'ST24', 'IR50404', 'Jasmine 85', 'DS1', 'RVT'
  ];

  const SOWING_METHODS = [
    'Chưa biết', 'Sạ hàng', 'Sạ lan', 'Sạ cụm', 'Cấy', 'Drone', 'Chưa sạ'
  ];

  const PHOTO_TYPES = {
    TongQuan: { label: 'TỔNG QUAN', titleVi: 'Ảnh Tổng Quan', suffix: 'TongQuan' },
    Can1: { label: 'CẬN 1', titleVi: 'Ảnh Cận 1', suffix: 'Can1' },
    Can2: { label: 'CẬN 2', titleVi: 'Ảnh Cận 2', suffix: 'Can2' }
  };

  // --- APPLICATION STATE ---
  function getValidGasUrl(candidate) {
    const s = (candidate || '').trim();
    if (s.startsWith('https://script.google.com/macros/s/') && s.endsWith('/exec')) {
      return s;
    }
    return DEFAULT_GAS_URL;
  }

  const state = {
    db: null,
    surveyorName: localStorage.getItem('ksl_surveyorName') || 'Nguyễn Văn Minh',
    saveRawPhotos: localStorage.getItem('ksl_saveRawPhotos') === 'true',
    themeLight: localStorage.getItem('ksl_themeLight') === 'true',
    gasWebAppUrl: getValidGasUrl(localStorage.getItem('ksl_gasWebAppUrl')),
    masterPlots: new Map(),
    surveyRecords: new Map(),
    currentPlotStt: 'CT01',
    isCurrentFormDirty: false,
    isCoordLocked: false,
    photoStampGeneration: 0,
    isUploading: false,
    currentPhotos: {
      TongQuan: null,
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
    userMiniCircle: null,
    userFullCircle: null,
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

  function getNextSttCode(currentStt) {
    const norm = normalizeStt(currentStt);
    const match = norm.match(/^([A-Z_-]+)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const nextNum = parseInt(match[2], 10) + 1;
      for (let n = nextNum; n <= Math.max(TOTAL_TARGET_PLOTS, nextNum + 1); n++) {
        const candidate = `${prefix}${String(n).padStart(2, '0')}`;
        if (!getRecord(candidate)) return candidate;
      }
      return `${prefix}${String(nextNum).padStart(2, '0')}`;
    }
    return 'CT02';
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

  function formatShortTime(isoStr) {
    const d = isoStr ? new Date(isoStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${min}:${sec}`;
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

  // --- TOAST & CUSTOM MODAL ---
  function showToast(message, type = 'success', duration = 3600) {
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
  }

  function getRecord(stt) {
    return state.surveyRecords.get(`R1_${normalizeStt(stt)}`) || null;
  }

  function getAllSavedRecords() {
    const list = Array.from(state.surveyRecords.values());
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

  // --- CLEAR VISUAL SAVE STATUS UPDATER ---
  function updateCurrentPointSaveStatusUI() {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const savedRec = getRecord(stt);
    const nextStt = getNextSttCode(stt);

    document.querySelectorAll('.lbl-current-stt').forEach(el => {
      el.textContent = stt;
    });
    const nextLbl = document.getElementById('lblNextStt');
    if (nextLbl) nextLbl.textContent = nextStt;

    const headerPointBox = document.getElementById('headerCurrentPointBox');
    if (headerPointBox) headerPointBox.textContent = `Điểm đang mở: ${stt}`;

    const headerBadge = document.getElementById('headerPointStatusBadge');
    const formPill = document.getElementById('formPointStatusPill');
    const bottomBanner = document.getElementById('saveStatusBanner');
    const saveBtn = document.getElementById('btnSaveRecordStay');

    if (savedRec && !state.isCurrentFormDirty) {
      const timeStr = formatShortTime(savedRec.savedAt);
      if (headerBadge) {
        headerBadge.textContent = `✅ ĐÃ LƯU (${timeStr})`;
        headerBadge.style.background = '#22c55e';
        headerBadge.style.color = '#052e16';
      }
      if (formPill) {
        formPill.className = 'status-pill-done';
        formPill.textContent = `✅ ĐÃ LƯU VÀO MÁY (Lúc ${timeStr} • Có thể sửa lại)`;
      }
      if (bottomBanner) {
        bottomBanner.style.background = 'rgba(34, 197, 94, 0.28)';
        bottomBanner.style.borderColor = '#4ade80';
        bottomBanner.style.color = '#bbf7d0';
        bottomBanner.innerHTML = `✅ ĐIỂM <strong>${stt}</strong> ĐÃ ĐƯỢC LƯU VÀO MÁY! (Lúc ${timeStr} • Tọa độ: ${savedRec.x}, ${savedRec.y})<br/><span style="font-size:0.84rem;color:#fef08a;">👉 Bấm nút <strong>"➕ BẤM QUA ĐIỂM MỚI (${nextStt})"</strong> để đi đo điểm tiếp theo, hoặc đi xong hết vào <strong>Mục 4</strong> để xuất file!</span>`;
      }
      if (saveBtn) {
        saveBtn.innerHTML = `✅ ĐÃ LƯU ${stt} (Bấm để lưu cập nhật nếu sửa)`;
      }
    } else if (savedRec && state.isCurrentFormDirty) {
      if (headerBadge) {
        headerBadge.textContent = '📝 ĐANG SỬA (CHƯA LƯU)';
        headerBadge.style.background = '#f59e0b';
        headerBadge.style.color = '#0f172a';
      }
      if (formPill) {
        formPill.className = 'status-pill-todo';
        formPill.textContent = `📝 ĐANG SỬA ĐIỂM ${stt} (Hãy bấm Lưu để cập nhật)`;
      }
      if (bottomBanner) {
        bottomBanner.style.background = 'rgba(245, 158, 11, 0.28)';
        bottomBanner.style.borderColor = '#facc15';
        bottomBanner.style.color = '#fef08a';
        bottomBanner.innerHTML = `📝 ĐIỂM <strong>${stt}</strong> VỪA CÓ CHỈNH SỬA MỚI — Hãy bấm <strong>"💾 LƯU CẬP NHẬT ĐIỂM ${stt}"</strong> bên dưới!`;
      }
      if (saveBtn) {
        saveBtn.innerHTML = `💾 LƯU CẬP NHẬT ĐIỂM ${stt}`;
      }
    } else {
      if (headerBadge) {
        headerBadge.textContent = '⏳ CHƯA LƯU';
        headerBadge.style.background = '#ea580c';
        headerBadge.style.color = '#ffffff';
      }
      if (formPill) {
        formPill.className = 'status-pill-todo';
        formPill.textContent = `⏳ ĐIỂM MỚI ${stt} (CHƯA LƯU)`;
      }
      if (bottomBanner) {
        bottomBanner.style.background = 'rgba(234, 88, 12, 0.25)';
        bottomBanner.style.borderColor = '#fb923c';
        bottomBanner.style.color = '#ffedd5';
        bottomBanner.innerHTML = `⏳ TRẠNG THÁI ĐIỂM <strong>${stt}</strong>: <strong>CHƯA LƯU VÀO MÁY</strong> — Sau khi lấy GPS và nhập số liệu, hãy bấm <strong>"💾 LƯU ĐIỂM ${stt} VÀO MÁY"</strong>!`;
      }
      if (saveBtn) {
        saveBtn.innerHTML = `💾 LƯU ĐIỂM ${stt} VÀO MÁY`;
      }
    }
  }

  function markFormDirty() {
    state.isCurrentFormDirty = true;
    updateCurrentPointSaveStatusUI();
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
      if (st.code === 0 || st.code === 13) {
        btn.style.borderColor = st.code === currentStage ? '#facc15' : 'rgba(250, 204, 21, 0.45)';
      }
      btn.dataset.stage = st.code;
      btn.innerHTML = `
        <span class="stage-num" style="${st.code === 0 ? 'background:#ea580c;color:#fff;' : st.code === 13 ? 'background:#0284c7;color:#fff;' : ''}">${st.code}</span>
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
        const stageNoteEl = document.getElementById('stageNoteInput');
        if (st.code === 0) {
          if (stageNoteEl) stageNoteEl.value = 'Chưa sạ - Đang làm đất';
          document.getElementById('sowingDateInput').value = '';
          setSowingSource('Chưa sạ / Chưa rõ', false);
        } else if (st.code === 13) {
          if (stageNoteEl) stageNoteEl.value = 'Đã thu hoạch - Còn gốc rạ';
          setSowingSource('Chưa sạ / Chưa rõ', false);
        } else if (stageNoteEl && (stageNoteEl.value.startsWith('Chưa sạ') || stageNoteEl.value.startsWith('Đã thu hoạch'))) {
          stageNoteEl.value = 'Đang có lúa';
        }
        syncStageStatusChips();
        updateCombinedNotePreview();
        updateDASAndStageHints();
        markFormDirty();
        reStampExistingPhotos();
      });
      grid.appendChild(btn);
    });
  }

  function syncStageStatusChips() {
    const val = (document.getElementById('stageNoteInput')?.value || '').trim();
    document.querySelectorAll('#stageStatusChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-stage-note') === val);
    });
  }

  function toggleQuickEstimatePanel(forceState) {
    const panel = document.getElementById('quickEstimatePanel');
    const btnEst = document.getElementById('btnSowSourceEstimate');
    if (!panel) return;
    const isCurrentlyOpen = panel.style.display !== 'none';
    const nextOpen = typeof forceState === 'boolean' ? forceState : !isCurrentlyOpen;
    panel.style.display = nextOpen ? 'block' : 'none';
    if (btnEst) {
      btnEst.innerHTML = nextOpen ? '👁️ Ước lượng (Thu gọn ▴)' : '👁️ Ước lượng (Nhấn mở bảng ▾)';
    }
  }

  function setSowingSource(sourceVal, markDirty = false) {
    const clean = sourceVal || 'Ước lượng';
    const inp = document.getElementById('sowingSourceInput');
    if (inp) inp.value = clean;
    document.querySelectorAll('#sowingSourceChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-sow-source') === clean);
    });
    updateCombinedNotePreview();
    updateDASAndStageHints();
    if (markDirty) {
      markFormDirty();
      reStampExistingPhotos();
    }
  }

  function estimateSowingDateByDAS(dasValue) {
    if (dasValue === 'clear') {
      document.getElementById('sowingDateInput').value = '';
      setSowingSource('Chưa sạ / Chưa rõ', true);
      toggleQuickEstimatePanel(false);
      showToast('🧹 Đã xóa ngày sạ (Chưa sạ / Đã thu hoạch)');
      return;
    }
    let days = parseInt(dasValue, 10);
    if (dasValue === 'stage') {
      const stCode = parseInt(document.getElementById('selectedStageInput').value || '3', 10);
      const stObj = RICE_STAGES.find(s => s.code === stCode);
      if (!stObj || stObj.defaultDas === null) {
        document.getElementById('sowingDateInput').value = '';
        setSowingSource('Chưa sạ / Chưa rõ', true);
        toggleQuickEstimatePanel(false);
        showToast('Giai đoạn hiện tại là Chưa sạ / Đã thu hoạch nên để trống Ngày sạ!');
        return;
      }
      days = stObj.defaultDas;
    }
    if (isNaN(days) || days < 0) return;

    const survDate = parseVNDate(document.getElementById('surveyDateTimeInput').value) || new Date();
    const estDate = new Date(survDate.getTime());
    estDate.setDate(estDate.getDate() - days);

    const dd = String(estDate.getDate()).padStart(2, '0');
    const mm = String(estDate.getMonth() + 1).padStart(2, '0');
    const yyyy = estDate.getFullYear();
    const formatted = `${dd}/${mm}/${yyyy}`;

    document.getElementById('sowingDateInput').value = formatted;
    setSowingSource('Ước lượng', true);
    toggleQuickEstimatePanel(false);
    showToast(`⚡ Đã ước lượng Ngày sạ: ${formatted} (~${days} ngày trước)`);
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
      btn.textContent = v === 'Chưa biết' ? '❓ Chưa biết' : v;
      btn.dataset.val = v;
      btn.addEventListener('click', () => {
        vInput.value = v;
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        markFormDirty();
        reStampExistingPhotos();
      });
      vContainer.appendChild(btn);
    });

    mContainer.innerHTML = '';
    SOWING_METHODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn ${mInput.value.trim() === m ? 'selected' : ''}`;
      btn.textContent = m === 'Chưa biết' ? '❓ Chưa biết' : m;
      btn.dataset.val = m;
      btn.addEventListener('click', () => {
        mInput.value = m;
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        markFormDirty();
        reStampExistingPhotos();
      });
      mContainer.appendChild(btn);
    });
  }

  function syncVarietyMethodChips() {
    const vVal = document.getElementById('varietyInput').value.trim();
    const mVal = document.getElementById('methodInput').value.trim();
    document.querySelectorAll('#varietyChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', (b.dataset.val || b.textContent) === vVal);
    });
    document.querySelectorAll('#methodChips .chip-btn').forEach(b => {
      b.classList.toggle('selected', (b.dataset.val || b.textContent) === mVal);
    });
  }

  function updateCombinedNotePreview() {
    const v = document.getElementById('varietyInput').value.trim() || 'Chưa biết';
    const m = document.getElementById('methodInput').value.trim() || 'Chưa biết';
    const stageNote = (document.getElementById('stageNoteInput')?.value || '').trim();
    const extra = document.getElementById('roundExtraNoteInput').value.trim();

    let base = `${v} - ${m}`;
    const details = [];
    if (stageNote && stageNote !== 'Đang có lúa') details.push(stageNote);
    if (extra) details.push(extra);

    const combined = details.length > 0 ? `${base} (${details.join('; ')})` : base;
    document.getElementById('finalNotePreview').value = combined;
  }

  function setWaterRegime(code, markDirty = false) {
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
    if (markDirty) {
      markFormDirty();
      reStampExistingPhotos();
    }
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
    const sowSource = (document.getElementById('sowingSourceInput')?.value || 'Ước lượng').trim();
    const banner = document.getElementById('dasHintBanner');
    const das = computeDAS(sowStr, survStr);

    if (das === null) {
      banner.innerHTML = `🌱 Ngày sạ/cấy: <strong>${sowSource}</strong> • Bấm các nút <strong>⚡ Ước lượng nhanh</strong> ở trên hoặc nhập <code>dd/mm/yyyy</code> để tự tính tuổi lúa (NSS).`;
      return;
    }
    const suggestedCode = suggestStageFromDAS(das);
    const stObj = RICE_STAGES.find(s => s.code === suggestedCode);
    banner.innerHTML = `
      ⏱️ Tuổi lúa: <strong>${das} ngày sau sạ (NSS)</strong> • Nguồn ngày sạ: <span style="color:#facc15;">${sowSource}</span>
      ${stObj ? ` • Gợi ý: <strong>GĐ ${stObj.code} - ${stObj.vi}</strong> <button type="button" id="btnApplySuggestedStage" class="btn btn-yellow btn-sm" style="padding:2px 8px;font-size:0.74rem;margin-left:6px;">Chọn GĐ ${stObj.code}</button>` : ''}
    `;
    const btnApply = document.getElementById('btnApplySuggestedStage');
    if (btnApply && stObj) {
      btnApply.addEventListener('click', () => {
        document.getElementById('selectedStageInput').value = String(stObj.code);
        renderStagesGrid();
        markFormDirty();
        reStampExistingPhotos();
      });
    }
  }

  function updateHeaderAndProgressUI() {
    document.getElementById('surveyorInput').value = state.surveyorName;
    const sCode = getSurveyorCode(state.surveyorName);
    document.getElementById('surveyorCodeBadge').textContent = sCode;

    const savedRecords = getAllSavedRecords();
    const doneCount = savedRecords.length;
    const pct = Math.min(100, Math.round((doneCount / TOTAL_TARGET_PLOTS) * 100));

    document.getElementById('progressText').textContent =
      `Tiến độ Đợt 1: Đã lưu ${doneCount} / ${TOTAL_TARGET_PLOTS} điểm vào máy`;
    document.getElementById('progressBarFill').style.width = `${pct}%`;

    const navSaved = document.getElementById('navBadgeSavedCount');
    if (navSaved) navSaved.textContent = String(doneCount);
    const listDone = document.getElementById('listDoneCount');
    if (listDone) listDone.textContent = String(doneCount);

    populatePlotQuickSelect();
    renderPlotListTab();
    updateExportPreviewUI();
    updateCurrentPointSaveStatusUI();
  }

  function populatePlotQuickSelect() {
    const sel = document.getElementById('plotSelectQuick');
    const allCodes = getAllOrderedPlotCodes();
    sel.innerHTML = '';

    allCodes.forEach(stt => {
      const rec = getRecord(stt);
      const master = state.masterPlots.get(stt);
      const statusIcon = rec ? `🟢 ĐÃ LƯU ✓ (${rec.x}, ${rec.y})` : '🟠 Chưa lưu';
      const info = rec
        ? `${rec.note || ''}`
        : (master ? `${master.variety || ''} ${master.xa ? '- ' + master.xa : ''}`.trim() : '');

      const opt = document.createElement('option');
      opt.value = stt;
      opt.textContent = `${stt} — ${statusIcon} ${info ? '• ' + info : ''}`;
      if (stt === state.currentPlotStt) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function setCoordLockState(locked) {
    state.isCoordLocked = Boolean(locked);
    const xInput = document.getElementById('coordXInput');
    const yInput = document.getElementById('coordYInput');
    const box = document.getElementById('gpsLockAndSaveBox');
    const lbl = document.getElementById('gpsLockStatusLabel');
    const btnLock = document.getElementById('btnLockCoordsHere');
    const btnUnlock = document.getElementById('btnUnlockCoordsHere');
    const stt = normalizeStt(document.getElementById('sttInput')?.value || state.currentPlotStt);

    if (xInput && yInput) {
      xInput.readOnly = state.isCoordLocked;
      yInput.readOnly = state.isCoordLocked;
      xInput.style.borderColor = state.isCoordLocked ? '#22c55e' : '';
      yInput.style.borderColor = state.isCoordLocked ? '#22c55e' : '';
    }

    if (state.isCoordLocked) {
      if (box) {
        box.style.background = 'rgba(34, 197, 94, 0.22)';
        box.style.borderColor = '#22c55e';
      }
      if (lbl) {
        lbl.style.color = '#86efac';
        lbl.innerHTML = `🔒 <strong>ĐÃ CHỐT TỌA ĐỘ ĐIỂM ${stt}</strong> (X=${xInput?.value || ''}, Y=${yInput?.value || ''}) — Đã khóa chống chạm nhầm!`;
      }
      if (btnLock) {
        btnLock.innerHTML = `✅ ĐÃ CHỐT ĐIỂM ${stt} (Bấm để lưu cập nhật)`;
        btnLock.style.background = '#22c55e';
        btnLock.style.color = '#052e16';
      }
      if (btnUnlock) {
        btnUnlock.style.display = 'inline-flex';
      }
    } else {
      if (box) {
        box.style.background = 'rgba(250, 204, 21, 0.12)';
        box.style.borderColor = '#facc15';
      }
      if (lbl) {
        lbl.style.color = '#fef08a';
        lbl.innerHTML = `🔓 Tọa độ đang mở chỉnh sửa — Chỉnh xong X, Y hãy nhấn <strong>CHỐT ĐIỂM</strong>:`;
      }
      if (btnLock) {
        btnLock.innerHTML = `📌 NHẤN CHỐT TỌA ĐỘ ĐIỂM <span class="lbl-current-stt">${stt}</span>`;
        btnLock.style.background = '';
        btnLock.style.color = '';
      }
      if (btnUnlock) {
        btnUnlock.style.display = 'none';
      }
    }
    refreshMapMarkers();
  }

  async function handleLockAndSaveCoordsAtGpsBox() {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const xInput = document.getElementById('coordXInput');
    const yInput = document.getElementById('coordYInput');
    const xVal = parseFloat(xInput.value);
    const yVal = parseFloat(yInput.value);

    if (isNaN(xVal) || isNaN(yVal)) {
      showToast(`⚠️ Điểm ${stt} chưa có tọa độ X, Y! Hãy bấm "📍 ĐỊNH VỊ GPS TẠI ĐÂY" hoặc chạm vào bản đồ vệ tinh trước.`, 'warn');
      return;
    }

    xInput.value = Number(xVal).toFixed(6);
    yInput.value = Number(yVal).toFixed(6);
    setCoordLockState(true);

    const rec = await handleSaveSurveyRecord({ silentPopup: true });
    if (rec) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`📌 Đã CHỐT khóa tọa độ (X=${rec.x}, Y=${rec.y}) & Lưu điểm ${stt} vào máy!`);
    }
  }

  function selectPlotIntoForm(sttRaw, options = {}) {
    const stt = normalizeStt(sttRaw);
    state.currentPlotStt = stt;
    state.isCurrentFormDirty = false;
    state.photoStampGeneration = (state.photoStampGeneration || 0) + 1;

    // 1. Luôn làm sạch hoàn toàn bộ nhớ ảnh và input file trước tiên để ảnh Điểm 1 không bao giờ dính sang Điểm 2
    state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };
    document.querySelectorAll('[data-photo-input]').forEach(inp => {
      inp.value = '';
    });
    toggleQuickEstimatePanel(false);

    document.getElementById('sttInput').value = stt;
    const quickSel = document.getElementById('plotSelectQuick');
    if (quickSel) quickSel.value = stt;

    const existingRec = getRecord(stt);
    const master = state.masterPlots.get(stt);

    const xInput = document.getElementById('coordXInput');
    const yInput = document.getElementById('coordYInput');

    if (existingRec) {
      xInput.value = Number(existingRec.x).toFixed(6);
      yInput.value = Number(existingRec.y).toFixed(6);
      setCoordLockState(true);

      document.getElementById('surveyDateTimeInput').value = existingRec.surveyDateTime || formatNowDateTime();
      document.getElementById('sowingDateInput').value = existingRec.sowingDate || '';
      const pickerEl = document.getElementById('sowingDatePicker');
      if (pickerEl) pickerEl.value = '';
      setSowingSource(existingRec.sowingSource || (existingRec.sowingDate ? 'Ước lượng' : 'Chưa sạ / Chưa rõ'), false);
      document.getElementById('selectedStageInput').value = String(existingRec.growthStage !== undefined ? existingRec.growthStage : 3);
      const stageNoteEl = document.getElementById('stageNoteInput');
      if (stageNoteEl) {
        stageNoteEl.value = existingRec.stageNote || (existingRec.growthStage === 0 ? 'Chưa sạ - Đang làm đất' : existingRec.growthStage === 13 ? 'Đã thu hoạch - Còn gốc rạ' : 'Đang có lúa');
      }
      setWaterRegime(existingRec.waterRegime || '1', false);
      document.getElementById('waterM1').value = existingRec.waterM1 !== undefined ? existingRec.waterM1 : '';
      document.getElementById('waterM2').value = existingRec.waterM2 !== undefined ? existingRec.waterM2 : '';
      document.getElementById('waterM3').value = existingRec.waterM3 !== undefined ? existingRec.waterM3 : '';
      document.getElementById('waterAvgOutput').value = existingRec.waterLevelAvg || '';
      document.getElementById('varietyInput').value = existingRec.variety || 'Chưa biết';
      document.getElementById('methodInput').value = existingRec.method || 'Sạ hàng';
      document.getElementById('roundExtraNoteInput').value = existingRec.extraNote || '';
      document.getElementById('finalNotePreview').value = existingRec.note || '';

      state.currentPhotos = {
        TongQuan: existingRec.photos && existingRec.photos.TongQuan ? { ...existingRec.photos.TongQuan } : null,
        Can1: existingRec.photos && existingRec.photos.Can1 ? { ...existingRec.photos.Can1 } : null,
        Can2: existingRec.photos && existingRec.photos.Can2 ? { ...existingRec.photos.Can2 } : null
      };
    } else {
      // Điểm mới chưa lưu -> Làm sạch toàn bộ phiếu (Tọa độ mở khóa, Ngày sạ trống, Nước trống, 3 Ảnh sạch 100%)
      if (master && master.x && master.y) {
        xInput.value = Number(master.x).toFixed(6);
        yInput.value = Number(master.y).toFixed(6);
      } else {
        xInput.value = '';
        yInput.value = '';
      }
      setCoordLockState(false);

      document.getElementById('surveyDateTimeInput').value = formatNowDateTime();
      const pickerEl = document.getElementById('sowingDatePicker');
      if (pickerEl) pickerEl.value = '';

      if (master && master.sowingDate) {
        document.getElementById('sowingDateInput').value = master.sowingDate;
        setSowingSource(master.sowingSource || 'Ước lượng', false);
      } else {
        document.getElementById('sowingDateInput').value = '';
        setSowingSource('Ước lượng', false);
      }

      document.getElementById('selectedStageInput').value = '3';
      const stageNoteEl = document.getElementById('stageNoteInput');
      if (stageNoteEl) stageNoteEl.value = 'Đang có lúa';

      setWaterRegime('1', false);
      document.getElementById('waterM1').value = '';
      document.getElementById('waterM2').value = '';
      document.getElementById('waterM3').value = '';
      document.getElementById('waterAvgOutput').value = '';

      document.getElementById('varietyInput').value = (master && master.variety) ? master.variety : 'Chưa biết';
      document.getElementById('methodInput').value = (master && master.method) ? master.method : 'Sạ hàng';
      document.getElementById('roundExtraNoteInput').value = '';

      state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };

      if (options.autoGetGPS) {
        requestCurrentGPS(true);
      }
    }

    renderStagesGrid();
    syncStageStatusChips();
    syncVarietyMethodChips();
    updateCombinedNotePreview();
    updateDASAndStageHints();
    updatePhotoCardsUI();
    updateCurrentPointSaveStatusUI();
    syncMapsToCurrentPlot(options.panMap !== false);
  }

  function handleGoToNewPoint() {
    const curStt = normalizeStt(document.getElementById('sttInput').value);
    const nextStt = getNextSttCode(curStt);
    const savedRec = getRecord(curStt);
    const hasPhotos = !!(state.currentPhotos.TongQuan || state.currentPhotos.Can1 || state.currentPhotos.Can2);

    if ((!savedRec && (hasPhotos || state.isCurrentFormDirty)) || (savedRec && state.isCurrentFormDirty)) {
      showModal({
        title: `⚠️ Điểm ${curStt} chưa lưu thay đổi!`,
        html: `
          <p style="margin-bottom:8px;">
            Bạn đang nhập dữ liệu cho điểm <strong>${curStt}</strong> nhưng chưa bấm Lưu.
          </p>
          <p style="color:#fde047;font-weight:700;">
            Bạn muốn <strong>Lưu điểm ${curStt} rồi qua điểm mới ${nextStt}</strong>, hay bỏ qua không lưu?
          </p>
        `,
        buttons: [
          { label: 'Ở lại', className: 'btn btn-outline btn-sm' },
          {
            label: `Bỏ qua, sang ${nextStt}`,
            className: 'btn btn-danger btn-sm',
            onClick: () => {
              selectPlotIntoForm(nextStt, { panMap: true, autoGetGPS: true });
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showToast(`Đã chuyển sang điểm mới ${nextStt}`);
            }
          },
          {
            label: `💾 Lưu ${curStt} & Qua ${nextStt}`,
            className: 'btn btn-yellow btn-sm',
            onClick: async () => {
              const rec = await handleSaveSurveyRecord({ silentPopup: true });
              if (rec) {
                selectPlotIntoForm(nextStt, { panMap: true, autoGetGPS: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showToast(`✅ Đã lưu ${curStt} và chuyển sang điểm mới ${nextStt}!`);
              }
            }
          }
        ]
      });
      return;
    }

    selectPlotIntoForm(nextStt, { panMap: true, autoGetGPS: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`👉 Đã chuyển sang điểm mới: ${nextStt}. Đang lấy GPS...`);
  }

  // --- INTERACTIVE SATELLITE MAPS ---
  function createSatelliteLayers() {
    const esriSat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    );
    const roadLabels = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, pane: 'overlayPane' }
    );
    const hybridGroup = L.layerGroup([esriSat, roadLabels]);
    const osmStreet = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap' }
    );
    return { hybridGroup, osmStreet };
  }

  function initMaps() {
    const defaultLat = 10.450000;
    const defaultLon = 105.650000;

    const layers1 = createSatelliteLayers();
    state.miniMap = L.map('miniMap', {
      center: [defaultLat, defaultLon],
      zoom: 15,
      layers: [layers1.hybridGroup],
      zoomControl: true
    });
    L.control.layers(
      { '🛰️ Vệ tinh + Nhãn địa danh': layers1.hybridGroup, '🗺️ Bản đồ đường phố': layers1.osmStreet },
      null,
      { position: 'topright' }
    ).addTo(state.miniMap);

    state.miniMarkersLayer = L.layerGroup().addTo(state.miniMap);
    state.miniMap.on('click', (e) => {
      if (state.isCoordLocked) {
        showToast('🔒 Tọa độ điểm này đã CHỐT khóa! Bấm "🔓 Mở khóa sửa lại X, Y" nếu muốn dời vị trí.', 'warn');
        return;
      }
      setFormCoordinates(e.latlng.lng, e.latlng.lat, true);
    });

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
      if (state.isCoordLocked) {
        showToast('🔒 Tọa độ điểm này đã CHỐT khóa! Bấm "🔓 Mở khóa sửa lại X, Y" nếu muốn dời vị trí.', 'warn');
        return;
      }
      setFormCoordinates(e.latlng.lng, e.latlng.lat, true);
    });

    refreshMapMarkers();
  }

  function setFormCoordinates(lon, lat, fromUserAction = false) {
    const xStr = Number(lon).toFixed(6);
    const yStr = Number(lat).toFixed(6);
    document.getElementById('coordXInput').value = xStr;
    document.getElementById('coordYInput').value = yStr;
    if (fromUserAction) {
      markFormDirty();
      showToast(`📍 Đã đặt tọa độ điểm ${state.currentPlotStt}: X=${xStr}, Y=${yStr}`);
    }
    reStampExistingPhotos();
    refreshMapMarkers();
  }

  function refreshMapMarkers() {
    if (!state.miniMap || !state.fullMap) return;
    state.miniMarkersLayer.clearLayers();
    state.fullMarkersLayer.clearLayers();

    const allCodes = getAllOrderedPlotCodes();
    const curX = parseFloat(document.getElementById('coordXInput').value);
    const curY = parseFloat(document.getElementById('coordYInput').value);

    let countDone = 0;

    allCodes.forEach(stt => {
      const rec = getRecord(stt);
      const master = state.masterPlots.get(stt);
      const isSelected = (stt === state.currentPlotStt);

      const lon = isSelected && !isNaN(curX) ? curX : (rec ? parseFloat(rec.x) : (master ? parseFloat(master.x) : NaN));
      const lat = isSelected && !isNaN(curY) ? curY : (rec ? parseFloat(rec.y) : (master ? parseFloat(master.y) : NaN));
      if (isNaN(lon) || isNaN(lat)) return;

      if (rec) countDone++;

      const shortNum = stt.replace(/^CT/, '');
      const pinClass = isSelected
        ? 'plot-pin plot-pin-selected'
        : rec
          ? 'plot-pin plot-pin-done'
          : 'plot-pin plot-pin-todo';
      const pinLabel = rec ? `${shortNum}✓` : shortNum;

      const icon = L.divIcon({
        className: '',
        html: `<div class="${pinClass}" style="width:36px;height:36px;">${pinLabel}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -16]
      });

      const popupHTML = `
        <div style="min-width:210px;color:#0f172a;font-family:sans-serif;">
          <div style="font-weight:900;font-size:1rem;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
            <span>🌾 Điểm ${stt}</span>
            <span style="padding:2px 7px;border-radius:99px;font-size:0.74rem;color:#fff;background:${rec ? '#15803d' : '#ea580c'};">
              ${rec ? 'Đã lưu ✓' : 'Chưa lưu'}
            </span>
          </div>
          <div style="font-size:0.8rem;line-height:1.4;margin-bottom:8px;">
            <div><strong>X (Lon):</strong> ${lon.toFixed(6)} | <strong>Y (Lat):</strong> ${lat.toFixed(6)}</div>
            ${rec ? `<div><strong>Ghi chú:</strong> ${rec.note || ''}</div>` : ''}
            ${rec ? `<div><strong>Ngày giờ:</strong> ${rec.surveyDateTime || ''}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button type="button" onclick="window.__kslStartPlot('${stt}')" style="background:#16a34a;color:#fff;border:none;padding:8px 10px;border-radius:8px;font-weight:800;cursor:pointer;width:100%;">
              ✏️ Mở / Chỉnh sửa điểm ${stt}
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=two-wheeler" target="_blank" rel="noopener" style="background:#0284c7;color:#fff;text-decoration:none;text-align:center;padding:7px 10px;border-radius:8px;font-weight:800;font-size:0.82rem;">
              🛵 Chỉ đường Google Maps
            </a>
          </div>
        </div>
      `;

      const canDrag = isSelected && !state.isCoordLocked;

      const fMarker = L.marker([lat, lon], { icon, draggable: canDrag }).bindPopup(popupHTML);
      fMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setFormCoordinates(pos.lng, pos.lat, true);
      });
      state.fullMarkersLayer.addLayer(fMarker);

      const mMarker = L.marker([lat, lon], { icon, draggable: canDrag }).bindPopup(popupHTML);
      mMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        setFormCoordinates(pos.lng, pos.lat, true);
      });
      state.miniMarkersLayer.addLayer(mMarker);
    });

    const doneEl = document.getElementById('mapCountDone');
    if (doneEl) doneEl.textContent = String(countDone);
  }

  window.__kslStartPlot = function (stt) {
    selectPlotIntoForm(stt, { panMap: true });
    switchTab('tab-survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Đang mở điểm ${stt}`);
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

  function fitAllSavedPlotsOnMap() {
    if (!state.fullMap) return;
    const latlngs = [];
    state.surveyRecords.forEach(r => {
      if (!isNaN(parseFloat(r.y)) && !isNaN(parseFloat(r.x))) {
        latlngs.push([parseFloat(r.y), parseFloat(r.x)]);
      }
    });
    state.masterPlots.forEach(m => {
      if (!isNaN(parseFloat(m.y)) && !isNaN(parseFloat(m.x))) {
        latlngs.push([parseFloat(m.y), parseFloat(m.x)]);
      }
    });
    if (latlngs.length > 0) {
      state.fullMap.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28], maxZoom: 17 });
    }
  }

  // --- GPS HIGH ACCURACY ---
  function requestCurrentGPS(setIntoForm = true) {
    const statusEl = document.getElementById('gpsStatusText');
    if (!navigator.geolocation) {
      statusEl.textContent = '⚠️ Trình duyệt không hỗ trợ GPS';
      showToast('Thiết bị không hỗ trợ định vị GPS', 'error');
      return;
    }

    statusEl.textContent = '🛰️ Đang thu tín hiệu vệ tinh GPS thực địa...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const acc = Math.round(pos.coords.accuracy || 10);

        state.userGPS.x = lon;
        state.userGPS.y = lat;
        state.userGPS.accuracy = acc;
        state.userGPS.updatedAt = new Date();

        statusEl.innerHTML = `✅ Đã lấy GPS: <strong>X=${lon.toFixed(6)}, Y=${lat.toFixed(6)}</strong> (Sai số <strong>±${acc}m</strong>)`;

        if (state.miniMap) {
          if (state.userMiniCircle) state.miniMap.removeLayer(state.userMiniCircle);
          state.userMiniCircle = L.circle([lat, lon], {
            radius: acc, color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.22, weight: 2
          }).addTo(state.miniMap);
        }
        if (state.fullMap) {
          if (state.userFullCircle) state.fullMap.removeLayer(state.userFullCircle);
          state.userFullCircle = L.circle([lat, lon], {
            radius: acc, color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.22, weight: 2
          }).addTo(state.fullMap);
        }

        if (setIntoForm) {
          setFormCoordinates(lon, lat, true);
          if (state.miniMap) state.miniMap.setView([lat, lon], 18);
        }
      },
      (err) => {
        statusEl.textContent = `⚠️ Không lấy được GPS tự động (${err.message}). Hãy chạm trực tiếp vào ruộng trên bản đồ vệ tinh bên dưới để lấy tọa độ!`;
        showToast('Hãy bật Vị trí (Location) trên điện thoại hoặc chạm trực tiếp vào bản đồ vệ tinh!', 'warn');
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
        if (el) el.textContent = `🧭 Hướng la bàn: ${heading}° (${dirName})`;
      }
    });
  }

  // --- HTML5 CANVAS 3-PHOTO STAMPING ("HÌNH CÓ CODE") ---
  function getPhotoFileName(typeKey) {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const sCode = getSurveyorCode(state.surveyorName);
    const suffix = PHOTO_TYPES[typeKey].suffix;
    return `Dot1_${stt}_${sCode}_${suffix}.jpg`;
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

        ctx.drawImage(img, 0, 0, w, h);

        const stt = normalizeStt(document.getElementById('sttInput').value);
        const typeLabel = PHOTO_TYPES[typeKey].label;
        const sName = (state.surveyorName || 'Chưa nhập').trim();
        const xVal = (document.getElementById('coordXInput').value || 'Chưa có').trim();
        const yVal = (document.getElementById('coordYInput').value || 'Chưa có').trim();
        const dtVal = (document.getElementById('surveyDateTimeInput').value || formatNowDateTime()).trim();
        const stageCode = document.getElementById('selectedStageInput').value || '3';
        const stObj = RICE_STAGES.find(s => String(s.code) === String(stageCode));
        const waterCode = document.getElementById('selectedWaterInput').value || '1';
        const waterAvg = document.getElementById('waterAvgOutput').value;
        const noteVal = document.getElementById('finalNotePreview').value || '';

        const scale = Math.max(0.75, w / 1000);
        const pad = Math.round(16 * scale);

        const topText = `ĐỢT 1 • ${stt} • ${typeLabel}`;
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
    const myGen = state.photoStampGeneration;
    const myStt = state.currentPlotStt;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (state.photoStampGeneration !== myGen || state.currentPlotStt !== myStt) return;
        const rawDataUrl = e.target.result;
        const stamped = await stampImageWithCode(rawDataUrl, typeKey);
        if (state.photoStampGeneration !== myGen || state.currentPlotStt !== myStt) return;
        state.currentPhotos[typeKey] = stamped;
        markFormDirty();
        updatePhotoCardsUI();
        showToast(`📸 Đã đóng dấu mã Code lên ${PHOTO_TYPES[typeKey].titleVi} (${stamped.sizeKB} KB)`);
      } catch (err) {
        showToast('Lỗi xử lý ảnh: ' + err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  }

  async function reStampExistingPhotos() {
    const myGen = state.photoStampGeneration;
    const myStt = state.currentPlotStt;
    for (const typeKey of Object.keys(PHOTO_TYPES)) {
      const existing = state.currentPhotos[typeKey];
      if (existing && existing.rawDataUrl) {
        const updated = await stampImageWithCode(existing.rawDataUrl, typeKey);
        if (state.photoStampGeneration !== myGen || state.currentPlotStt !== myStt || state.currentPhotos[typeKey] !== existing) {
          return;
        }
        state.currentPhotos[typeKey] = updated;
      }
    }
    if (state.photoStampGeneration === myGen && state.currentPlotStt === myStt) {
      updatePhotoCardsUI();
    }
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

  async function generateDemoPhotosForCurrentPlot() {
    const stt = normalizeStt(document.getElementById('sttInput').value);
    const stageCode = parseInt(document.getElementById('selectedStageInput').value || '3', 10);

    for (const typeKey of ['TongQuan', 'Can1', 'Can2']) {
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = 960;
      const ctx = c.getContext('2d');

      if (typeKey === 'TongQuan') {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, 340);
        skyGrad.addColorStop(0, '#0284c7');
        skyGrad.addColorStop(1, '#bae6fd');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, 1280, 340);

        const fieldGrad = ctx.createLinearGradient(0, 340, 0, 960);
        fieldGrad.addColorStop(0, stageCode >= 10 ? '#ca8a04' : '#15803d');
        fieldGrad.addColorStop(1, stageCode >= 10 ? '#eab308' : '#22c55e');
        ctx.fillStyle = fieldGrad;
        ctx.fillRect(0, 340, 1280, 620);

        ctx.strokeStyle = stageCode >= 10 ? '#fef08a' : '#86efac';
        ctx.lineWidth = 3;
        for (let i = -600; i <= 1880; i += 65) {
          ctx.beginPath();
          ctx.moveTo(640 + (i - 640) * 0.15, 340);
          ctx.lineTo(i, 960);
          ctx.stroke();
        }
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
        bgGrad.addColorStop(0, '#064e3b');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1280, 960);

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

      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`ẢNH THỰC ĐỊA MẪU • ${stt} (${PHOTO_TYPES[typeKey].label})`, 300, 480);

      const rawDataUrl = c.toDataURL('image/jpeg', 0.85);
      state.currentPhotos[typeKey] = await stampImageWithCode(rawDataUrl, typeKey);
    }
    markFormDirty();
    updatePhotoCardsUI();
    showToast(`Đã tạo 3 ảnh mẫu có Code cho điểm ${stt}!`);
  }

  // --- SAVE RECORD TO LOCAL INDEXEDDB ---
  async function handleSaveSurveyRecord(options = {}) {
    const sName = document.getElementById('surveyorInput').value.trim();
    if (!sName) {
      showModal({
        title: '⚠️ Chưa nhập Tên người khảo sát',
        html: '<p>Vui lòng nhập <strong>Tên người khảo sát</strong> ở thanh đầu trang trước khi lưu điểm!</p>',
        buttons: [{
          label: 'Nhập ngay',
          className: 'btn btn-yellow btn-sm',
          onClick: () => document.getElementById('surveyorInput').focus()
        }]
      });
      return null;
    }
    state.surveyorName = sName;
    localStorage.setItem('ksl_surveyorName', sName);

    const stt = normalizeStt(document.getElementById('sttInput').value);
    state.currentPlotStt = stt;
    document.getElementById('sttInput').value = stt;

    const xVal = parseFloat(document.getElementById('coordXInput').value);
    const yVal = parseFloat(document.getElementById('coordYInput').value);

    if (isNaN(xVal) || isNaN(yVal)) {
      showModal({
        title: `⚠️ Chưa có tọa độ GPS cho điểm ${stt}`,
        html: `<p>Vui lòng bấm nút <strong>"📍 ĐỊNH VỊ GPS TẠI ĐÂY"</strong> hoặc <strong>chạm vào thửa ruộng trên bản đồ vệ tinh</strong> để lấy tọa độ X, Y trước khi lưu!</p>`,
        buttons: [
          { label: 'Đóng', className: 'btn btn-outline btn-sm' },
          {
            label: '📍 Lấy GPS ngay',
            className: 'btn btn-yellow btn-sm',
            onClick: () => requestCurrentGPS(true)
          }
        ]
      });
      return null;
    }

    await reStampExistingPhotos();

    const waterRegime = document.getElementById('selectedWaterInput').value || '1';
    const waterAvg = waterRegime === '1' ? recalcWaterAverage() : '';
    const sowingDate = document.getElementById('sowingDateInput').value.trim();
    const sowingSource = (document.getElementById('sowingSourceInput')?.value || (sowingDate ? 'Ước lượng' : 'Chưa sạ / Chưa rõ')).trim();
    const growthStageNum = parseInt(document.getElementById('selectedStageInput').value || '3', 10);
    const stageNote = (document.getElementById('stageNoteInput')?.value || (growthStageNum === 0 ? 'Chưa sạ - Đang làm đất' : growthStageNum === 13 ? 'Đã thu hoạch - Còn gốc rạ' : 'Đang có lúa')).trim();
    const variety = document.getElementById('varietyInput').value.trim() || 'Chưa biết';
    const method = document.getElementById('methodInput').value.trim() || 'Chưa biết';
    const extraNote = document.getElementById('roundExtraNoteInput').value.trim();
    updateCombinedNotePreview();
    const finalNote = document.getElementById('finalNotePreview').value.trim();

    const nowIso = new Date().toISOString();
    const record = {
      id: `R1_${stt}`,
      round: CURRENT_ROUND,
      surveyorName: sName,
      surveyorCode: getSurveyorCode(sName),
      stt,
      x: Number(xVal).toFixed(6),
      y: Number(yVal).toFixed(6),
      surveyDateTime: document.getElementById('surveyDateTimeInput').value.trim() || formatNowDateTime(),
      growthStage: growthStageNum,
      stageNote,
      waterRegime,
      waterM1: waterRegime === '1' ? document.getElementById('waterM1').value : '',
      waterM2: waterRegime === '1' ? document.getElementById('waterM2').value : '',
      waterM3: waterRegime === '1' ? document.getElementById('waterM3').value : '',
      waterLevelAvg: waterAvg,
      sowingDate,
      sowingSource,
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
        heading: state.userGPS.heading
      },
      savedAt: nowIso
    };

    await dbPut('survey_records', record);
    state.surveyRecords.set(record.id, record);

    const updatedMaster = {
      ...(state.masterPlots.get(stt) || {}),
      stt,
      x: Number(xVal),
      y: Number(yVal),
      sowingDate,
      sowingSource,
      stageNote,
      variety,
      method,
      baseNote: finalNote,
      updatedAt: nowIso
    };
    await dbPut('master_plots', updatedMaster);
    state.masterPlots.set(stt, updatedMaster);

    state.isCurrentFormDirty = false;
    const savedTimeStr = formatShortTime(nowIso);
    const lastBadge = document.getElementById('lastSavedTimeBadge');
    if (lastBadge) {
      lastBadge.textContent = `Vừa lưu: ${stt} lúc ${savedTimeStr}`;
    }

    updateHeaderAndProgressUI();
    refreshMapMarkers();

    const nextStt = getNextSttCode(stt);
    const photoCount = ['TongQuan', 'Can1', 'Can2'].filter(k => record.photos[k] && record.photos[k].stampedDataUrl).length;
    const stObj = RICE_STAGES.find(s => s.code === record.growthStage);

    if (!options.silentPopup) {
      showModal({
        title: `✅ ĐÃ LƯU THÀNH CÔNG ĐIỂM ${stt} VÀO MÁY!`,
        html: `
          <div style="background:rgba(34,197,94,0.15);border:1.5px solid #4ade80;border-radius:10px;padding:12px;margin-bottom:12px;line-height:1.55;">
            <div>📍 <strong>Mã điểm ruộng:</strong> <span style="color:#facc15;font-weight:900;">${stt}</span> (Lưu lúc ${savedTimeStr})</div>
            <div>🛰️ <strong>Tọa độ đã chốt:</strong> X = <code>${record.x}</code>, Y = <code>${record.y}</code></div>
            <div>🌾 <strong>Giai đoạn lúa:</strong> Mã ${record.growthStage} (${stObj ? stObj.vi : ''}) • <em>${record.stageNote}</em></div>
            <div>🌱 <strong>Ngày sạ/cấy:</strong> ${record.sowingDate || 'Trống'} (<span style="color:#fde047;">${record.sowingSource}</span>)</div>
            <div>🌾 <strong>Giống &amp; PP:</strong> ${record.variety} - ${record.method}</div>
            <div>💧 <strong>Chế độ nước:</strong> Mã ${record.waterRegime}${record.waterLevelAvg ? ` (TB: ${record.waterLevelAvg} cm)` : ''}</div>
            <div>📸 <strong>Ảnh có Code đã lưu:</strong> ${photoCount} / 3 ảnh</div>
            <div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.2);color:#86efac;font-weight:800;">
              📊 Tổng số điểm Đợt 1 đã lưu trong máy: ${state.surveyRecords.size} điểm
            </div>
          </div>
          <p style="font-size:0.9rem;color:#fef08a;font-weight:700;">
            Bấm <strong>"➕ BẤM QUA ĐIỂM MỚI (${nextStt})"</strong> để đi đo điểm tiếp theo, hoặc khi đi xong hết hãy vào <strong>Mục 4 (Xuất Sau Khi Đi)</strong> để nộp dữ liệu!
          </p>
        `,
        buttons: [
          {
            label: `✏️ Ở lại ${stt}`,
            className: 'btn btn-outline btn-sm'
          },
          {
            label: `📦 Đi xong → Tới Mục 4 Xuất File`,
            className: 'btn btn-primary btn-sm',
            onClick: () => switchTab('tab-export')
          },
          {
            label: `➕ BẤM QUA ĐIỂM MỚI (${nextStt}) ➡️`,
            className: 'btn btn-yellow btn-sm',
            onClick: () => {
              selectPlotIntoForm(nextStt, { panMap: true, autoGetGPS: true });
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showToast(`👉 Đã chuyển sang điểm mới: ${nextStt}`);
            }
          }
        ]
      });
    }

    return record;
  }

  // --- DIRECT GOOGLE DRIVE UPLOAD & ZIP EXPORT WITH 0% -> 100% PROGRESS ---
  function getGasCodeTemplate() {
    return [
      `// MÃ GOOGLE APPS SCRIPT ĐẨY THẲNG FILE VÀO THƯ MỤC KS-LUA-3-TINH (${DRIVE_FOLDER_ID})`,
      `function doPost(e) {`,
      `  try {`,
      `    var data = JSON.parse(e.postData.contents);`,
      `    var folder = DriveApp.getFolderById('${DRIVE_FOLDER_ID}');`,
      `    var out = {};`,
      `    if (data.zipBase64 && data.zipName) {`,
      `      var zBlob = Utilities.newBlob(Utilities.base64Decode(data.zipBase64), 'application/zip', data.zipName);`,
      `      var zFile = folder.createFile(zBlob);`,
      `      out.zipUrl = zFile.getUrl();`,
      `      out.zipId = zFile.getId();`,
      `    }`,
      `    if (data.xlsxBase64 && data.xlsxName) {`,
      `      var xBlob = Utilities.newBlob(Utilities.base64Decode(data.xlsxBase64), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data.xlsxName);`,
      `      var xFile = folder.createFile(xBlob);`,
      `      out.xlsxUrl = xFile.getUrl();`,
      `    }`,
      `    return ContentService.createTextOutput(JSON.stringify({ ok: true, result: out })).setMimeType(ContentService.MimeType.JSON);`,
      `  } catch (err) {`,
      `    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);`,
      `  }`,
      `}`
    ].join('\n');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || '');
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function uploadMultipartToDriveAPI(accessToken, fileBlob, fileName, mimeType, onUploadProgress) {
    return new Promise((resolve, reject) => {
      const metadata = {
        name: fileName,
        parents: [DRIVE_FOLDER_ID]
      };
      const boundary = '-------kslDriveUploadBoundary' + Date.now();
      const metaPart =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`;
      const closePart = `\r\n--${boundary}--`;

      const bodyBlob = new Blob([metaPart, fileBlob, closePart], {
        type: `multipart/related; boundary=${boundary}`
      });

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
        true
      );
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onUploadProgress === 'function') {
          onUploadProgress((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            resolve({ id: 'ok', name: fileName });
          }
        } else {
          reject(new Error(`Google Drive API HTTP ${xhr.status}: ${xhr.responseText.slice(0, 180)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Lỗi kết nối mạng khi tải lên Google Drive API'));
      xhr.send(bodyBlob);
    });
  }

  async function postPayloadToAppsScript(gasUrl, payloadObj, onUploadProgress) {
    const jsonStr = JSON.stringify(payloadObj);
    if (typeof onUploadProgress === 'function') onUploadProgress(35);

    try {
      if (typeof onUploadProgress === 'function') onUploadProgress(65);
      const resp = await fetch(gasUrl, {
        method: 'POST',
        body: jsonStr,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      if (typeof onUploadProgress === 'function') onUploadProgress(95);

      if (resp.ok) {
        try {
          const parsed = await resp.json();
          if (parsed && parsed.ok === false) {
            throw new Error(parsed.error || 'Apps Script báo lỗi');
          }
          return parsed;
        } catch (_) {
          return { ok: true };
        }
      }
      throw new Error(`HTTP ${resp.status}`);
    } catch (err) {
      // Fallback: in case browser CORS blocks reading redirected response body, send with mode: 'no-cors'
      if (typeof onUploadProgress === 'function') onUploadProgress(80);
      try {
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: jsonStr,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        if (typeof onUploadProgress === 'function') onUploadProgress(100);
        return { ok: true, fallbackNoCors: true };
      } catch (err2) {
        throw new Error('Lỗi gửi dữ liệu: ' + (err.message || err2.message));
      }
    }
  }

  async function pushPackageDirectlyToGoogleDrive() {
    const records = getAllSavedRecords();
    if (records.length === 0) {
      showToast('Chưa có điểm khảo sát nào được lưu! Hãy lưu ít nhất 1 điểm ở Tab 1.', 'warn');
      return;
    }
    if (state.isUploading) return;

    const bridgeInputEl = document.getElementById('gasWebAppUrlInput');
    if (bridgeInputEl && bridgeInputEl.value.trim()) {
      state.gasWebAppUrl = getValidGasUrl(bridgeInputEl.value.trim());
    } else {
      state.gasWebAppUrl = getValidGasUrl(state.gasWebAppUrl);
    }
    localStorage.setItem('ksl_gasWebAppUrl', state.gasWebAppUrl);
    if (bridgeInputEl) bridgeInputEl.value = state.gasWebAppUrl;

    const targetGasUrl = state.gasWebAppUrl || DEFAULT_GAS_URL;

    let photoCount = 0;
    records.forEach(r => {
      if (r.photos) {
        ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
          if (r.photos[tk] && r.photos[tk].stampedDataUrl) photoCount++;
        });
      }
    });

    state.isUploading = true;
    const steps = [
      { text: `Bước 1/3: Đóng gói Excel & nén ${photoCount} ảnh có Code vào 1 gói .ZIP (${records.length} điểm)`, status: 'running' },
      { text: `Bước 2/3: Nộp gói dữ liệu về kho chung (bảo mật)`, status: 'pending' },
      { text: `Bước 3/3: Nhận biên nhận xác nhận từ máy chủ`, status: 'pending' }
    ];
    renderProgressStepUI(`⏳ ĐANG ĐÓNG GÓI & NỘP DỮ LIỆU...`, 5, steps);

    try {
      const prefix = getBaseExportPrefix(records);
      const xlsxBuf = generateExcelWorkbookBuffer(records);
      const xlsxBlob = new Blob([xlsxBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const xlsxName = `${prefix}.xlsx`;

      const { blob: zipBlob, fileName: zipName } = await buildZipPackageBlob(records, (pct) => {
        const mapped = 5 + Math.round(pct * 0.35);
        renderProgressStepUI(`🔄 ĐANG NÉN GÓI .ZIP (${Math.round(pct)}%)...`, mapped, steps);
      });

      steps[0].status = 'done';
      steps[1].status = 'running';
      renderProgressStepUI(`🚀 ĐANG NỘP DỮ LIỆU (45%)...`, 45, steps);

      const zipBase64 = await blobToBase64(zipBlob);
      const xlsxBase64 = await blobToBase64(xlsxBlob);
      const res = await postPayloadToAppsScript(
        targetGasUrl,
        { zipName, zipBase64, xlsxName, xlsxBase64, surveyor: state.surveyorName, totalPlots: records.length },
        (upPct) => {
          const mapped = 45 + Math.round(upPct * 0.5);
          renderProgressStepUI(`☁️ ĐANG NỘP DỮ LIỆU (${Math.round(upPct)}%)...`, mapped, steps);
        }
      );

      // Chỉ dùng phản hồi để XÁC NHẬN đã nhận file — tuyệt đối không hiển thị / lưu đường dẫn tải về
      const serverConfirmed = !!(res && res.result && (res.result.zipId || res.result.zipUrl));
      const sizeKB = Math.round(zipBlob.size / 1024);

      steps[1].status = 'done';
      steps[2].status = serverConfirmed ? 'done' : 'error';
      steps[2].text = serverConfirmed
        ? 'Bước 3/3: Máy chủ đã xác nhận nhận đủ gói dữ liệu'
        : 'Bước 3/3: Đã gửi đi nhưng máy chủ chưa trả biên nhận (mạng chặn phản hồi)';
      const doneTime = formatShortTime(new Date().toISOString());
      renderProgressStepUI(
        serverConfirmed ? `🎉 ĐÃ NỘP XONG 100% (LÚC ${doneTime})!` : `📨 ĐÃ GỬI ĐI (LÚC ${doneTime}) — CHƯA CÓ BIÊN NHẬN`,
        100,
        steps
      );
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

      const receipt = addSubmitReceipt({
        channel: 'server',
        confirmed: serverConfirmed,
        fileName: zipName,
        points: records.length,
        photos: photoCount,
        sizeKB,
        stts: records.map(r => r.stt)
      });

      showReceiptModal(receipt);
    } catch (err) {
      steps.forEach(s => { if (s.status === 'running') s.status = 'error'; });
      renderProgressStepUI(`⚠️ LỖI KHI NỘP: ${err.message}`, 60, steps);
      showToast('Lỗi khi nộp dữ liệu: ' + err.message, 'error');
    } finally {
      state.isUploading = false;
    }
  }

  // --- BIÊN NHẬN NỘP / GỬI (CHỈ XEM — KHÔNG LINK, KHÔNG TẢI LẠI) ---
  function getSubmitReceipts() {
    try {
      const arr = JSON.parse(localStorage.getItem('ksl_submitReceipts') || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function addSubmitReceipt(info) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const code = `BN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const receipt = {
      code,
      time: formatNowDateTime(),
      surveyor: state.surveyorName,
      ...info
    };
    const list = getSubmitReceipts();
    list.unshift(receipt);
    localStorage.setItem('ksl_submitReceipts', JSON.stringify(list.slice(0, 30)));
    renderSubmitReceiptList();
    return receipt;
  }

  function describeReceiptStatus(r) {
    if (r.channel === 'server') {
      return r.confirmed
        ? { icon: '✅', label: 'ĐÃ NỘP — Máy chủ xác nhận', color: '#4ade80' }
        : { icon: '📨', label: 'ĐÃ GỬI — Chưa có biên nhận máy chủ', color: '#fde047' };
    }
    if (r.channel === 'zalo') {
      return { icon: '💬', label: 'ĐÃ CHUYỂN SANG ZALO (1 file .ZIP)', color: '#7dd3fc' };
    }
    return { icon: '💾', label: 'ĐÃ LƯU GÓI .ZIP VÀO MÁY', color: '#cbd5e1' };
  }

  function receiptDetailHTML(r) {
    const st = describeReceiptStatus(r);
    return `
      <div style="background:rgba(34,197,94,0.12);border:2px solid ${st.color};border-radius:12px;padding:12px;line-height:1.6;">
        <div style="font-size:1rem;font-weight:900;color:${st.color};margin-bottom:6px;">${st.icon} ${st.label}</div>
        <div>🧾 <strong>Mã biên nhận:</strong> <code style="color:#facc15;">${r.code}</code></div>
        <div>🕒 <strong>Thời gian:</strong> ${r.time}</div>
        <div>👤 <strong>Người khảo sát:</strong> ${r.surveyor || ''}</div>
        <div>📦 <strong>Gói dữ liệu:</strong> <code>${r.fileName}</code> (~${r.sizeKB || 0} KB)</div>
        <div>🌾 <strong>Số điểm:</strong> ${r.points} điểm • 📸 <strong>Ảnh có Code:</strong> ${r.photos} ảnh</div>
        ${r.stts && r.stts.length ? `<div style="word-break:break-word;">📍 <strong>Mã điểm:</strong> ${r.stts.join(', ')}</div>` : ''}
      </div>
      <p style="margin-top:10px;font-size:0.8rem;color:#94a3b8;">
        🔒 Biên nhận chỉ để xem xác nhận. Vì bảo mật, máy không hiển thị đường dẫn kho dữ liệu và không tải lại được gói đã nộp.
      </p>
    `;
  }

  function showReceiptModal(r) {
    const st = describeReceiptStatus(r);
    showModal({
      title: `${st.icon} BIÊN NHẬN ${r.code}`,
      html: receiptDetailHTML(r),
      buttons: [{ label: 'Đã xem xác nhận', className: 'btn btn-yellow btn-sm' }]
    });
  }

  function renderSubmitReceiptList() {
    const box = document.getElementById('submitReceiptList');
    if (!box) return;
    const list = getSubmitReceipts();
    if (list.length === 0) {
      box.innerHTML = `<div style="color:var(--text-secondary);">Chưa có lần nộp / gửi nào. Sau khi nộp, biên nhận sẽ hiện ở đây.</div>`;
      return;
    }
    box.innerHTML = list.map((r, idx) => {
      const st = describeReceiptStatus(r);
      return `
        <button type="button" data-receipt-idx="${idx}" style="display:block;width:100%;text-align:left;background:var(--bg-input);border:1.5px solid ${st.color};border-radius:10px;padding:8px 10px;margin-bottom:6px;color:var(--text-primary);cursor:pointer;">
          <div style="font-weight:900;color:${st.color};">${st.icon} ${st.label}</div>
          <div style="font-size:0.8rem;">🧾 ${r.code} • 🕒 ${r.time}</div>
          <div style="font-size:0.8rem;">🌾 ${r.points} điểm • 📸 ${r.photos} ảnh • ~${r.sizeKB || 0} KB</div>
        </button>
      `;
    }).join('');
    box.querySelectorAll('[data-receipt-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = getSubmitReceipts()[Number(btn.getAttribute('data-receipt-idx'))];
        if (r) showReceiptModal(r);
      });
    });
  }

  // --- EXPORT WITH REAL-TIME 0% -> 100% PACKAGING PROGRESS AFTER THE FIELD TRIP ---
  function renderProgressStepUI(titleText, percent, steps) {
    const box = document.getElementById('tabExportUploadProgressBox');
    const titleEl = document.getElementById('tabExportUploadTitle');
    const pctEl = document.getElementById('tabExportUploadPercent');
    const barEl = document.getElementById('tabExportUploadBar');
    const listEl = document.getElementById('tabExportUploadStepList');

    if (!box) return;
    box.style.display = 'block';
    box.style.borderColor = percent >= 100 ? '#22c55e' : '#facc15';
    box.style.background = percent >= 100 ? 'rgba(21, 128, 61, 0.25)' : '#06140c';

    if (titleEl) {
      titleEl.textContent = titleText;
      titleEl.style.color = percent >= 100 ? '#4ade80' : '#fde047';
    }
    if (pctEl) {
      pctEl.textContent = `${Math.round(percent)}%`;
      pctEl.style.background = percent >= 100 ? '#22c55e' : '#facc15';
      pctEl.style.color = '#052e16';
    }
    if (barEl) {
      barEl.style.width = `${Math.min(100, Math.round(percent))}%`;
    }
    if (listEl) {
      listEl.innerHTML = steps.map(s => {
        const icon = s.status === 'done' ? '✅' : s.status === 'running' ? '🔄' : s.status === 'error' ? '❌' : '⏳';
        const color = s.status === 'done' ? '#86efac' : s.status === 'running' ? '#fde047' : s.status === 'error' ? '#fca5a5' : '#94a3b8';
        return `<div style="color:${color};font-weight:${s.status === 'running' || s.status === 'done' ? '800' : '600'};">${icon} ${s.text}</div>`;
      }).join('');
    }
  }

  async function exportAllAfterTripWithProgress(shareMode = 'download_for_drive') {
    const records = getAllSavedRecords();
    if (records.length === 0) {
      showToast('Chưa có điểm khảo sát nào được lưu! Hãy lưu ít nhất 1 điểm ở Tab 1.', 'warn');
      return;
    }
    if (state.isUploading) return;
    state.isUploading = true;

    let photoCount = 0;
    records.forEach(r => {
      if (r.photos) {
        ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
          if (r.photos[tk] && r.photos[tk].stampedDataUrl) photoCount++;
        });
      }
    });

    const steps = [
      { text: `Bước 1/3: Tạo bảng Excel (.xlsx), CSV & Bản đồ GIS (${records.length} điểm)`, status: 'running' },
      { text: `Bước 2/3: Nén ${photoCount} ảnh đã đóng dấu Code vào gói .ZIP`, status: 'pending' },
      { text: `Bước 3/3: Xuất gói file .ZIP hoàn tất 100%`, status: 'pending' }
    ];

    renderProgressStepUI(`⏳ ĐANG ĐÓNG GÓI DỮ LIỆU (${records.length} ĐIỂM)...`, 10, steps);

    try {
      const { blob, fileName } = await buildZipPackageBlob(records, (pct) => {
        steps[0].status = 'done';
        steps[1].status = 'running';
        const mappedPct = 15 + Math.round(pct * 0.8);
        renderProgressStepUI(`🔄 ĐANG NÉN GÓI .ZIP (${Math.round(pct)}%)...`, mappedPct, steps);
      });

      steps[0].status = 'done';
      steps[1].status = 'done';
      steps[2].status = 'done';
      const doneTime = formatShortTime(new Date().toISOString());

      renderProgressStepUI(
        `🎉 ĐÃ XUẤT XONG 100% GÓI .ZIP LÚC ${doneTime}!`,
        100,
        steps
      );
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);

      const sizeKB = Math.round(blob.size / 1024);
      const stts = records.map(r => r.stt);

      if (shareMode === 'zalo_share') {
        // Chỉ chia sẻ ĐÚNG 1 FILE .ZIP (không kèm text) để Zalo nhận 1 tệp duy nhất, không bị tách lẻ
        const zipFile = new File([blob], fileName, { type: 'application/zip' });
        if (navigator.canShare && navigator.canShare({ files: [zipFile] })) {
          try {
            await navigator.share({ files: [zipFile] });
          } catch (shareErr) {
            if (shareErr && shareErr.name === 'AbortError') {
              showToast('Đã hủy gửi qua Zalo', 'warn');
              return;
            }
            throw shareErr;
          }
          const receipt = addSubmitReceipt({ channel: 'zalo', confirmed: true, fileName, points: records.length, photos: photoCount, sizeKB, stts });
          showReceiptModal(receipt);
          return;
        }
        showToast('Trình duyệt này không mở được Zalo trực tiếp — đã lưu 1 file .ZIP vào máy để gửi Zalo thủ công.', 'warn', 5000);
      }

      // Lưu đúng 1 file .ZIP vào máy (dự phòng) — không tách file lẻ
      triggerDownloadBlob(blob, fileName);
      const receipt = addSubmitReceipt({ channel: 'local', confirmed: true, fileName, points: records.length, photos: photoCount, sizeKB, stts });
      showReceiptModal(receipt);
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        steps.forEach(s => { if (s.status === 'running') s.status = 'error'; });
        renderProgressStepUI(`⚠️ LỖI KHI ĐÓNG GÓI: ${err.message}`, 50, steps);
        showToast('Lỗi đóng gói: ' + err.message, 'error');
      }
    } finally {
      state.isUploading = false;
    }
  }

  // --- TAB 3: SAVED PLOT LIST ---
  function renderPlotListTab() {
    const container = document.getElementById('plotListContainer');
    if (!container) return;

    const searchQ = (document.getElementById('searchPlotInput').value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('filterStatusSelect').value || 'done';
    const allCodes = getAllOrderedPlotCodes();

    const htmlList = [];
    allCodes.forEach(stt => {
      const rec = getRecord(stt);
      const master = state.masterPlots.get(stt);
      if (statusFilter === 'done' && !rec) return;
      if (statusFilter === 'todo' && rec) return;

      const textBlob = `${stt} ${rec ? (rec.note || '') + ' ' + (rec.x || '') : ''} ${master ? (master.variety || '') + ' ' + (master.xa || '') : ''}`.toLowerCase();
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

      const statusBadgeHTML = rec
        ? `<span class="status-pill-done">✅ ĐÃ LƯU (${rec.surveyDateTime})</span>`
        : `<span class="status-pill-todo">⏳ Chưa lưu</span>`;

      htmlList.push(`
        <div class="plot-item ${rec ? 'done' : ''}">
          <div class="plot-item-top">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="plot-stt-badge">${stt}</span>
              ${statusBadgeHTML}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" onclick="window.__kslStartPlot('${stt}')">
                ${rec ? '✏️ Mở / Sửa lại' : '📍 Định vị & Nhập'}
              </button>
              ${xDisp !== '—' ? `
              <a href="https://www.google.com/maps/dir/?api=1&destination=${yDisp},${xDisp}&travelmode=two-wheeler" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                🛵 Chỉ đường
              </a>` : ''}
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

    if (htmlList.length > 0) {
      container.innerHTML = htmlList.join('');
    } else if (statusFilter === 'done') {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-secondary);">
          <div style="font-size:1.8rem;margin-bottom:6px;">📍</div>
          <div style="font-weight:800;margin-bottom:8px;">Chưa có điểm khảo sát nào được lưu trong máy.</div>
          <button type="button" class="btn btn-yellow btn-sm" onclick="document.querySelector('[data-tab=tab-survey]').click()">
            👉 Quay lại Tab 1 để Định vị GPS &amp; Lưu điểm CT01
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-secondary);">Không có điểm ruộng nào khớp bộ lọc.</div>`;
    }
  }

  window.__kslDeleteRecord = function (recordId) {
    const rec = state.surveyRecords.get(recordId);
    if (!rec) return;
    showModal({
      title: `Xóa điểm ${rec.stt}?`,
      html: `<p>Bạn có chắc muốn xóa dữ liệu đã lưu của điểm <strong>${rec.stt}</strong> không?</p>`,
      buttons: [
        { label: 'Hủy', className: 'btn btn-outline btn-sm' },
        {
          label: '🗑️ Xác nhận xóa',
          className: 'btn btn-danger btn-sm',
          onClick: async () => {
            await dbDelete('survey_records', recordId);
            await dbDelete('master_plots', rec.stt);
            state.surveyRecords.delete(recordId);
            state.masterPlots.delete(rec.stt);
            updateHeaderAndProgressUI();
            refreshMapMarkers();
            showToast(`Đã xóa điểm ${rec.stt}`);
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

  // --- EXPORT / IMPORT MASTER PLOTS ---
  function exportMasterRegistryJSON() {
    const saved = getAllSavedRecords();
    const list = saved.map(r => ({
      stt: r.stt,
      x: Number(r.x),
      y: Number(r.y),
      sowingDate: r.sowingDate,
      variety: r.variety,
      method: r.method,
      baseNote: r.note
    }));
    const payload = {
      version: '3.2',
      exportedAt: formatNowDateTime(),
      exportedBy: state.surveyorName,
      totalPlots: list.length,
      masterPlots: list
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownloadBlob(blob, 'DanhMuc_RuongDot1.json');
    showToast(`Đã tải xuống DanhMuc_RuongDot1.json (${list.length} điểm)`);
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
              sowingDate: p.sowingDate || p['Ngày sạ/cấy'] || '',
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
            sowingDate: String(r['Ngày sạ/cấy sowing/transplanting date (if any) dd/mm/yy'] || r['sowingDate'] || ''),
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
          sowingDate: p.sowingDate || '',
          variety: p.variety || 'OM5454',
          method: p.method || 'Sạ hàng',
          baseNote: p.baseNote || `${p.variety || 'OM5454'} - ${p.method || 'Sạ hàng'}`
        };
        await dbPut('master_plots', cleanPlot);
        state.masterPlots.set(cleanPlot.stt, cleanPlot);
      }

      updateHeaderAndProgressUI();
      selectPlotIntoForm(importedPlots[0].stt, { panMap: true });
      fitAllSavedPlotsOnMap();
      showToast(`✅ Đã nạp ${importedPlots.length} điểm tọa độ vào danh sách!`);
    } catch (err) {
      showToast('Lỗi đọc file: ' + err.message, 'error');
    }
  }

  async function loadPresetDataset(presetKey) {
    if (!window.DBSCL_PRESETS || !window.DBSCL_PRESETS[presetKey]) return;
    const list = window.DBSCL_PRESETS[presetKey];

    for (const p of list) {
      await dbPut('master_plots', p);
      state.masterPlots.set(p.stt, p);
      if (presetKey === 'demo_5_ct') {
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
          extraNote: '',
          note: `${p.variety} - ${p.method}`,
          photos: { TongQuan: null, Can1: null, Can2: null },
          gpsActual: { x: p.x, y: p.y, accuracy: 6, heading: 90 },
          savedAt: new Date().toISOString()
        };
        await dbPut('survey_records', rec);
        state.surveyRecords.set(rec.id, rec);
      }
    }

    updateHeaderAndProgressUI();
    selectPlotIntoForm(list[0].stt, { panMap: true });
    fitAllSavedPlotsOnMap();
    showToast(`✅ Đã nạp dữ liệu mẫu (${list.length} điểm)!`);
  }

  // --- EXPORT EXCEL, CSV, GEOJSON, KML & ZALO ZIP PACKAGE ---
  function buildStandardSheetRows(records) {
    return records.map(r => {
      const das = computeDAS(r.sowingDate, r.surveyDateTime);
      const stCode = Number(r.growthStage);
      const stLabel = stCode === 0 ? '0 (Chưa sạ)' : stCode === 13 ? '13 (Đã thu hoạch)' : stCode;
      const stageNoteVal = r.stageNote || (stCode === 0 ? 'Chưa sạ - Đang làm đất' : stCode === 13 ? 'Đã thu hoạch - Còn gốc rạ' : 'Đang có lúa');
      const sowSourceVal = r.sowingSource || (r.sowingDate ? 'Ước lượng' : 'Chưa sạ / Chưa rõ');
      const sowDisplay = r.sowingDate ? `${r.sowingDate} (${sowSourceVal})` : sowSourceVal;

      return {
        'STT (GPS)': r.stt,
        'X': Number(r.x),
        'Y': Number(r.y),
        'Ngày và giờ khảo sát (dd/mm/yy hh:mm)': r.surveyDateTime,
        'Giai đoạn sinh trưởng của lúa (ảnh, hoặc thông tin của người nông dân) - Rice growth stages': stLabel,
        'Hiện trạng / Ghi chú giai đoạn (Chưa sạ / Đã thu hoạch / Chi tiết)': stageNoteVal,
        'Chế độ ngập nước': r.waterRegime,
        'Chiều cao mực nước (cm, trung bình 3 lần đo)': r.waterRegime === '1' && r.waterLevelAvg !== '' ? Number(r.waterLevelAvg) : '',
        'Ngày sạ/cấy sowing/transplanting date (if any) dd/mm/yy': sowDisplay,
        'Nguồn ngày sạ/cấy (Ước lượng / Gặp ND)': sowSourceVal,
        'Giống lúa (Có Chưa biết)': r.variety || 'Chưa biết',
        'Phương pháp sạ/cấy': r.method || 'Chưa biết',
        'Ghi chú - Note (giống lúa và phương pháp sạ/cấy)': r.note || '',
        'Đợt khảo sát': 1,
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
    XLSX.utils.book_append_sheet(wb, wsSurvey, 'KhaoSatLua_Dot1');
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
        round: 1,
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
      <name>${r.stt}</name>
      <description><![CDATA[
        <b>Mã ruộng:</b> ${r.stt}<br/>
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
    <name>KhaoSatLua_Dot1</name>
    ${placemarks}
  </Document>
</kml>`;
  }

  function getBaseExportPrefix(records) {
    const sCode = getSurveyorCode(state.surveyorName);
    const ts = formatFileTimestamp();
    return `KhaoSatLua_Dot1_${sCode}_${ts}_${records.length}diem`;
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

  async function buildZipPackageBlob(customRecords, onProgress) {
    const records = customRecords || getAllSavedRecords();
    const prefix = getBaseExportPrefix(records);
    const zip = new JSZip();

    const xlsxBuf = generateExcelWorkbookBuffer(records);
    zip.file(`${prefix}.xlsx`, xlsxBuf);

    const csvStr = generateCSVWithBOM(records);
    zip.file(`${prefix}.csv`, csvStr);

    const masterList = records.map(r => ({
      stt: r.stt,
      x: Number(r.x),
      y: Number(r.y),
      sowingDate: r.sowingDate,
      variety: r.variety,
      method: r.method,
      baseNote: r.note
    }));
    zip.file('DanhMuc_RuongDot1.json', JSON.stringify({
      version: '3.2',
      exportedAt: formatNowDateTime(),
      exportedBy: state.surveyorName,
      totalPlots: masterList.length,
      masterPlots: masterList
    }, null, 2));

    zip.file(`${prefix}.geojson`, generateGeoJSONString(records));
    zip.file(`${prefix}.kml`, generateKMLString(records));

    const folderCoded = zip.folder('Anh_Co_Code');
    const includeRaw = document.getElementById('chkSaveRawPhotos').checked;
    const folderRaw = includeRaw ? zip.folder('Anh_Goc_Sach_AI') : null;

    records.forEach(r => {
      if (!r.photos) return;
      ['TongQuan', 'Can1', 'Can2'].forEach(tk => {
        const p = r.photos[tk];
        if (p && p.stampedDataUrl) {
          const fName = p.fileName || `Dot1_${r.stt}_${r.surveyorCode}_${tk}.jpg`;
          folderCoded.file(fName, dataUrlToUint8Array(p.stampedDataUrl));
          if (includeRaw && folderRaw && p.rawDataUrl) {
            folderRaw.file(fName.replace('.jpg', '_RAW.jpg'), dataUrlToUint8Array(p.rawDataUrl));
          }
        }
      });
    });

    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE' },
      (meta) => {
        if (typeof onProgress === 'function') onProgress(meta.percent || 0);
      }
    );
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
    const records = getAllSavedRecords();
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
          📁 Tên gói nén khi xuất: ${prefix}.zip
        </div>
        <ul style="padding-left:18px;line-height:1.55;color:var(--text-secondary);">
          <li>📊 <strong>${prefix}.xlsx</strong> &amp; <strong>.csv</strong> (${records.length} điểm đã lưu trong máy, chuẩn 9 cột gốc)</li>
          <li>🗂️ <strong>DanhMuc_RuongDot1.json</strong> (${records.length} điểm ruộng Đợt 1)</li>
          <li>🌍 <strong>${prefix}.geojson</strong> &amp; <strong>.kml</strong> (Mở trực tiếp trên Google Earth / QGIS)</li>
          <li>🖼️ Thư mục <strong>Anh_Co_Code/</strong> (${photoCount} ảnh JPEG đã đóng dấu mã Code)</li>
        </ul>
      `;
    }

    const doneStts = records.map(r => r.stt).join(', ');
    const reportText = [
      `🌾 [BÁO CÁO KHẢO SÁT LÚA THỰC ĐỊA - ĐỢT 1]`,
      `👤 Người khảo sát: ${state.surveyorName} (Mã: ${getSurveyorCode(state.surveyorName)})`,
      `🕒 Thời gian báo cáo: ${formatNowDateTime()}`,
      `✅ Tổng số điểm đã khảo sát: ${records.length} điểm`,
      `📍 Danh sách mã điểm (${records.length}): ${doneStts || 'Chưa có'}`,
      `📦 Gói dữ liệu (1 file): ${prefix}.zip`
    ].join('\n');

    const reportArea = document.getElementById('zaloReportTextarea');
    if (reportArea) reportArea.value = reportText;
    renderSubmitReceiptList();
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
    const baseUrl = isLocalOrFile ? 'https://pdtien.github.io/khao-sat-lua-dbscl/' : (window.location.origin + window.location.pathname);
    urlInput.value = baseUrl;
    renderQRCode(baseUrl);
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
        fitAllSavedPlotsOnMap();
      }, 120);
    }
    if (tabId === 'tab-list') {
      renderPlotListTab();
    }
    if (tabId === 'tab-export') {
      updateExportPreviewUI();
    }
  }

  // --- INITIALIZE EVENT LISTENERS ---
  function bindEvents() {
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

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

    if (state.themeLight) document.body.classList.add('theme-light');
    document.getElementById('btnToggleTheme').addEventListener('click', () => {
      state.themeLight = !state.themeLight;
      document.body.classList.toggle('theme-light', state.themeLight);
      localStorage.setItem('ksl_themeLight', String(state.themeLight));
    });

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

    document.getElementById('surveyorInput').addEventListener('input', (e) => {
      state.surveyorName = e.target.value;
      localStorage.setItem('ksl_surveyorName', state.surveyorName);
      document.getElementById('surveyorCodeBadge').textContent = getSurveyorCode(state.surveyorName);
      reStampExistingPhotos();
      updateExportPreviewUI();
    });

    document.getElementById('plotSelectQuick').addEventListener('change', (e) => {
      selectPlotIntoForm(e.target.value, { panMap: true });
    });

    document.getElementById('sttInput').addEventListener('change', (e) => {
      selectPlotIntoForm(e.target.value, { panMap: true });
    });

    document.getElementById('btnHeaderNewPoint').addEventListener('click', handleGoToNewPoint);
    document.getElementById('btnNextNewPoint').addEventListener('click', handleGoToNewPoint);
    document.getElementById('btnGoNextPointBottom').addEventListener('click', handleGoToNewPoint);
    document.getElementById('btnAddNewPointFromList').addEventListener('click', () => {
      switchTab('tab-survey');
      handleGoToNewPoint();
    });

    document.getElementById('btnGetGPS').addEventListener('click', () => {
      setCoordLockState(false);
      requestCurrentGPS(true);
    });

    const btnLockHere = document.getElementById('btnLockCoordsHere');
    if (btnLockHere) {
      btnLockHere.addEventListener('click', handleLockAndSaveCoordsAtGpsBox);
    }

    const btnUnlockHere = document.getElementById('btnUnlockCoordsHere');
    if (btnUnlockHere) {
      btnUnlockHere.addEventListener('click', () => {
        setCoordLockState(false);
        showToast('🔓 Đã mở khóa tọa độ X, Y! Bạn có thể sửa tay hoặc kéo ghim trên bản đồ.');
      });
    }

    document.getElementById('btnOpenGMapsForm').addEventListener('click', () => {
      const x = parseFloat(document.getElementById('coordXInput').value);
      const y = parseFloat(document.getElementById('coordYInput').value);
      if (!isNaN(x) && !isNaN(y)) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${y.toFixed(6)},${x.toFixed(6)}&travelmode=two-wheeler`, '_blank');
      } else {
        showToast('Chưa có tọa độ X, Y để mở Google Maps!', 'warn');
      }
    });

    ['coordXInput', 'coordYInput'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => markFormDirty());
      document.getElementById(id).addEventListener('change', () => {
        markFormDirty();
        reStampExistingPhotos();
        syncMapsToCurrentPlot(true);
      });
    });

    document.getElementById('btnNowDateTime').addEventListener('click', () => {
      document.getElementById('surveyDateTimeInput').value = formatNowDateTime();
      markFormDirty();
      updateDASAndStageHints();
      reStampExistingPhotos();
    });

    document.getElementById('surveyDateTimeInput').addEventListener('input', () => {
      markFormDirty();
      updateDASAndStageHints();
      reStampExistingPhotos();
    });

    document.getElementById('sowingDateInput').addEventListener('input', () => {
      markFormDirty();
      updateDASAndStageHints();
    });

    document.getElementById('sowingDatePicker').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const [yyyy, mm, dd] = val.split('-');
        document.getElementById('sowingDateInput').value = `${dd}/${mm}/${yyyy}`;
        markFormDirty();
        updateDASAndStageHints();
      }
    });

    document.querySelectorAll('#sowingSourceChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-sow-source');
        if (src === 'Ước lượng') {
          setSowingSource('Ước lượng', true);
          toggleQuickEstimatePanel();
        } else if (src === 'Chưa sạ / Chưa rõ') {
          document.getElementById('sowingDateInput').value = '';
          setSowingSource('Chưa sạ / Chưa rõ', true);
          toggleQuickEstimatePanel(false);
        } else {
          setSowingSource(src, true);
          toggleQuickEstimatePanel(false);
        }
      });
    });

    const btnCloseQuickEst = document.getElementById('btnCloseQuickEstimate');
    if (btnCloseQuickEst) {
      btnCloseQuickEst.addEventListener('click', () => toggleQuickEstimatePanel(false));
    }

    document.querySelectorAll('#quickEstimateSowGroup .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        estimateSowingDateByDAS(btn.getAttribute('data-est-das'));
      });
    });

    document.querySelectorAll('#stageStatusChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const noteText = btn.getAttribute('data-stage-note') || '';
        const setSt = btn.getAttribute('data-set-stage');
        const noteEl = document.getElementById('stageNoteInput');
        if (noteEl) noteEl.value = noteText;
        if (setSt !== null && setSt !== '') {
          document.getElementById('selectedStageInput').value = String(setSt);
          renderStagesGrid();
          if (setSt === '0') {
            document.getElementById('sowingDateInput').value = '';
            setSowingSource('Chưa sạ / Chưa rõ', false);
          } else if (setSt === '13') {
            setSowingSource('Chưa sạ / Chưa rõ', false);
          }
        }
        syncStageStatusChips();
        updateCombinedNotePreview();
        markFormDirty();
        reStampExistingPhotos();
      });
    });

    const stageNoteInputEl = document.getElementById('stageNoteInput');
    if (stageNoteInputEl) {
      stageNoteInputEl.addEventListener('input', () => {
        markFormDirty();
        syncStageStatusChips();
        updateCombinedNotePreview();
        reStampExistingPhotos();
      });
    }

    document.querySelectorAll('#waterRegimeGrid .water-btn').forEach(btn => {
      btn.addEventListener('click', () => setWaterRegime(btn.dataset.water, true));
    });

    ['waterM1', 'waterM2', 'waterM3'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        markFormDirty();
        recalcWaterAverage();
        reStampExistingPhotos();
      });
    });

    ['varietyInput', 'methodInput', 'roundExtraNoteInput'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        markFormDirty();
        syncVarietyMethodChips();
        updateCombinedNotePreview();
        reStampExistingPhotos();
      });
    });

    document.getElementById('finalNotePreview').addEventListener('input', () => {
      markFormDirty();
      reStampExistingPhotos();
    });

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
        if (p && p.stampedDataUrl) openLightbox(p, tk);
      });
    });

    const btnClearPhotos = document.getElementById('btnClearCurrentPhotos');
    if (btnClearPhotos) {
      btnClearPhotos.addEventListener('click', () => {
        state.photoStampGeneration = (state.photoStampGeneration || 0) + 1;
        state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };
        document.querySelectorAll('[data-photo-input]').forEach(inp => { inp.value = ''; });
        updatePhotoCardsUI();
        markFormDirty();
        showToast(`🗑️ Đã xóa sạch 3 ảnh của điểm ${state.currentPlotStt}`);
      });
    }

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
        markFormDirty();
        updatePhotoCardsUI();
      }
      document.getElementById('lightboxModal').classList.remove('open');
    });

    // Save Point to Device (Field workflow)
    document.getElementById('btnSaveRecordStay').addEventListener('click', () => {
      handleSaveSurveyRecord({ silentPopup: false });
    });

    document.getElementById('btnResetForm').addEventListener('click', () => {
      state.currentPhotos = { TongQuan: null, Can1: null, Can2: null };
      document.getElementById('roundExtraNoteInput').value = '';
      document.getElementById('waterM1').value = '';
      document.getElementById('waterM2').value = '';
      document.getElementById('waterM3').value = '';
      recalcWaterAverage();
      updatePhotoCardsUI();
      markFormDirty();
      showToast('Đã xóa trắng ảnh và số đo nước của điểm hiện tại');
    });

    document.getElementById('btnGoToExportAfterTrip').addEventListener('click', () => switchTab('tab-export'));

    // Tab 2: Map controls
    document.getElementById('btnLocateMeMap').addEventListener('click', () => {
      requestCurrentGPS(false);
      setTimeout(() => {
        if (state.userGPS.x && state.userGPS.y && state.fullMap) {
          state.fullMap.setView([state.userGPS.y, state.userGPS.x], 17);
        }
      }, 600);
    });

    document.getElementById('btnFitAllPlots').addEventListener('click', fitAllSavedPlotsOnMap);

    // Tab 3: List controls
    document.getElementById('btnExportMasterJSON').addEventListener('click', exportMasterRegistryJSON);
    document.getElementById('btnDownloadMasterJSON2')?.addEventListener('click', exportMasterRegistryJSON);

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
      const list = getAllSavedRecords();
      if (list.length === 0) {
        showToast('Hiện chưa có điểm nào được lưu trong máy.', 'warn');
        return;
      }
      showModal({
        title: `🗑️ Xóa toàn bộ ${list.length} điểm đã lưu?`,
        html: `<p>Bạn có chắc chắn muốn xóa toàn bộ ${list.length} điểm khảo sát Đợt 1 trong máy không?</p>`,
        buttons: [
          { label: 'Hủy', className: 'btn btn-outline btn-sm' },
          {
            label: 'Xóa tất cả',
            className: 'btn btn-danger btn-sm',
            onClick: async () => {
              for (const r of list) {
                await dbDelete('survey_records', r.id);
                await dbDelete('master_plots', r.stt);
              }
              state.surveyRecords.clear();
              state.masterPlots.clear();
              selectPlotIntoForm('CT01', { panMap: false });
              updateHeaderAndProgressUI();
              refreshMapMarkers();
              showToast('Đã xóa toàn bộ dữ liệu cũ');
            }
          }
        ]
      });
    });

    // Tab 4: Export After Field Trip (with 0-100% progress bar & Direct Google Drive Push)
    state.gasWebAppUrl = getValidGasUrl(state.gasWebAppUrl);
    localStorage.setItem('ksl_gasWebAppUrl', state.gasWebAppUrl);
    const gasInput = document.getElementById('gasWebAppUrlInput');
    if (gasInput) {
      gasInput.value = state.gasWebAppUrl;
    }

    const btnDirectDrive = document.getElementById('btnDirectPushToDrive');
    if (btnDirectDrive) {
      btnDirectDrive.addEventListener('click', pushPackageDirectlyToGoogleDrive);
    }

    const btnToggleSetup = document.getElementById('btnToggleDriveBridgeSetup');
    if (btnToggleSetup) {
      btnToggleSetup.addEventListener('click', () => {
        const box = document.getElementById('driveBridgeConfigBox');
        if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
      });
    }

    const btnSaveGas = document.getElementById('btnSaveGasUrl');
    if (btnSaveGas) {
      btnSaveGas.addEventListener('click', () => {
        const val = getValidGasUrl(document.getElementById('gasWebAppUrlInput')?.value || '');
        state.gasWebAppUrl = val;
        localStorage.setItem('ksl_gasWebAppUrl', val);
        const inp = document.getElementById('gasWebAppUrlInput');
        if (inp) inp.value = val;
        showToast('✅ Đã lưu cấu hình cầu nối đẩy thẳng lên Google Drive!');
      });
    }

    const btnCopyGas = document.getElementById('btnCopyGasCode');
    if (btnCopyGas) {
      btnCopyGas.addEventListener('click', () => {
        navigator.clipboard.writeText(getGasCodeTemplate()).then(() => {
          showToast('📋 Đã copy Mã Google Apps Script! Hãy dán vào script.google.com và chọn Triển khai > Ứng dụng web.');
        });
      });
    }

    document.getElementById('btnShareZaloZip').addEventListener('click', () => {
      exportAllAfterTripWithProgress('zalo_share');
    });

    document.getElementById('btnDownloadZipOnly').addEventListener('click', () => {
      exportAllAfterTripWithProgress('download_for_drive');
    });

    renderSubmitReceiptList();

    document.getElementById('btnCopyZaloReport').addEventListener('click', () => {
      const txt = document.getElementById('zaloReportTextarea').value;
      navigator.clipboard.writeText(txt).then(() => {
        showToast('📋 Đã copy báo cáo! Hãy dán vào nhóm Zalo.');
      });
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js?v=3.8').then(reg => {
        if (reg && reg.update) reg.update();
      }).catch(() => {});
    }
  }

  async function bootstrap() {
    await initDB();
    await loadAllDataFromDB();
    renderStagesGrid();
    renderVarietyAndMethodChips();
    bindEvents();
    initMaps();
    initCompassListener();
    updateHeaderAndProgressUI();
    selectPlotIntoForm('CT01', { panMap: true, autoGetGPS: true });
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
