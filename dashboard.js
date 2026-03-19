// Internet muammosi sababli ikon kutubxonasi yuklanmasa kodni to'xtatib qo'ymaslik kafolati
if (typeof lucide === 'undefined') {
    window.lucide = { createIcons: () => {} };
}
let globalInventoryData = [];
let availableSheets = [];
let currentFilter = 'all';
let currentSheet = '';
const API_URL = "https://script.google.com/macros/s/AKfycbzqRSEWf12t1Zcia3OYju6-53Xao3KAARSjHsnVDVFShp-xn0BtBHzur9KHlorz-CNBcQ/exec";
let globalSheetConfigs = {}; // Har bir varaq uchun mavjud ustunlar ro'yxati
let currentPhotoIndex = 0;
let modalPhotos = [];

const COLUMN_DEFS = {
    id:          { label: 'N', width: '38px', class: 'td-id' },
    name:        { label: 'NOMI', width: '17%', class: 'td-name', isText: true },
    inv_number:  { label: 'INV NUMBER', width: '105px', class: 'td-inv' },
    made_date:   { label: 'ISH. CHIQ. SANA', width: '80px', style: 'text-align: center; color: #64748b; font-size: 12px;' },
    serial:      { label: 'SERIYA R.', width: '85px', class: 'td-inv' },
    quantity:    { label: 'SONI', width: '42px', class: 'td-qty' },
    price:       { label: 'SUMMA (SO\'M)', width: '95px', class: 'td-val', isPrice: true },
    parameters:  { label: 'PARAMETRLAR', width: '14%', class: 'td-param', isText: true },
    responsible: { label: 'MAS\'UL SHAXS', width: '12%', style: 'text-align: center;', isPerson: true },
    room:        { label: 'KABINET', width: '65px', style: 'text-align: center;' },
    status:      { label: 'HOLAT', width: '75px', style: 'text-align: center;', isStatus: true }
};

const USERS = {
    'admin': { pass: 'admin123', role: 'super', name: 'Super Admin (Barcha bo\'limlar)' },
    'rttm': { pass: 'rttm123', role: 'rttm', name: 'RTTM Bo\'limi' },
    'musiqa': { pass: 'musiqa123', role: 'musiqa', name: 'Musiqa Cholg\'ular Bo\'limi' }
};

function handleLogin() {
    const u = document.getElementById('usernameInput').value.trim();
    const p = document.getElementById('passwordInput').value.trim();
    const err = document.getElementById('loginError');
    if (USERS[u] && USERS[u].pass === p) {
        localStorage.setItem('authRole', USERS[u].role);
        localStorage.setItem('authName', USERS[u].name);
        window.location.reload();
    } else {
        err.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('authRole');
    localStorage.removeItem('authName');
    window.location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('authRole');
    if (!role) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        lucide.createIcons();
        return; // Ma'lumotlarni yuklashni to'xtatish
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }

    adjustStickyHeaders();
    window.addEventListener('resize', adjustStickyHeaders);

    fetchDataFromSheet(true);
    // Ma'lumotlarni har 10 soniyada orqa fonda avtomatik yangilash
    setInterval(() => {
        fetchDataFromSheet(false);
    }, 10000);
});

function adjustStickyHeaders() {
    const card = document.querySelector('.dashboard-header-card');
    if (card) {
        document.documentElement.style.setProperty('--header-height', card.offsetHeight + 'px');
    }
}

