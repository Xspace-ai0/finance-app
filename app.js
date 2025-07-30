/*

 * Finansal Planlama Uygulaması JavaScript dosyası.
 * Bu dosya, kullanıcı etkileşimlerini yönetir, verileri tarayıcının
 * localStorage'ında saklar ve gösterge paneli ile diğer bölümleri
 * günceller. Her fonksiyon, uygulamanın belirli bir bölümünü işler.
 */

// Uygulama verilerini tutmak için global değişken
let data;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // İlk sekme olarak gösterge panelini göster
  switchTab('dashboard');
  // Formlar için event dinleyicilerini kur
  document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);
  document.getElementById('category-form').addEventListener('submit', handleAddCategory);
  document.getElementById('budget-form').addEventListener('submit', handleAddBudget);
  document.getElementById('goal-form').addEventListener('submit', handleAddGoal);
  // Gönderileri dinlemek için goal tablosuna event delegation ekle
  document.getElementById('goals-table').addEventListener('submit', handleGoalContribution);
});

// localStorage'dan veriyi yükler veya varsayılan boş veriyi oluşturur
function loadData() {
  const stored = localStorage.getItem('financeData');
  if (stored) {
    try {
      data = JSON.parse(stored);
    } catch (e) {
      data = { categories: [], transactions: [], budgets: [], goals: [] };
    }
  } else {
    data = { categories: [], transactions: [], budgets: [], goals: [] };
  }
}

// veriyi localStorage'a yazar
function saveData() {
  localStorage.setItem('financeData', JSON.stringify(data));
}

// id üretmek için küçük yardımcı fonksiyon
function generateId(list) {
  return list.length > 0 ? Math.max(...list.map(item => item.id)) + 1 : 1;
}

// Sekmeler arasında geçiş yapar ve ilgili render fonksiyonunu çağırır
function switchTab(tabName) {
  document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
  const section = document.getElementById(`${tabName}-section`);
  if (section) section.style.display = '';
  if (tabName === 'dashboard') renderDashboard();
  else if (tabName === 'transactions') renderTransactions();
  else if (tabName === 'categories') renderCategories();
  else if (tabName === 'budgets') renderBudgets();
  else if (tabName === 'goals') renderGoals();
}

// Gösterge panelini hesaplar ve günceller
function renderDashboard() {
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};
  data.transactions.forEach(tx => {
    if (tx.type === 'income') totalIncome += tx.amount;
    else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      // kategoriye göre harcama topla
      const catName = getCategoryName(tx.categoryId);
      if (catName) {
        expenseByCategory[catName] = (expenseByCategory[catName] || 0) + tx.amount;
      }
    }
  });
  const net = totalIncome - totalExpense;
  document.getElementById('total-income').textContent = totalIncome.toFixed(2);
  document.getElementById('total-expense').textContent = totalExpense.toFixed(2);
  document.getElementById('net-savings').textContent = net.toFixed(2);
  // pasta grafiğini çiz
  drawExpenseChart(expenseByCategory);
  // bütçe özetini çiz
  renderBudgetSummary();
  // hedef özetini çiz
  renderGoalSummary();
}

