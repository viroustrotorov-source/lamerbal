const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();
tg.setHeaderColor('#f6f6f7');
tg.setBackgroundColor('#f6f6f7');

const userId = tg.initDataUnsafe?.user?.id || 0;
const userName = tg.initDataUnsafe?.user?.first_name || 'User';
const userPhoto = tg.initDataUnsafe?.user?.photo_url;

const API_URL = 'http://localhost:8080/api';

async function getBalance() {
    try {
        const response = await fetch(`${API_URL}/balance/${userId}`);
        const data = await response.json();
        return data.success ? data.balance : 0;
    } catch (error) {
        console.error('Ошибка получения баланса:', error);
        return 0;
    }
}

async function updateBalance() {
    const balance = await getBalance();
    
    const walletBal = document.getElementById('walletBal');
    if (walletBal) {
        walletBal.textContent = `${balance.toFixed(2)} ₴`;
    }
    
    const profBalVal = document.querySelector('.prof-bal .bal-val');
    if (profBalVal) {
        profBalVal.textContent = `${balance.toFixed(2)} ₴`;
    }
}

async function loadProducts() {
    try {
        showToast('🔄 Загрузка товаров...');
        
        const response = await fetch(`${API_URL}/products`);
        const result = await response.json();
        
        if (result.success && result.products) {
            window._products = result.products;
            displayProducts(result.products);
            showToast('✅ Товары загружены!');
        } else {
            showToast('❌ Ошибка загрузки товаров');
        }
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showToast('❌ Ошибка загрузки товаров');
    }
}

function displayProducts(products) {
    const listContainer = document.querySelector('#v-accounts .list');
    if (!listContainer) return;
    
    if (!products || products.length === 0) {
        listContainer.innerHTML = `
            <div class="empty">
                <img src="img/telegram.png" alt="Empty">
                <h3>Товары не найдены</h3>
                <p>Попробуйте позже</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = products.map((product, index) => `
        <button class="row" onclick="selectProduct(${index})">
            <div class="lead">
                <img src="${product.image || 'img/account.png'}" alt="${product.name}">
            </div>
            <div class="txt">
                <b>${product.name}</b>
                <span>${product.description || product.category}</span>
            </div>
            <div class="price">
                ${product.price} ₴
                ${product.badge ? `<span class="badge">${product.badge}</span>` : ''}
            </div>
        </button>
    `).join('');
}

function selectProduct(index) {
    const product = window._products[index];
    if (!product) return;
    
    haptic('medium');
    
    const sheet = document.getElementById('buySheet');
    if (!sheet) {
        console.error('buySheet не найден');
        return;
    }
    
    const itemLead = sheet.querySelector('.item .lead');
    const itemName = sheet.querySelector('.item b');
    const itemDesc = sheet.querySelector('.item span');
    const sumPrice = sheet.querySelector('.sum b');
    
    if (itemLead) itemLead.innerHTML = `<img src="${product.image || 'img/account.png'}" alt="${product.name}">`;
    if (itemName) itemName.textContent = product.name;
    if (itemDesc) itemDesc.textContent = product.description || product.category;
    if (sumPrice) sumPrice.textContent = `${product.price} ₴`;
    
    const buyBtn = sheet.querySelector('.btn.block');
    if (buyBtn) {
        buyBtn.onclick = () => buyItem(product);
    }
    
    openSheet('buySheet');
}

async function buyItem(product) {
    try {
        haptic('heavy');
        showToast('🔄 Обработка покупки...');
        
        const response = await fetch(`${API_URL}/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                item_id: product.id,
                item_name: product.name,
                price: product.price
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            haptic('success');
            showToast('✅ Покупка успешна!');
            
            tg.sendData(JSON.stringify({
                action: 'purchase',
                item_id: product.id,
                item_name: product.name,
                price: product.price,
                data: result.data
            }));
            
            await updateBalance();
            closeAllSheets();
            setTimeout(() => go('profile'), 500);
        } else {
            haptic('error');
            showToast('❌ ' + (result.error || 'Ошибка покупки'));
        }
    } catch (error) {
        haptic('error');
        console.error('Ошибка покупки:', error);
        showToast('❌ Ошибка покупки');
    }
}

function openTopupSheet(amount) {
    const sheet = document.getElementById('topupSheet');
    if (!sheet) return;
    
    haptic('medium');
    
    if (amount) {
        const amountInput = sheet.querySelector('input[type="number"]');
        if (amountInput) {
            amountInput.value = amount;
        }
    }
    
    openSheet('topupSheet');
}

async function createTopup(amount) {
    try {
        haptic('heavy');
        showToast('🔄 Создание платежа...');
        
        tg.sendData(JSON.stringify({
            action: 'topup',
            amount: amount
        }));
        
        showToast('✅ Платёж создан!');
        closeAllSheets();
        
    } catch (error) {
        haptic('error');
        console.error('Ошибка пополнения:', error);
        showToast('❌ Ошибка пополнения');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('on');
    
    setTimeout(() => {
        toast.classList.remove('on');
    }, 3000);
}

function openSheet(sheetId) {
    const sheet = document.getElementById(sheetId);
    const scrim = document.getElementById('scrim');
    
    if (sheet && scrim) {
        scrim.classList.add('on');
        sheet.classList.add('on');
    }
}

function closeAllSheets() {
    const scrim = document.getElementById('scrim');
    const sheets = document.querySelectorAll('.sheet, .tag-sheet, .tp-sheet');
    
    if (scrim) scrim.classList.remove('on');
    sheets.forEach(s => s.classList.remove('on'));
}

function haptic(type = 'light') {
    if (tg.HapticFeedback) {
        if (type === 'light' || type === 'medium' || type === 'heavy' || type === 'rigid' || type === 'soft') {
            tg.HapticFeedback.impactOccurred(type);
        } else if (type === 'success' || type === 'warning' || type === 'error') {
            tg.HapticFeedback.notificationOccurred(type);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const profNameEl = document.querySelector('.prof-info b');
    if (profNameEl && userName) {
        profNameEl.textContent = userName;
    }
    
    const profIdEl = document.querySelector('.prof-id');
    if (profIdEl && userId) {
        profIdEl.textContent = `ID: ${userId}`;
    }
    
    if (userPhoto) {
        const profAvaEl = document.querySelector('.prof-ava');
        if (profAvaEl) {
            profAvaEl.innerHTML = `<img src="${userPhoto}" alt="${userName}">`;
        }
    }
    
    await updateBalance();
    await loadProducts();
    
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('gone');
        }, 1000);
    }
});

const scrim = document.getElementById('scrim');
if (scrim) {
    scrim.addEventListener('click', closeAllSheets);
}

if (tg.MainButton) {
    tg.MainButton.text = 'Закрыть';
    tg.MainButton.onClick(() => {
        tg.close();
    });
    tg.MainButton.show();
}

if (tg.BackButton) {
    tg.BackButton.onClick(() => {
        if (document.querySelector('.sheet.on, .tag-sheet.on, .tp-sheet.on')) {
            closeAllSheets();
        } else {
            tg.close();
        }
    });
}