async function fetchDataFromSheet(isInitial = false) {
    const url = `${API_URL}?_t=${new Date().getTime()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API server xatosi');

        const jsonText = await response.text();
        const jsonArr = JSON.parse(jsonText);

        const data = parseJSONData(jsonArr);

        globalInventoryData = data;

        // Barcha varaqlar nomini saqlab olamiz
        let sheetsList = jsonArr.map(s => s.sheetName);
        
        // Ruxsatlarga qarab varaqlarni filtrlash
        const role = localStorage.getItem('authRole');
        if (role === 'rttm') {
            sheetsList = sheetsList.filter(s => s.toLowerCase().includes('rttm'));
        } else if (role === 'musiqa') {
            sheetsList = sheetsList.filter(s => s.toLowerCase().includes('musiqa'));
        }
        
        availableSheets = sheetsList;

        if (isInitial && availableSheets.length > 0) {
            currentSheet = availableSheets[0]; // birinchi varaq sukut bo'yicha tanlanadi
        }

        if (isInitial) {
            document.getElementById('loading').style.display = 'none';
            initApp();
        } else {
            updateTabsAndFilters();
        }
    } catch (error) {
        console.error(error);
        if (isInitial) {
            const loadingEl = document.getElementById('loading');
            loadingEl.innerHTML = `<span style="color: #ef4444;">Xatolik: ${error.message}</span>`;
        }
    }
}

function parseJSONData(jsonArr) {
    const items = [];

    jsonArr.forEach(sheetObj => {
        const sheetName = sheetObj.sheetName;
        const rows = sheetObj.data;
        if (!rows || rows.length < 2) return;

        // 1-QATOR: Sarlavhalarni o'qib, ustun indekslarini aniqlaymiz
        const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());

        // Ustun indekslarini sarlavha orqali topamiz (kichik harfda solishtirish)
        const findCol = (...keywords) => {
            for (const kw of keywords) {
                const idx = headerRow.findIndex(h => h.includes(kw.toLowerCase()));
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const COL = {
            id:          findCol('n', '№', 'num'),
            name:        findCol('nomi', 'name', 'наименование'),
            inv:         findCol('inv number', 'inv', 'инв'),
            quantity:    findCol('soni', 'dona', 'quantity', 'кол'),
            price:       findCol('summa', 'suma', 'narx', 'price', 'сумма', 'sum'),
            parameters:  findCol('parametr', 'param', 'характер'),
            responsible: findCol("mas'ul", 'masul', 'ответ', 'responsible'),
            room:        findCol('kabinet', 'xona', 'room', 'кабин'),
            status:      findCol('holat', 'status', 'состо'),
            serial:      findCol('серий', 'seriy', 'serial'),
            old_number:  findCol('stariy', 'stark', 'старый', 'eski'),
            photo:       findCol('foto', 'rasm', 'photo', 'image'),
            phone:       findCol('telefon', 'phone', 'тел'),
            made_date:   findCol('sana', 'date', 'ishlab', 'дата'),
            info:        findCol('info', 'malumot', 'ma\'lumot'),
        };

        // Bu varaqda qaysi ustunlar borligini saqlab olamiz
        globalSheetConfigs[sheetName] = Object.keys(COL).filter(key => COL[key] !== -1);
        // id har doim bo'lishi kerak, lekin inv va serial kabi ustunlarni ko'rsatish-ko'rsatmaslikni boshqaramiz
        // (Made date kabi yangi ustunlar agar Google Sheetda bo'lsa saytda ham chiqadi)

        let current_main_category = sheetName;
        let current_sub_category = "Umumiy";

        // 2-qatordan boshlab ma'lumotlarni o'qiymiz
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const firstCol = String(row[0] || '').trim();
            if (firstCol === 'N' || firstCol === '№' || firstCol === '') continue;

            // Kategoriya qatori (raqam emas)
            if (isNaN(firstCol)) {
                const catName = firstCol;
                // Agar o'qilgan qator varaqning nomi bilan aynan bir xil bo'lsa yoki Asosiy vositalar bo'lsa
                if (catName.trim().toLowerCase() === sheetName.trim().toLowerCase() || catName.trim().toLowerCase() === "asosiy vositalar") {
                    current_main_category = catName;
                    current_sub_category = "Umumiy";
                } else {
                    current_sub_category = catName;
                }
                continue;
            }

            // Ma'lumot qatori
            const getVal = (col) => col !== -1 ? String(row[col] || '') : '';
            const getNum = (col) => {
                if (col === -1) return 1;
                const v = row[col];
                return v && !isNaN(v) ? parseInt(v) : 1;
            };

            items.push({
                id:           firstCol,
                name:         getVal(COL.name),
                inv_number:   getVal(COL.inv),
                quantity:     getNum(COL.quantity),
                price:        COL.price !== -1 ? parseRawSum(String(row[COL.price] || '')) : 0,
                parameters:   getVal(COL.parameters),
                responsible:  getVal(COL.responsible),
                room:         getVal(COL.room),
                status:       getVal(COL.status),
                serial:       getVal(COL.serial),
                made_date:    getVal(COL.made_date),
                old_number:   getVal(COL.old_number),
                photo:        getVal(COL.photo),
                extra_info:   getVal(COL.phone),
                bio_info:     getVal(COL.info),
                main_category: current_main_category,
                sub_category:  current_sub_category,
                sheet_name:    sheetName,
                sheet_row:     i + 1
            });
        }
    });
    return items;
}


function parseRawSum(val) {
    if (!val) return 0;
    let clean = val.replace(/[\s\xa0]/g, '');
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');

    if (lastComma > lastDot) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        clean = clean.replace(/,/g, '');
    }

    clean = clean.replace(/[^0-9.-]/g, '');
    return parseFloat(clean) || 0;
}

function initApp() {
    const select = document.getElementById('categoryFilter');

    updateTabsAndFilters();

    select.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderTable();
    });

    const reportBtn = document.getElementById('generateReportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', generateAiReport);
    }
}

function updateTabsAndFilters() {
    // 1. Varaqlar (Sheet) uchun tugmalarni yangilash
    const tabsContainer = document.getElementById('sheetTabsContainer');
    if (tabsContainer) {
        tabsContainer.innerHTML = '';
        availableSheets.forEach(sheet => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn' + (currentSheet === sheet ? ' active' : '');
            btn.textContent = sheet;
            btn.onclick = () => {
                currentSheet = sheet;
                currentFilter = 'all'; // yangi varaqqa o'tganda filterni tozalash
                updateTabsAndFilters(); // interfeysni va jadvalni yangilash
            };
            tabsContainer.appendChild(btn);
        });
    }

    // 2. O'sha varaqdagi guruhlar ro'yxatini to'plash (Select menyu uchun)
    const select = document.getElementById('categoryFilter');
    const categories = new Set();

    globalInventoryData.forEach(item => {
        if (item.sheet_name === currentSheet) {
            if (item.sub_category && item.sub_category !== "Umumiy") categories.add(item.sub_category);
            else categories.add(item.main_category);
        }
    });

    const sortedCats = Array.from(categories).sort();

    const currentVal = select.value || 'all';

    select.innerHTML = '<option value="all">Barcha guruhlar</option>';
    sortedCats.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });

    // Select holatini saqlab qolish
    if (sortedCats.includes(currentVal) || currentVal === 'all') {
        select.value = currentVal;
    } else {
        select.value = 'all';
        currentFilter = 'all';
    }

    // 3. Jadvalni chizish
    renderTable();
}

function renderTable() {
    const table = document.getElementById('mainTable');
    if (!table) return;

    // Varaq bo'yicha ma'lumotlarni saralash
    let itemsToRender = globalInventoryData.filter(i => i.sheet_name === currentSheet);
    if (currentFilter !== 'all') {
        itemsToRender = itemsToRender.filter(i => i.sub_category === currentFilter || i.main_category === currentFilter);
    }
    itemsToRender.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    // Ushbu varaqda mavjud bo'lgan va COLUMN_DEFS da ta'riflangan ustunlar
    const activeColKeys = (globalSheetConfigs[currentSheet] || []).filter(key => COLUMN_DEFS[key]);

    const groupTotals = {};
    itemsToRender.forEach(item => {
        const key = (item.sub_category && item.sub_category !== 'Umumiy') ? item.sub_category : item.main_category;
        groupTotals[key] = (groupTotals[key] || 0) + (item.price * item.quantity);
    });
    
    // 1. Jadvalni tozalash va Colgroup/Thead yaratish
    table.innerHTML = '';
    
    const colgroup = document.createElement('colgroup');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    activeColKeys.forEach(key => {
        const def = COLUMN_DEFS[key];
        
        // Col
        const col = document.createElement('col');
        if (def.width) col.style.width = def.width;
        colgroup.appendChild(col);

        // Th
        const th = document.createElement('th');
        th.textContent = def.label;
        if (key === 'name') th.style.textAlign = 'left';
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(colgroup);
    table.appendChild(thead);

    // 2. Tbody va Ma'lumotlarni chizish
    const tbody = document.createElement('tbody');
    tbody.id = 'tableBody';

    let lastGroupKey = null;
    const TOTAL_COLS = activeColKeys.length;

    itemsToRender.forEach(item => {
        const groupKey = (item.sub_category && item.sub_category !== 'Umumiy')
            ? item.sub_category
            : item.main_category;

        if (groupKey !== lastGroupKey) {
            lastGroupKey = groupKey;
            const groupTr = document.createElement('tr');
            groupTr.innerHTML = `
                <td colspan="${TOTAL_COLS}" class="group-header-row">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span><span class="group-icon">▸</span> ${groupKey}</span>
                        <span style="font-size: 11px; opacity: 1; font-weight: 700; color: #fff;">Guruh jami: ${groupTotals[groupKey].toLocaleString()} so'm</span>
                    </div>
                </td>
            `;
            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        activeColKeys.forEach(key => {
            const def = COLUMN_DEFS[key];
            const td = document.createElement('td');
            if (def.class) td.className = def.class;
            if (def.style) td.setAttribute('style', def.style);

            let value = item[key] || '-';

            if (def.isPrice) {
                td.textContent = item.price ? (item.price * item.quantity).toLocaleString() : '-';
                td.style.fontWeight = '700';
            } else if (def.isPerson) {
                td.innerHTML = item.responsible ? `<button class="person-link" onclick="showPersonModal('${item.sheet_name.replace(/'/g, "\\'")}', '${item.id}')">${item.responsible}</button>` : '-';
            } else if (def.isStatus) {
                td.innerHTML = item.status ? `<span class="status-badge" style="${getStatusColor(item.status)}">${item.status}</span>` : '';
            } else if (def.isText) {
                td.textContent = value;
                td.title = value;
            } else {
                td.textContent = value;
            }

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    updateStats(itemsToRender);
    lucide.createIcons();

    // Jadval chizilgandan keyin ham balandlikni to'g'rilab yuboramiz
    setTimeout(adjustStickyHeaders, 50);
}


