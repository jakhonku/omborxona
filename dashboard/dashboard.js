let globalInventoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchDataFromSheet();
});

async function fetchDataFromSheet() {
    const sheetId = '1Go4QdMPCK6Hws1Jjlp_utmVfRn-eAHoe01KLgud_bEE';
    const gid = '1496265145';
    // export?format=csv is the easiest way to get live data if the sheet is shared
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Sheetga ulanib bo\'lmadi. Sheet "Anyone with the link" (Ssilkasi bor har kim) rejimida ekanligiga ishonch hosil qiling.');
        
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        globalInventoryData = data;

        // Hide loading
        document.getElementById('loading').style.display = 'none';
        
        initApp();
    } catch (error) {
        console.error(error);
        const loadingEl = document.getElementById('loading');
        loadingEl.innerHTML = `<span style="color: #ef4444;">Xatolik: ${error.message}<br><br>Iltimos, Google Sheetingizda "Publish to web" (Internetga chiqarish) yoki ssilkasini ruxsat berilganligini tekshiring.</span>`;
    }
}

function parseCSV(text) {
    const items = [];
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    // Stream-based CSV parsing to handle newlines in quotes
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];

        if (c === '"') {
            if (inQuotes && next === '"') {
                currentCell += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            }
            if (c === '\r' && next === '\n') i++; // handle CRLF
        } else {
            currentCell += c;
        }
    }
    // Add last row if exists
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    let current_main_category = "Asosiy";
    let current_sub_category = "Umumiy";
    const known_mains = ["musiqa cholg'ular", "kompyuter texnikalari", "mebellar", "sport jihozlari"];

    // Skip the first row (header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const firstCol = row[0].trim();
        if (firstCol === 'N' || firstCol === '') continue;

        // Category Detection
        if (isNaN(firstCol)) {
            const catName = firstCol;
            if (known_mains.some(km => catName.toLowerCase().includes(km)) && catName.toLowerCase().includes("lar") && !catName.toLowerCase().includes("lari")) {
                current_main_category = catName;
                current_sub_category = "Umumiy";
            } else if (catName.toLowerCase().trim() === "musiqa cholg'ular") {
                current_main_category = catName;
                current_sub_category = "Umumiy";
            } else {
                if (current_main_category === "Asosiy") {
                    current_main_category = catName;
                } else {
                    current_sub_category = catName;
                }
            }
            continue;
        }

        // Item Detection
        if (!isNaN(firstCol) && firstCol !== '') {
            items.push({
                id: firstCol,
                name: row[1] || "",
                inv_number: row[2] || "",
                quantity: row[3] && !isNaN(row[3]) ? parseInt(row[3]) : 1,
                price: row[4] ? parseRawSum(row[4]) : 0,
                parameters: row[5] || "",
                responsible: row[6] || "",
                room: row[7] || "",
                status: row[8] || "",
                main_category: current_main_category,
                sub_category: current_sub_category
            });
        }
    }
    return items;
}

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote ""
                cur += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}

function parseRawSum(val) {
    if (!val) return 0;
    // 1. Remove all spaces (including non-breaking spaces)
    let clean = val.replace(/[\s\xa0]/g, '');
    
    // 2. Identify if it uses comma or dot as decimal
    // If there is both a dot and a comma, the last one is the decimal
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    
    if (lastComma > lastDot) {
        // Comma is decimal. Remove all dots (thousand separators) and replace comma with dot.
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        // Dot is decimal. Remove all commas (thousand separators).
        clean = clean.replace(/,/g, '');
    }
    
    // 3. Keep only digits and the decimal point
    clean = clean.replace(/[^0-9.]/g, '');
    
    return parseFloat(clean) || 0;
}

function initApp() {
    const select = document.getElementById('categoryFilter');
    // Clear existing
    select.innerHTML = '<option value="all">Barcha guruhlar</option>';
    
    const categories = new Set();
    globalInventoryData.forEach(item => {
        if (item.sub_category) categories.add(item.sub_category);
        else categories.add(item.main_category);
    });

    const sortedCats = Array.from(categories).sort();
    sortedCats.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });

    renderTable('all');

    select.addEventListener('change', (e) => {
        renderTable(e.target.value);
    });
}

function renderTable(filterCat) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    let itemsToRender = [];
    if (filterCat === 'all') {
        itemsToRender = globalInventoryData;
    } else {
        itemsToRender = globalInventoryData.filter(i => i.sub_category === filterCat || i.main_category === filterCat);
    }

    itemsToRender.sort((a,b) => parseInt(a.id) - parseInt(b.id));

    itemsToRender.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="td-id">${item.id}</td>
            <td class="td-name">${item.name}</td>
            <td class="td-inv">${item.inv_number || '-'}</td>
            <td class="td-qty" style="text-align:center;">${item.quantity}</td>
            <td class="td-val" style="text-align:center; font-weight:700;">${(item.price * item.quantity).toLocaleString()}</td>
            <td class="td-param">${item.parameters || '-'}</td>
            <td style="text-align: center;">${item.responsible || '-'}</td>
            <td style="text-align: center;">${item.room || '-'}</td>
            <td style="text-align: center;">
                <span class="status-badge" style="${getStatusColor(item.status)}">
                    ${item.status || 'Yaxshi'}
                </span>
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
    if (s.includes('ta\'mir')) return 'background-color: #fef9c3; color: #854d0e;';
    return 'background-color: #dcfce7; color: #166534;'; 
}