// Pasta grafiği oluşturur
let expenseChart;
function drawExpenseChart(dataObj) {
  const ctx = document.getElementById('expense-chart').getContext('2d');
  const labels = Object.keys(dataObj);
  const values = Object.values(dataObj);
  // Eğer önceki grafik varsa yok et
  if (expenseChart) {
    expenseChart.destroy();
  }
  expenseChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
          'rgba(255, 159, 64, 0.5)'
        ]
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// Bütçe özetini oluşturur (dashboard)
function renderBudgetSummary() {
  const tbody = document.querySelector('#budget-summary-table tbody');
  tbody.innerHTML = '';
  data.budgets.forEach(budget => {
    const spent = data.transactions.filter(tx => tx.type === 'expense' && tx.categoryId === budget.categoryId &&
      new Date(tx.date) >= new Date(budget.startDate) && new Date(tx.date) <= new Date(budget.endDate))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const remaining = Math.max(budget.amount - spent, 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${getCategoryName(budget.categoryId)}</td>
      <td>${budget.startDate} - ${budget.endDate}</td>
      <td>${budget.amount.toFixed(2)}</td>
      <td>${spent.toFixed(2)}</td>
      <td>${remaining.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Hedef özetini oluşturur (dashboard)
function renderGoalSummary() {
  const tbody = document.querySelector('#goal-summary-table tbody');
  tbody.innerHTML = '';
  data.goals.forEach(goal => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${goal.name}</td>
      <td>${goal.targetAmount.toFixed(2)}</td>
      <td>${goal.currentAmount.toFixed(2)}</td>
      <td>${goal.dueDate}</td>
      <td><div class="progress"><div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">${progress.toFixed(1)}%</div></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// İşlemler sekmesini render eder
function renderTransactions() {
  // kategori seçeneklerini doldur
  const select = document.getElementById('transaction-category');
  select.innerHTML = '<option value="">Kategori Yok</option>';
  data.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
  // varsayılan tarihe bugün'ü yaz
  document.getElementById('transaction-date').valueAsDate = new Date();
  // tabloyu doldur
  const tbody = document.querySelector('#transactions-table tbody');
  tbody.innerHTML = '';
  data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  data.transactions.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.amount.toFixed(2)}</td>
      <td>${tx.type === 'income' ? 'Gelir' : 'Gider'}</td>
      <td>${getCategoryName(tx.categoryId) || ''}</td>
      <td>${tx.description || ''}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteTransaction(${tx.id})">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Kategorileri render eder
function renderCategories() {
  const tbody = document.querySelector('#categories-table tbody');
  tbody.innerHTML = '';
  data.categories.forEach(cat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cat.name}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Bütçeleri render eder
function renderBudgets() {
  const select = document.getElementById('budget-category');
  select.innerHTML = '';
  data.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
  // tabloyu doldur
  const tbody = document.querySelector('#budgets-table tbody');
  tbody.innerHTML = '';
  data.budgets.forEach(budget => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${getCategoryName(budget.categoryId)}</td>
      <td>${budget.startDate}</td>
      <td>${budget.endDate}</td>
      <td>${budget.amount.toFixed(2)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteBudget(${budget.id})">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Hedefleri render eder
function renderGoals() {
  const tbody = document.querySelector('#goals-table tbody');
  tbody.innerHTML = '';
  data.goals.forEach(goal => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${goal.name}</td>
      <td>${goal.targetAmount.toFixed(2)}</td>
      <td>${goal.currentAmount.toFixed(2)}</td>
      <td>${goal.dueDate}</td>
      <td><div class="progress"><div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">${progress.toFixed(1)}%</div></div></td>
      <td>
        <form data-goal-id="${goal.id}" class="goal-contrib-form d-flex">
          <input type="number" step="0.01" name="contribution" class="form-control me-2" placeholder="Tutar" required>
          <button type="submit" class="btn btn-secondary">Ekle</button>
        </form>
      </td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteGoal(${goal.id})">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Silme işlemleri
// A given transaction is removed based on its id
function deleteTransaction(id) {
  data.transactions = data.transactions.filter(tx => tx.id !== id);
  saveData();
  renderTransactions();
  renderDashboard();
}

// Remove a category and update dependent entities
function deleteCategory(id) {
  // remove budgets associated with the category
  data.budgets = data.budgets.filter(b => b.categoryId !== id);
  // remove category
  data.categories = data.categories.filter(c => c.id !== id);
  // remove category from transactions
  data.transactions = data.transactions.map(tx => {
    if (tx.categoryId === id) {
      return { ...tx, categoryId: null };
    }
    return tx;
  });
  saveData();
  renderCategories();
  renderBudgets();
  renderTransactions();
  renderDashboard();
}

// Remove a budget by id
function deleteBudget(id) {
  data.budgets = data.budgets.filter(b => b.id !== id);
  saveData();
  renderBudgets();
  renderDashboard();
}

// Remove a goal by id
function deleteGoal(id) {
  data.goals = data.goals.filter(g => g.id !== id);
  saveData();
  renderGoals();
  renderDashboard();
}

// Yardımcı: kategori id'sine göre isim döndürür
function getCategoryName(id) {
  const cat = data.categories.find(c => c.id === id);
  return cat ? cat.name : null;
}

// İşlem ekleme formu gönderildiğinde çağrılır
function handleAddTransaction(event) {
  event.preventDefault();
  const amount = parseFloat(document.getElementById('transaction-amount').value);
  const type = document.getElementById('transaction-type').value;
  const categoryId = document.getElementById('transaction-category').value;
  const date = document.getElementById('transaction-date').value;
  const description = document.getElementById('transaction-description').value;
  const tx = {
    id: generateId(data.transactions),
    amount: amount,
    type: type,
    categoryId: categoryId ? parseInt(categoryId) : null,
    date: date,
    description: description
  };
  data.transactions.push(tx);
  saveData();
  // formu temizle
  event.target.reset();
  // tarih alanını yeniden bugüne ayarla
  document.getElementById('transaction-date').valueAsDate = new Date();
  renderTransactions();
}

// Kategori ekleme formu
function handleAddCategory(event) {
  event.preventDefault();
  const name = document.getElementById('category-name').value.trim();
  if (name === '') return;
  // aynı isimde kategori varsa ekleme
  if (data.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
    alert('Bu isimde bir kategori zaten var.');
    return;
  }
  const cat = { id: generateId(data.categories), name: name };
  data.categories.push(cat);
  saveData();
  event.target.reset();
  renderCategories();
}

// Bütçe ekleme formu
function handleAddBudget(event) {
  event.preventDefault();
  const amount = parseFloat(document.getElementById('budget-amount').value);
  const categoryId = parseInt(document.getElementById('budget-category').value);
  const startDate = document.getElementById('budget-start').value;
  const endDate = document.getElementById('budget-end').value;
  const budget = {
    id: generateId(data.budgets),
    amount: amount,
    categoryId: categoryId,
    startDate: startDate,
    endDate: endDate
  };
  data.budgets.push(budget);
  saveData();
  event.target.reset();
  renderBudgets();
}

// Hedef ekleme formu
function handleAddGoal(event) {
  event.preventDefault();
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const dueDate = document.getElementById('goal-due').value;
  const goal = {
    id: generateId(data.goals),
    name: name,
    targetAmount: target,
    currentAmount: 0,
    dueDate: dueDate
  };
  data.goals.push(goal);
  saveData();
  event.target.reset();
  renderGoals();
}

// Hedefe katkı ekleme işlemini yönetir (event delegation)
function handleGoalContribution(event) {
  if (event.target.tagName.toLowerCase() === 'form') {
    event.preventDefault();
    const form = event.target;
    const goalId = parseInt(form.getAttribute('data-goal-id'));
    const contributionInput = form.querySelector('input[name="contribution"]');
    const contribution = parseFloat(contributionInput.value);
    const goal = data.goals.find(g => g.id === goalId);
    if (goal) {
      goal.currentAmount += contribution;
      saveData();
      renderGoals();
      renderDashboard();
    }
  }




}

// Delete the last transaction from the list
function deleteLastTransaction() {
  if (data.transactions.length > 0) {
    const lastId = data.transactions[data.transactions.length - 1].id;
    deleteTransaction(lastId);
  }
}

// Delete the last category from the list
function deleteLastCategory() {
  if (data.categories.length > 0) {
    const lastId = data.categories[data.categories.length - 1].id;
    deleteCategory(lastId);
  }
}

// Delete the last budget from the list
function deleteLastBudget() {
  if (data.budgets.length > 0) {
    const lastId = data.budgets[data.budgets.length - 1].id;
    deleteBudget(lastId);
  }
}

// Delete the last goal from the list
function deleteLastGoal() {
  if (data.goals.length > 0) {
    const lastId = data.goals[data.goals.length - 1].id;
    deleteGoal(lastId);
  }
}
