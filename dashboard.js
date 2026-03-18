// Internet muammosi sababli ikon kutubxonasi yuklanmasa kodni to'xtatib qo'ymaslik kafolati
if (typeof lucide === 'undefined') {
    window.lucide = { createIcons: () => {} };
}
let globalInventoryData = [];
let availableSheets = [];
let currentFilter = 'all';
let currentSheet = '';
const API_URL = "https://script.google.com/macros/s/AKfycbzqRSEWf12t1Zcia3OYju6-53Xao3KAARSjHsnVDVFShp-xn0BtBHzur9KHlorz-CNBcQ/exec";

document.addEventListener('DOMContentLoaded', () => {
    fetchDataFromSheet(true);
    // Ma'lumotlarni har 10 soniyada orqa fonda avtomatik yangilash
    setInterval(() => {
        fetchDataFromSheet(false);
    }, 10000);
});

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
        availableSheets = jsonArr.map(s => s.sheetName);
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
        };

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
                if (current_main_category === sheetName) {
                    current_main_category = catName;
                } else {
                    current_sub_category = catName;
                }
                continue;
            }

            // Ma'lumot qatori
            const getVal = (col) => col !== -1 ? String(row[col] || '') : '';
            const getNum = (col) => {
                if (col === -1) return 0;
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
                old_number:   getVal(COL.old_number),
                photo:        getVal(COL.photo),
                extra_info:   getVal(COL.phone),
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
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    let itemsToRender = globalInventoryData.filter(i => i.sheet_name === currentSheet);

    if (currentFilter !== 'all') {
        itemsToRender = itemsToRender.filter(i => i.sub_category === currentFilter || i.main_category === currentFilter);
    }

    itemsToRender.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    let lastGroupKey = null;
    const TOTAL_COLS = 10; // jadval ustunlari soni

    itemsToRender.forEach(item => {
        // Guruh kaliti: sub_category bo'lsa u, aks holda main_category
        const groupKey = (item.sub_category && item.sub_category !== 'Umumiy')
            ? item.sub_category
            : item.main_category;

        // Yangi guruh boshlanayotgan bo'lsa — sarlavha qatori qo'shamiz
        if (groupKey !== lastGroupKey) {
            lastGroupKey = groupKey;
            const groupTr = document.createElement('tr');
            groupTr.innerHTML = `
                <td colspan="${TOTAL_COLS}" class="group-header-row">
                    <span class="group-icon">▸</span> ${groupKey}
                </td>
            `;
            tbody.appendChild(groupTr);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="td-id">${item.id}</td>
            <td class="td-name" title="${item.name}">${item.name}</td>
            <td class="td-inv">${item.inv_number || '-'}</td>
            <td class="td-inv">${item.serial || '-'}</td>
            <td class="td-qty" style="text-align:center;">${item.quantity}</td>
            <td class="td-val" style="text-align:center; font-weight:700;">${item.price ? (item.price * item.quantity).toLocaleString() : '-'}</td>
            <td class="td-param" title="${item.parameters || ''}">${item.parameters || '-'}</td>
            <td style="text-align: center;">
                ${item.responsible ? `<button class="person-link" onclick="showPersonModal('${item.sheet_name.replace(/'/g, "\\'")}', '${item.id}')">${item.responsible}</button>` : '-'}
            </td>
            <td style="text-align: center;">${item.room || '-'}</td>
            <td style="text-align: center;">
                ${item.status ? `<span class="status-badge" style="${getStatusColor(item.status)}">${item.status}</span>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateStats(itemsToRender);
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

    const photoEl = document.getElementById('modalPhoto');
    let finalPhotoSrc = "";

    if (item.photo && item.photo.includes('drive.google.com')) {
        // Drive havolasidan ID ni ajratib olamiz
        let fileId = null;
        
        // Format 1: /file/d/ID/view
        const m1 = item.photo.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m1) fileId = m1[1];
        
        // Format 2: uc?id=ID
        const m2 = item.photo.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (!fileId && m2) fileId = m2[1];

        if (fileId) {
            // Thumbnail API - CORS muammosi yo'q, har doim ishlaydi!
            finalPhotoSrc = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
        } else {
            finalPhotoSrc = item.photo;
        }
    } else if (item.photo && item.photo.trim() !== '') {
        finalPhotoSrc = item.photo;
    }

    if (finalPhotoSrc) {
        photoEl.src = finalPhotoSrc;
        photoEl.style.display = 'block';
    } else {
        photoEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.responsible || 'MS')}&background=e2e8f0&color=475569&size=150`;
    }

    document.getElementById('personModal').style.display = 'flex';
    lucide.createIcons();
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
});

// Escape tugmasi bilan yopish
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePersonModal();
    }
});