function updateStats(items) {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    document.getElementById('totalCount').textContent = `${totalItems} dona`;
    document.getElementById('totalValue').textContent = `${totalValue.toLocaleString()} so'm`;
}

function getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('yaroqsiz')) return 'background-color: #fee2e2; color: #991b1b;';
    if (s.includes("ta'mir")) return 'background-color: #fef9c3; color: #854d0e;';
    return 'background-color: #dcfce7; color: #166534;';
}

function showPersonModal(sheetName, id) {
    const item = globalInventoryData.find(i => i.sheet_name === sheetName && i.id === id);
    if (!item) return;

    document.getElementById('modalName').textContent = item.responsible;
    document.getElementById('modalPhone').textContent = item.extra_info || "Kiritilmagan";
    document.getElementById('modalBio').textContent = item.bio_info || "";
    const bioBox = document.getElementById('modalBioBox');
    if (bioBox) bioBox.style.display = item.bio_info ? 'block' : 'none';

    // Fotolarni ajratish (vergul, nuqtali vergul yoki yangi qator orqali)
    const rawPhotos = (item.photo || '').split(/[\n,;]+/).map(p => p.trim()).filter(p => p !== '');
    modalPhotos = [];

    if (rawPhotos.length > 0) {
        rawPhotos.forEach(p => {
            let finalSrc = p;
            if (p.includes('drive.google.com')) {
                let fileId = null;
                const m1 = p.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (m1) fileId = m1[1];
                const m2 = p.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (!fileId && m2) fileId = m2[1];
                if (fileId) finalSrc = `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
            }
            modalPhotos.push(finalSrc);
        });
    } else {
        // Agar rasm bo'lmasa avatar
        modalPhotos.push(`https://ui-avatars.com/api/?name=${encodeURIComponent(item.responsible || 'MS')}&background=e2e8f0&color=475569&size=300`);
    }

    currentPhotoIndex = 0;
    renderCarousel();

    document.getElementById('personModal').style.display = 'flex';
    lucide.createIcons();
}

function renderCarousel() {
    const container = document.getElementById('carouselSlides');
    container.innerHTML = '';

    modalPhotos.forEach(src => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.innerHTML = `<img src="${src}" class="person-photo" alt="Photo">`;
        container.appendChild(slide);
    });

    // Navigatsiya tugmalari faqat 1 tadan ko'p rasm bo'lsa chiqadi
    const hasMultiple = modalPhotos.length > 1;
    document.querySelector('.carousel-nav.prev').style.display = hasMultiple ? 'flex' : 'none';
    document.querySelector('.carousel-nav.next').style.display = hasMultiple ? 'flex' : 'none';
    document.getElementById('carouselCounter').style.display = hasMultiple ? 'block' : 'none';

    updateCarousel();
}

function moveCarousel(step) {
    currentPhotoIndex += step;
    if (currentPhotoIndex >= modalPhotos.length) currentPhotoIndex = 0;
    if (currentPhotoIndex < 0) currentPhotoIndex = modalPhotos.length - 1;
    updateCarousel();
}

function updateCarousel() {
    const slides = document.getElementById('carouselSlides');
    slides.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    document.getElementById('carouselCounter').textContent = `${currentPhotoIndex + 1} / ${modalPhotos.length}`;
}

function closePersonModal() {
    document.getElementById('personModal').style.display = 'none';
}

// Modaldan tashqariga bosish orqali yopish
document.addEventListener('click', function(e) {
    const modal = document.getElementById('personModal');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
        closePersonModal();
    }
    const aiMdl = document.getElementById('aiModal');
    if (aiMdl && aiMdl.style.display === 'flex' && e.target === aiMdl) {
        closeAiModal();
    }
});

// Escape tugmasi bilan yopish
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePersonModal();
        closeAiModal();
    }
});

// --- AI REPORT LOGIC ---
function generateAiReport() {
    const reportContainer = document.getElementById('aiReportContainer');
    document.getElementById('aiModal').style.display = 'flex';
    
    // Simulate thinking state
    reportContainer.innerHTML = '<div style="text-align:center; padding: 40px;"><i data-lucide="loader-2" class="animate-spin" style="width:36px; height:36px; color:#8b5cf6; margin: 0 auto;"></i><p style="margin-top:15px; color:#64748b; font-weight:600; font-size:16px;">Mukammal tahlil hisoboti tayyorlanmoqda...</p></div>';
    lucide.createIcons();

    setTimeout(() => {
        let itemsToAnalyze = globalInventoryData.filter(i => i.sheet_name === currentSheet);
        if (currentFilter !== 'all') {
            itemsToAnalyze = itemsToAnalyze.filter(i => i.sub_category === currentFilter || i.main_category === currentFilter);
        }

        if (itemsToAnalyze.length === 0) {
            reportContainer.innerHTML = '<p style="text-align:center; padding:20px;">Ushbu bo\'limda obektlar mavjud emas.</p>';
            return;
        }

        // AI ga yangi bilimlarni (qanday toifalar / materiallar mavjudligini) o'rgatamiz:
        const categoryMap = {}; // Barcha toifalar bazasi
        let totalVal = 0;
        let totalItems = 0;

        itemsToAnalyze.forEach(item => {
            // Jihoz qaysi toifaga (kategoriyaga) tegishli ekanligini topish
            const cat = (item.sub_category && item.sub_category !== 'Umumiy') ? item.sub_category : item.main_category;
            
            if (!categoryMap[cat]) {
                categoryMap[cat] = {
                    totalSum: 0,
                    count: 0,
                    groups: {}
                };
            }
            
            // Xuddi yordamchi algoritm kabi nomi va turini bazaviy tozalab birlashtirish
            let baseName = (item.name || 'Nomsiz uskuna').trim();
            // Xar xil belgilarni olib tashlab umumiylashtirish (Qavslar, Vergullar, Maxsus sonli fraktsiyalar: 1/4, -1-4)
            let coreName = baseName.split(',')[0].split('(')[0];
            coreName = coreName.replace(/\s\d+\/\d+.*/g, ''); // " 1/4 октавы..." ni qirqadi
            coreName = coreName.replace(/-\d+(-\d+)?.*/g, ''); // "-1-4" kabilarni qirqadi
            coreName = coreName.replace(/[0-9]{5,}/g, ''); // 5 talik va undan katta bo'lgan seriyalarni qirqish
            
            let cleanName = coreName.replace(/\s+/g, ' ').trim().toLowerCase();
            const key = cleanName;

            if (!categoryMap[cat].groups[key]) {
                 categoryMap[cat].groups[key] = {
                     name: coreName.trim(), // Jihozning doimiy umumiy sof nomi (masalan: "Цифровое Фортепиано")
                     quantity: 0,
                     totalPrice: 0,
                     statuses: {},
                     paramsSet: new Set()
                 };
            }
            
            const paramText = (item.parameters || '').trim();
            if (paramText && paramText !== '-') {
                categoryMap[cat].groups[key].paramsSet.add(paramText);
            }
            
            categoryMap[cat].groups[key].quantity += item.quantity;
            categoryMap[cat].groups[key].totalPrice += (item.price * item.quantity);
            
            const st = item.status ? item.status.trim() : 'Mavjud';
            categoryMap[cat].groups[key].statuses[st] = (categoryMap[cat].groups[key].statuses[st] || 0) + item.quantity;
            
            categoryMap[cat].totalSum += (item.price * item.quantity);
            categoryMap[cat].count += item.quantity;
            
            totalVal += (item.price * item.quantity);
            totalItems += item.quantity;
        });

        // Xisobotni Web Sahifaga chizish
        let html = `<p style="font-size:16px;">Umumiy <strong>${totalItems} dona</strong> (jami qiymati <strong>${totalVal.toLocaleString()} so'm</strong>) bo'lgan barcha moddiy boyliklar quyidagi turkumlarga ajratib tahlil qilindi:</p>`;
        
        for (const [catName, catData] of Object.entries(categoryMap)) {
            html += `<h4 style="margin-top:25px; color:#4338ca; border-bottom:2px solid #c7d2fe; padding-bottom:8px;">
                <i data-lucide="folder-open" style="width:18px; margin-right:6px; vertical-align:text-bottom;"></i>
                ${catName} 
                <span style="font-size:13px; color:#475569; font-weight:normal; margin-left:10px;">(Jami ushbu guruhda: ${catData.count} ta uskuna, ${catData.totalSum.toLocaleString()} so'm)</span>
            </h4>`;
            
            html += `<ul>`;
            const sortedItems = Object.values(catData.groups).sort((a,b) => b.quantity - a.quantity);
            
            sortedItems.forEach(g => {
                let statusText = Object.entries(g.statuses).map(([s, c]) => `<b style="color:#ef4444;">${c} ta</b> ${s}`).join(', ');
                let paramHtml = '';
                if (g.paramsSet.size > 0) {
                    const pArr = Array.from(g.paramsSet);
                    const pText = pArr.length > 2 ? 'Har xil parametrlar mavjud' : pArr.join(' | ');
                    paramHtml = `<div style="font-size:13px; color:#64748b; margin-top:6px; padding: 4px; background:#f1f5f9; border-radius:4px;"><b>Parametri:</b> ${pText}</div>`;
                }
                
                html += `<li>
                    <strong style="color:#1e293b; font-size:15px;">${g.name}</strong> 
                    <span class="status-badge" style="background:#e0e7ff; color:#3730a3; padding: 3px 8px; border-radius:8px; margin-left:10px;">x ${g.quantity} ta</span>
                    ${paramHtml}
                    <div style="font-size:13px; color:#64748b; margin-top:8px;">
                        <span style="display:inline-block; margin-right: 15px;"><i data-lucide="activity" style="width:14px; height:14px; margin-right:2px; vertical-align:middle;"></i> <b>Holati:</b> ${statusText}</span>
                        <span style="display:inline-block;"><i data-lucide="banknote" style="width:14px; height:14px; margin-right:2px; vertical-align:middle;"></i> <b>Narxi:</b> ${g.totalPrice > 0 ? g.totalPrice.toLocaleString() + " so'm" : "Belgilanmagan"}</span>
                    </div>
                </li>`;
            });
            html += `</ul>`;
        }

        reportContainer.innerHTML = html;
        lucide.createIcons();
    }, 1000);
}

function closeAiModal() {
    document.getElementById('aiModal').style.display = 'none';
}
