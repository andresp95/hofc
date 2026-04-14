const appConfig = JSON.parse(document.getElementById("app-config").textContent);

const state = {
  materials: [],
  products: [],
  orders: [],
  materialSearchTerm: "",
  selectedProductCategories: new Set(["Todos"]),
  productSearchTerm: "",
  orderSearchTerm: "",
  orderDateFrom: "",
  orderDateTo: "",
  orderDeliveryFilter: "all",
  statsDateFrom: "",
  statsDateTo: "",
  statsMetric: "collected",
  calendarCursor: startOfMonth(new Date()),
  selectedOrderIds: new Set(),
  editingProductId: null,
  editingOrderId: null,
  pendingDelete: null,
};

const dom = {
  sectionButtons: document.querySelectorAll("[data-section-target]"),
  sections: document.querySelectorAll(".panel"),
  materialsBody: document.getElementById("materials-table-body"),
  materialSearchInput: document.getElementById("material-search-input"),
  productsBody: document.getElementById("products-table-body"),
  ordersBody: document.getElementById("orders-table-body"),
  productCategoryPills: document.getElementById("product-category-pills"),
  productSearchInput: document.getElementById("product-search-input"),
  orderSearchInput: document.getElementById("order-search-input"),
  orderDateFrom: document.getElementById("order-date-from"),
  orderDateTo: document.getElementById("order-date-to"),
  orderDeliveryFilter: document.getElementById("order-delivery-filter"),
  statsDateFrom: document.getElementById("stats-date-from"),
  statsDateTo: document.getElementById("stats-date-to"),
  statsMetricCards: document.querySelectorAll("[data-stat-metric]"),
  statsTotalCollected: document.getElementById("stats-total-collected"),
  statsTotalProfit: document.getElementById("stats-total-profit"),
  statsTotalCost: document.getElementById("stats-total-cost"),
  statsChartTitle: document.getElementById("stats-chart-title"),
  statsChartMeta: document.getElementById("stats-chart-meta"),
  statsChart: document.getElementById("stats-chart"),
  bulkOrdersToolbar: document.getElementById("bulk-orders-toolbar"),
  bulkOrdersCount: document.getElementById("bulk-orders-count"),
  bulkOrderStatus: document.getElementById("bulk-order-status"),
  applyBulkOrderStatus: document.getElementById("apply-bulk-order-status"),
  selectAllOrders: document.getElementById("select-all-orders"),
  calendarPrevMonth: document.getElementById("calendar-prev-month"),
  calendarNextMonth: document.getElementById("calendar-next-month"),
  calendarMonthLabel: document.getElementById("calendar-month-label"),
  calendarGrid: document.getElementById("calendar-grid"),
  productOptions: document.getElementById("product-options"),
  productModal: document.getElementById("product-modal"),
  orderModal: document.getElementById("order-modal"),
  deleteModal: document.getElementById("delete-modal"),
  productForm: document.getElementById("product-form"),
  orderForm: document.getElementById("order-form"),
  productMaterialsContainer: document.getElementById("product-materials-container"),
  orderItemsContainer: document.getElementById("order-items-container"),
  productModalTitle: document.getElementById("product-modal-title"),
  productModalKicker: document.getElementById("product-modal-kicker"),
  productSubmitButton: document.getElementById("product-submit-button"),
  productTotalCost: document.getElementById("product-total-cost"),
  orderModalTitle: document.getElementById("order-modal-title"),
  orderModalKicker: document.getElementById("order-modal-kicker"),
  orderSubmitButton: document.getElementById("order-submit-button"),
  orderMultiplierSelect: document.getElementById("order-multiplier-select"),
  orderMultiplierCustom: document.getElementById("order-multiplier-custom"),
  orderTotalModeSelect: document.getElementById("order-total-mode-select"),
  orderCustomTotalInput: document.getElementById("order-custom-total-input"),
  orderTotalCost: document.getElementById("order-total-cost"),
  orderTotalPrice: document.getElementById("order-total-price"),
  budgetItemsContainer: document.getElementById("budget-items-container"),
  budgetMultiplierSelect: document.getElementById("budget-multiplier-select"),
  budgetMultiplierCustom: document.getElementById("budget-multiplier-custom"),
  budgetTotalCost: document.getElementById("budget-total-cost"),
  budgetTotalPrice: document.getElementById("budget-total-price"),
  inkCard: document.getElementById("ink-card"),
  openInkCard: document.getElementById("open-ink-card"),
  closeInkCard: document.getElementById("close-ink-card"),
  inkA4Faces: document.getElementById("ink-a4-faces"),
  inkMlOutput: document.getElementById("ink-ml-output"),
  deleteModalTitle: document.getElementById("delete-modal-title"),
  deleteModalCopy: document.getElementById("delete-modal-copy"),
  confirmDeleteButton: document.getElementById("confirm-delete-button"),
  toastStack: document.getElementById("toast-stack"),
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadAllData();
});

function bindEvents() {
  dom.sectionButtons.forEach((button) => {
    button.addEventListener("click", () => activateSection(button.dataset.sectionTarget));
  });

  document.getElementById("add-material-top").addEventListener("click", addMaterialRow);
  document.getElementById("add-material-bottom").addEventListener("click", addMaterialRow);
  document.getElementById("save-materials-top").addEventListener("click", saveMaterials);
  document.getElementById("save-materials-bottom").addEventListener("click", saveMaterials);

  dom.materialSearchInput.addEventListener("input", (event) => {
    state.materialSearchTerm = event.target.value.trim().toLocaleLowerCase();
    applyMaterialFilter();
  });

  document.getElementById("create-product-button").addEventListener("click", () => {
    if (!state.materials.length) {
      showToast("Primero cargá al menos un material.", "error");
      activateSection("materiales");
      return;
    }
    openProductModal();
  });

  document.getElementById("create-order-button").addEventListener("click", () => {
    if (!state.products.length) {
      showToast("Primero cargá al menos un producto.", "error");
      activateSection("productos");
      return;
    }
    openOrderModal();
  });

  dom.productCategoryPills.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-filter]");
    if (!button) {
      return;
    }
    toggleCategoryFilter(button.dataset.categoryFilter);
  });

  dom.productSearchInput.addEventListener("input", (event) => {
    state.productSearchTerm = event.target.value.trim().toLocaleLowerCase();
    renderProducts();
  });

  dom.orderSearchInput.addEventListener("input", (event) => {
    state.orderSearchTerm = event.target.value.trim().toLocaleLowerCase();
    renderOrders();
  });

  dom.orderDateFrom.addEventListener("change", (event) => {
    state.orderDateFrom = event.target.value;
    renderOrders();
  });

  dom.orderDateTo.addEventListener("change", (event) => {
    state.orderDateTo = event.target.value;
    renderOrders();
  });

  dom.orderDeliveryFilter.addEventListener("change", (event) => {
    state.orderDeliveryFilter = event.target.value;
    renderOrders();
  });

  dom.statsDateFrom.addEventListener("change", (event) => {
    state.statsDateFrom = event.target.value;
    if (state.statsDateTo && state.statsDateFrom && state.statsDateFrom > state.statsDateTo) {
      state.statsDateTo = state.statsDateFrom;
      dom.statsDateTo.value = state.statsDateTo;
    }
    updateStats();
  });

  dom.statsDateTo.addEventListener("change", (event) => {
    state.statsDateTo = event.target.value;
    if (state.statsDateFrom && state.statsDateTo && state.statsDateTo < state.statsDateFrom) {
      state.statsDateFrom = state.statsDateTo;
      dom.statsDateFrom.value = state.statsDateFrom;
    }
    updateStats();
  });

  dom.statsMetricCards.forEach((card) => {
    card.addEventListener("click", () => {
      state.statsMetric = card.dataset.statMetric;
      updateStats();
    });
  });

  dom.applyBulkOrderStatus.addEventListener("click", applyBulkOrderStatus);
  dom.selectAllOrders.addEventListener("change", toggleSelectAllVisibleOrders);

  dom.calendarPrevMonth.addEventListener("click", () => shiftCalendarMonth(-1));
  dom.calendarNextMonth.addEventListener("click", () => shiftCalendarMonth(1));

  dom.materialsBody.addEventListener("input", (event) => {
    const row = event.target.closest("tr");
    if (row) {
      updateMaterialUnitPrice(row);
      if (event.target.name === "name") {
        applyMaterialFilter();
      }
    }
  });

  dom.materialsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-material]");
    if (button) {
      button.closest("tr")?.remove();
    }
  });

  dom.productsBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-product]");
    if (editButton) {
      const product = state.products.find((entry) => entry.id === Number(editButton.dataset.editProduct));
      if (product) {
        openProductModal(product);
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-product]");
    if (deleteButton) {
      openDeleteModal({
        type: "product",
        id: Number(deleteButton.dataset.deleteProduct),
        title: "Eliminar producto",
        copy: "Este producto se eliminará de la base local. Si está usado en pedidos no se podrá borrar.",
      });
    }
  });

  dom.ordersBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-order]");
    if (editButton) {
      const order = state.orders.find((entry) => entry.id === Number(editButton.dataset.editOrder));
      if (order) {
        openOrderModal(order);
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-order]");
    if (deleteButton) {
      openDeleteModal({
        type: "order",
        id: Number(deleteButton.dataset.deleteOrder),
        title: "Eliminar pedido",
        copy: "Este pedido se eliminará de la base local. Esta acción no se puede deshacer.",
      });
    }
  });

  dom.ordersBody.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-select-order]");
    if (!checkbox) {
      return;
    }

    const orderId = Number(checkbox.dataset.selectOrder);
    if (checkbox.checked) {
      state.selectedOrderIds.add(orderId);
    } else {
      state.selectedOrderIds.delete(orderId);
    }
    syncBulkOrdersToolbar();
  });

  dom.productForm.addEventListener("submit", submitProductForm);
  dom.orderForm.addEventListener("submit", submitOrderForm);
  dom.confirmDeleteButton.addEventListener("click", confirmDelete);

  document.getElementById("add-product-material").addEventListener("click", () => addProductMaterialRow());
  document.getElementById("add-order-item").addEventListener("click", () => addOrderItemRow());
  document.getElementById("add-budget-item").addEventListener("click", () => addBudgetItemRow());
  document.getElementById("reset-budget-button").addEventListener("click", resetBudgetPlanner);

  dom.productMaterialsContainer.addEventListener("click", (event) => {
    const option = event.target.closest("[data-material-option]");
    if (option) {
      event.preventDefault();
      const row = option.closest(".product-material-row");
      const material = state.materials.find((entry) => entry.id === Number(option.dataset.materialOption));
      if (row && material) {
        selectMaterialForRow(row, material);
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-product-material]");
    if (!removeButton) {
      return;
    }
    removeButton.closest(".product-material-row")?.remove();
    if (!dom.productMaterialsContainer.children.length) {
      addProductMaterialRow();
    }
    updateProductModalTotal();
  });

  dom.productMaterialsContainer.addEventListener("input", (event) => {
    const row = event.target.closest(".product-material-row");
    if (row) {
      if (event.target.name === "materialName") {
        renderMaterialDropdown(row, true);
      }
      updateProductMaterialRow(row);
      updateProductModalTotal();
    }
  });

  dom.productMaterialsContainer.addEventListener("change", (event) => {
    const row = event.target.closest(".product-material-row");
    if (row) {
      updateProductMaterialRow(row);
      updateProductModalTotal();
    }
  });

  dom.productMaterialsContainer.addEventListener("focusin", (event) => {
    const row = event.target.closest(".product-material-row");
    if (row && event.target.name === "materialName") {
      renderMaterialDropdown(row, true);
    }
  });

  dom.orderItemsContainer.addEventListener("click", (event) => {
    const option = event.target.closest("[data-product-option]");
    if (option) {
      event.preventDefault();
      const row = option.closest(".order-item-row");
      const product = state.products.find((entry) => entry.id === Number(option.dataset.productOption));
      if (row && product) {
        selectProductForRow(row, product, updateOrderModalTotals);
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-order-item]");
    if (!removeButton) {
      return;
    }

    removeButton.closest(".order-item-row")?.remove();
    if (!dom.orderItemsContainer.children.length) {
      addOrderItemRow();
    }
    updateOrderModalTotals();
  });

  dom.orderItemsContainer.addEventListener("input", (event) => {
    const row = event.target.closest(".order-item-row");
    if (row) {
      if (event.target.name === "productName") {
        renderProductDropdown(row, true);
      }
      updateOrderItemSummary(row);
      updateOrderModalTotals();
    }
  });

  dom.orderItemsContainer.addEventListener("focusin", (event) => {
    const row = event.target.closest(".order-item-row");
    if (row && event.target.name === "productName") {
      renderProductDropdown(row, true);
    }
  });

  dom.budgetItemsContainer.addEventListener("click", (event) => {
    const option = event.target.closest("[data-product-option]");
    if (option) {
      event.preventDefault();
      const row = option.closest(".order-item-row");
      const product = state.products.find((entry) => entry.id === Number(option.dataset.productOption));
      if (row && product) {
        selectProductForRow(row, product, updateBudgetTotals);
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-order-item]");
    if (!removeButton) {
      return;
    }

    removeButton.closest(".order-item-row")?.remove();
    if (!dom.budgetItemsContainer.children.length) {
      addBudgetItemRow();
    }
    updateBudgetTotals();
  });

  dom.budgetItemsContainer.addEventListener("input", (event) => {
    const row = event.target.closest(".order-item-row");
    if (row) {
      if (event.target.name === "productName") {
        renderProductDropdown(row, true);
      }
      updateOrderItemSummary(row);
      updateBudgetTotals();
    }
  });

  dom.budgetItemsContainer.addEventListener("focusin", (event) => {
    const row = event.target.closest(".order-item-row");
    if (row && event.target.name === "productName") {
      renderProductDropdown(row, true);
    }
  });

  dom.orderMultiplierSelect.addEventListener("change", () => {
    syncOrderMultiplierVisibility();
    refreshOpenOrderItemRows();
  });

  dom.orderMultiplierCustom.addEventListener("input", () => {
    refreshOpenOrderItemRows();
  });

  dom.orderTotalModeSelect.addEventListener("change", () => {
    syncOrderCustomTotalVisibility();
    updateOrderModalTotals();
  });

  dom.orderCustomTotalInput.addEventListener("input", () => {
    updateOrderModalTotals();
  });

  dom.budgetMultiplierSelect.addEventListener("change", () => {
    syncBudgetMultiplierVisibility();
    updateBudgetTotals();
  });

  dom.budgetMultiplierCustom.addEventListener("input", () => {
    updateBudgetTotals();
  });

  dom.openInkCard.addEventListener("click", () => {
    dom.inkCard.classList.toggle("hidden");
    if (!dom.inkCard.classList.contains("hidden")) {
      dom.inkA4Faces.focus();
    }
  });

  dom.closeInkCard.addEventListener("click", () => {
    dom.inkCard.classList.add("hidden");
  });

  dom.inkA4Faces.addEventListener("input", updateInkCalculator);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.closeModal)));
  });

  [dom.productModal, dom.orderModal, dom.deleteModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMaterialDropdowns();
      closeAllProductDropdowns();
      closeModal(dom.productModal);
      closeModal(dom.orderModal);
      closeModal(dom.deleteModal);
      dom.inkCard.classList.add("hidden");
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".material-combobox")) {
      closeAllMaterialDropdowns();
    }
    if (!event.target.closest(".product-combobox")) {
      closeAllProductDropdowns();
    }
    if (!event.target.closest(".ink-widget")) {
      dom.inkCard.classList.add("hidden");
    }
  });
}

async function loadAllData() {
  try {
    const [materials, products, orders] = await Promise.all([
      fetchJson("/api/materials"),
      fetchJson("/api/products"),
      fetchJson("/api/orders"),
    ]);

    state.materials = materials;
    state.products = products;
    state.orders = orders;

    renderMaterials();
    renderProducts();
    renderOrders();
    renderCalendar();
    renderProductCategoryPills();
    renderProductOptions();
    resetBudgetPlanner();
    updateStats();
    updateInkCalculator();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function activateSection(sectionName) {
  dom.sectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === sectionName);
  });

  dom.sections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionName}`);
  });
}

function renderMaterials() {
  const rows = state.materials.length ? state.materials : [createEmptyMaterial()];
  dom.materialsBody.innerHTML = rows.map((material) => materialRowTemplate(material)).join("");
  Array.from(dom.materialsBody.querySelectorAll("tr")).forEach(updateMaterialUnitPrice);
  applyMaterialFilter();
}

function applyMaterialFilter() {
  const searchTerm = state.materialSearchTerm;
  Array.from(dom.materialsBody.querySelectorAll("tr")).forEach((row) => {
    const nameInput = row.querySelector('[name="name"]');
    const name = nameInput?.value.trim().toLocaleLowerCase() || "";
    row.classList.toggle("hidden", Boolean(searchTerm) && !name.includes(searchTerm));
  });
}

function renderProducts() {
  const visibleProducts = getFilteredProducts();

  if (!visibleProducts.length) {
    dom.productsBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          ${state.products.length ? "No hay productos que coincidan con el filtro actual." : "Todavía no hay productos cargados."}
        </td>
      </tr>
    `;
    return;
  }

  dom.productsBody.innerHTML = visibleProducts
    .map(
      (product) => `
        <tr>
          <td>
            <div class="strong-cell">${escapeHtml(product.name)}</div>
          </td>
          <td>
            <span class="product-badge">${escapeHtml(product.category)}</span>
          </td>
          <td>
            <div class="product-badges">
              ${product.materials.length
                ? product.materials
                    .map(
                      (material) => `
                        <span class="product-badge">
                          ${escapeHtml(material.materialName)} x ${formatQuantity(material.quantity)} ${escapeHtml(material.unit)}
                        </span>
                      `
                    )
                    .join("")
                : `<span class="product-badge">Sin materiales</span>`}
            </div>
          </td>
          <td><span class="money">${formatMoney(product.price)}</span></td>
          <td>${escapeHtml(product.notes || "-")}</td>
          <td>
            <div class="order-actions">
              <button class="icon-button" type="button" data-edit-product="${product.id}" aria-label="Editar producto">
                ${pencilIcon()}
              </button>
              <button class="icon-button delete" type="button" data-delete-product="${product.id}" aria-label="Eliminar producto">
                ${crossIcon()}
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function getFilteredOrders() {
  return state.orders.filter((order) => {
    const matchesSearch = (() => {
      if (!state.orderSearchTerm) {
        return true;
      }

      const haystack = [
        order.client,
        order.contact,
        ...order.items.map((item) => item.productName),
      ]
        .join(" ")
        .toLocaleLowerCase();

      return haystack.includes(state.orderSearchTerm);
    })();

    const matchesDateFrom = !state.orderDateFrom || order.date >= state.orderDateFrom;
    const matchesDateTo = !state.orderDateTo || order.date <= state.orderDateTo;
    const matchesDelivery =
      state.orderDeliveryFilter === "all"
        ? true
        : state.orderDeliveryFilter === "delivered"
          ? Boolean(order.delivered)
          : state.orderDeliveryFilter === "prepared"
            ? Boolean(order.prepared) && !order.delivered
          : !order.delivered;

    return matchesSearch && matchesDateFrom && matchesDateTo && matchesDelivery;
  });
}

function renderProductCategoryPills() {
  const categories = ["Todos", ...appConfig.productCategories];
  dom.productCategoryPills.innerHTML = categories
    .map(
      (category) => `
        <button
          class="category-pill ${state.selectedProductCategories.has(category) ? "active" : ""}"
          type="button"
          data-category-filter="${escapeAttribute(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `
    )
    .join("");
}

function renderOrders() {
  if (!state.orders.length) {
    state.selectedOrderIds.clear();
    syncBulkOrdersToolbar();
    dom.ordersBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">Todavía no hay pedidos cargados.</td>
      </tr>
    `;
    return;
  }

  const visibleOrders = sortOrdersByDelivery(getFilteredOrders());

  if (!visibleOrders.length) {
    syncBulkOrdersToolbar();
    dom.ordersBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">No hay pedidos que coincidan con los filtros actuales.</td>
      </tr>
    `;
    return;
  }

  dom.ordersBody.innerHTML = visibleOrders
    .map(
      (order) => {
        const urgencyClass = getOrderDeliveryUrgencyClass(order);
        return `
        <tr class="${urgencyClass}">
          <td>${formatDate(order.date)}</td>
          <td>${escapeHtml(order.client)}</td>
          <td>${renderOrderContactCell(order.contact)}</td>
          <td>
            <div class="product-badges">
              ${order.items
                .map(
                  (item) => `
                    <span class="product-badge">
                      ${escapeHtml(item.productName)} x ${formatQuantity(item.quantity)}
                    </span>
                  `
                )
                .join("")}
            </div>
          </td>
          <td><span class="money">${formatMoney(order.total)}</span></td>
          <td>
            <span class="money ${order.balance > 0 ? "pending" : "ok"}">
              ${formatMoney(order.balance)}
            </span>
          </td>
          <td>
            <div class="status-badges">
              ${order.statusTags
                .map((tag) => `<span class="status-badge ${statusClass(tag)}">${escapeHtml(tag)}</span>`)
                .join("")}
            </div>
          </td>
          <td>${order.deliveryDate ? formatDate(order.deliveryDate) : "-"}</td>
          <td class="order-select-cell">
            <input
              class="order-select-input"
              type="checkbox"
              data-select-order="${order.id}"
              ${state.selectedOrderIds.has(order.id) ? "checked" : ""}
              aria-label="Seleccionar pedido ${escapeAttribute(order.client)}"
            >
          </td>
          <td>
            <div class="order-actions">
              <button class="icon-button" type="button" data-edit-order="${order.id}" aria-label="Editar pedido">
                ${pencilIcon()}
              </button>
              <button class="icon-button delete" type="button" data-delete-order="${order.id}" aria-label="Eliminar pedido">
                ${crossIcon()}
              </button>
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join("");

  syncBulkOrdersToolbar(visibleOrders);
}

function syncBulkOrdersToolbar(visibleOrders = getFilteredOrders()) {
  const selectedCount = state.selectedOrderIds.size;
  dom.bulkOrdersToolbar.classList.toggle("hidden", selectedCount === 0);
  dom.bulkOrdersCount.textContent = `${selectedCount} ${selectedCount === 1 ? "seleccionado" : "seleccionados"}`;

  const visibleIds = visibleOrders.map((order) => order.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedOrderIds.has(id));
  dom.selectAllOrders.checked = allVisibleSelected;
  dom.selectAllOrders.indeterminate = !allVisibleSelected && visibleIds.some((id) => state.selectedOrderIds.has(id));
}

function toggleSelectAllVisibleOrders() {
  const visibleOrders = getFilteredOrders();
  if (dom.selectAllOrders.checked) {
    visibleOrders.forEach((order) => state.selectedOrderIds.add(order.id));
  } else {
    visibleOrders.forEach((order) => state.selectedOrderIds.delete(order.id));
  }
  renderOrders();
}

async function applyBulkOrderStatus() {
  if (!state.selectedOrderIds.size) {
    showToast("Seleccioná al menos un pedido.", "error");
    return;
  }

  try {
    await fetchJson("/api/orders/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: Array.from(state.selectedOrderIds),
        status: dom.bulkOrderStatus.value,
      }),
    });

    state.orders = await fetchJson("/api/orders");
    state.selectedOrderIds.clear();
    renderOrders();
    renderCalendar();
    updateStats();
    showToast("Pedidos actualizados.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCalendar() {
  const cursor = startOfMonth(state.calendarCursor);
  state.calendarCursor = cursor;
  dom.calendarMonthLabel.textContent = formatCalendarMonth(cursor);

  const firstDayOffset = (cursor.getDay() + 6) % 7;
  const gridStart = new Date(cursor);
  gridStart.setDate(cursor.getDate() - firstDayOffset);

  const countsByDate = getCalendarDeliveryCounts();
  const today = todayString();
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    const isoDate = formatDateIso(current);
    const count = countsByDate.get(isoDate) || 0;
    const isCurrentMonth = current.getMonth() === cursor.getMonth();
    const classes = ["calendar-day"];

    if (!isCurrentMonth) {
      classes.push("muted");
    }
    if (isoDate === today) {
      classes.push("today");
    }
    if (count >= 1 && count <= 3) {
      classes.push("green");
    } else if (count >= 4 && count <= 8) {
      classes.push("orange");
    } else if (count > 8) {
      classes.push("red");
    }

    days.push(`
      <article class="${classes.join(" ")}">
        <div class="calendar-day-header">
          <span class="calendar-day-number">${current.getDate()}</span>
          ${count ? `<span class="calendar-day-count">${count}</span>` : ""}
        </div>
        <div class="calendar-day-copy">
          ${count ? `${count} ${count === 1 ? "pedido pendiente" : "pedidos pendientes"}` : isCurrentMonth && isoDate === today ? "Hoy" : ""}
        </div>
      </article>
    `);
  }

  dom.calendarGrid.innerHTML = days.join("");
}

function getCalendarDeliveryCounts() {
  const counts = new Map();

  state.orders.forEach((order) => {
    if (!order.deliveryDate || order.delivered) {
      return;
    }
    counts.set(order.deliveryDate, (counts.get(order.deliveryDate) || 0) + 1);
  });

  return counts;
}

function shiftCalendarMonth(delta) {
  const next = new Date(state.calendarCursor);
  next.setMonth(next.getMonth() + delta, 1);
  state.calendarCursor = startOfMonth(next);
  renderCalendar();
}

function renderProductOptions() {
  dom.productOptions.innerHTML = state.products
    .map((product) => `<option value="${escapeAttribute(product.name)}"></option>`)
    .join("");
}

function updateStats() {
  const { from, to } = resolveStatsRange();
  const visibleOrders = getStatsFilteredOrders(from, to);
  const totals = calculateStatsTotals(visibleOrders);
  const series = buildStatsSeries(visibleOrders, from, to, state.statsMetric);

  dom.statsTotalCollected.textContent = formatMoney(totals.collected);
  dom.statsTotalProfit.textContent = formatMoney(totals.profit);
  dom.statsTotalCost.textContent = formatMoney(totals.cost);

  dom.statsMetricCards.forEach((card) => {
    const isActive = card.dataset.statMetric === state.statsMetric;
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  dom.statsChartTitle.textContent = statsMetricLabel(state.statsMetric);
  dom.statsChartMeta.textContent = `${visibleOrders.length} ${visibleOrders.length === 1 ? "pedido" : "pedidos"} entre ${formatDate(from)} y ${formatDate(to)}`;
  renderStatsChart(series, state.statsMetric, visibleOrders.length);
}

function resolveStatsRange() {
  const sortedDates = state.orders.map((order) => order.date).sort();
  const fallbackFrom = sortedDates[0] || todayString();
  const fallbackTo = sortedDates[sortedDates.length - 1] || todayString();

  let from = state.statsDateFrom || fallbackFrom;
  let to = state.statsDateTo || fallbackTo;

  if (from > to) {
    [from, to] = [to, from];
  }

  state.statsDateFrom = from;
  state.statsDateTo = to;
  dom.statsDateFrom.value = from;
  dom.statsDateTo.value = to;

  return { from, to };
}

function getStatsFilteredOrders(from, to) {
  return state.orders.filter((order) => order.date >= from && order.date <= to);
}

function calculateStatsTotals(orders) {
  return orders.reduce(
    (totals, order) => {
      const cost = calculateOrderCost(order);
      totals.collected += Number(order.paidAmount || 0);
      totals.cost += cost;
      totals.profit += Number(order.total || 0) - cost;
      return totals;
    },
    { collected: 0, profit: 0, cost: 0 }
  );
}

function calculateOrderCost(order) {
  const cost = Number(order.costTotal || 0);
  return Number.isFinite(cost) ? cost : 0;
}

function calculateMetricValue(order, metric) {
  if (metric === "collected") {
    return Number(order.paidAmount || 0);
  }
  if (metric === "cost") {
    return calculateOrderCost(order);
  }
  return Number(order.total || 0) - calculateOrderCost(order);
}

function buildStatsSeries(orders, from, to, metric) {
  const amountByDate = new Map();

  orders.forEach((order) => {
    amountByDate.set(
      order.date,
      (amountByDate.get(order.date) || 0) + calculateMetricValue(order, metric)
    );
  });

  const current = new Date(`${from}T00:00:00`);
  const limit = new Date(`${to}T00:00:00`);
  const series = [];
  let cumulative = 0;

  while (current <= limit) {
    const isoDate = formatDateIso(current);
    cumulative += amountByDate.get(isoDate) || 0;
    series.push({
      date: isoDate,
      label: formatDate(isoDate),
      cumulative,
    });
    current.setDate(current.getDate() + 1);
  }

  return series;
}

function renderStatsChart(series, metric, orderCount) {
  if (!series.length) {
    dom.statsChart.innerHTML = `
      <div class="stats-chart-empty">
        No hay datos para graficar en el período seleccionado.
      </div>
    `;
    return;
  }

  const width = 920;
  const height = 320;
  const paddingTop = 20;
  const paddingRight = 24;
  const paddingBottom = 44;
  const paddingLeft = 78;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...series.map((point) => point.cumulative), 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const bottomY = paddingTop + chartHeight;

  const xForIndex = (index) =>
    paddingLeft + (series.length === 1 ? chartWidth / 2 : (index / (series.length - 1)) * chartWidth);
  const yForValue = (value) => paddingTop + chartHeight - (value / safeMax) * chartHeight;

  const linePoints = series
    .map((point, index) => `${xForIndex(index)},${yForValue(point.cumulative)}`)
    .join(" ");

  const areaPath = [
    `M ${xForIndex(0)} ${bottomY}`,
    ...series.map((point, index) => `L ${xForIndex(index)} ${yForValue(point.cumulative)}`),
    `L ${xForIndex(series.length - 1)} ${bottomY}`,
    "Z",
  ].join(" ");

  const ySteps = 4;
  const gridLines = Array.from({ length: ySteps + 1 }, (_, index) => {
    const value = safeMax * ((ySteps - index) / ySteps);
    const y = yForValue(value);
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(192, 129, 142, 0.18)" stroke-width="1"></line>
      <text x="${paddingLeft - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#94717b">${escapeHtml(formatCompactMoney(value))}</text>
    `;
  }).join("");

  const labelIndices = pickChartLabelIndices(series.length);
  const xLabels = labelIndices
    .map((index) => {
      const point = series[index];
      return `
        <text x="${xForIndex(index)}" y="${height - 10}" text-anchor="middle" font-size="12" fill="#94717b">
          ${escapeHtml(point.label)}
        </text>
      `;
    })
    .join("");

  const lastPoint = series[series.length - 1];
  const lastX = xForIndex(series.length - 1);
  const lastY = yForValue(lastPoint.cumulative);
  const subtitle =
    orderCount > 0
      ? `Acumulado diario de ${statsMetricLabel(metric).toLocaleLowerCase()}. Valor final: ${formatMoney(lastPoint.cumulative)}.`
      : `No hay pedidos dentro del período; la curva queda en ${formatMoney(0)}.`;

  dom.statsChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(statsMetricLabel(metric))}">
      ${gridLines}
      <path d="${areaPath}" fill="rgba(240, 144, 160, 0.16)"></path>
      <polyline points="${linePoints}" fill="none" stroke="#da7385" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${lastX}" cy="${lastY}" r="6" fill="#f090a0" stroke="#ffffff" stroke-width="3"></circle>
      <line x1="${paddingLeft}" y1="${bottomY}" x2="${width - paddingRight}" y2="${bottomY}" stroke="rgba(192, 129, 142, 0.26)" stroke-width="1.2"></line>
      ${xLabels}
    </svg>
    <div class="calendar-day-copy">${escapeHtml(subtitle)}</div>
  `;
}

function pickChartLabelIndices(length) {
  if (length <= 1) {
    return [0];
  }

  const desiredLabels = Math.min(6, length);
  const indices = new Set([0, length - 1]);

  for (let step = 1; step < desiredLabels - 1; step += 1) {
    indices.add(Math.round((step * (length - 1)) / (desiredLabels - 1)));
  }

  return Array.from(indices).sort((left, right) => left - right);
}

function statsMetricLabel(metric) {
  if (metric === "cost") {
    return "Total costo";
  }
  if (metric === "profit") {
    return "Total ganancia";
  }
  return "Total cobrado";
}

function getFilteredProducts() {
  const selectedCategories = state.selectedProductCategories;
  const searchTerm = state.productSearchTerm;
  const showAll = selectedCategories.has("Todos");

  return state.products.filter((product) => {
    const matchesCategory = showAll || selectedCategories.has(product.category);
    const matchesSearch =
      !searchTerm || product.name.toLocaleLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function toggleCategoryFilter(category) {
  if (category === "Todos") {
    state.selectedProductCategories = new Set(["Todos"]);
    renderProductCategoryPills();
    renderProducts();
    return;
  }

  const nextSelection = new Set(state.selectedProductCategories);
  nextSelection.delete("Todos");

  if (nextSelection.has(category)) {
    nextSelection.delete(category);
  } else {
    nextSelection.add(category);
  }

  state.selectedProductCategories = nextSelection.size ? nextSelection : new Set(["Todos"]);
  renderProductCategoryPills();
  renderProducts();
}

function addMaterialRow() {
  dom.materialsBody.insertAdjacentHTML("beforeend", materialRowTemplate(createEmptyMaterial()));
  const newRow = dom.materialsBody.lastElementChild;
  if (newRow) {
    updateMaterialUnitPrice(newRow);
    applyMaterialFilter();
    newRow.querySelector('[name="name"]')?.focus();
  }
}

async function saveMaterials() {
  try {
    const materials = collectMaterialsFromTable();
    await fetchJson("/api/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materials }),
    });

    const [freshMaterials, freshProducts] = await Promise.all([
      fetchJson("/api/materials"),
      fetchJson("/api/products"),
    ]);
    state.materials = freshMaterials;
    state.products = freshProducts;

    renderMaterials();
    renderProducts();
    renderProductOptions();
    updateStats();
    refreshOpenProductMaterialRows();
    refreshOpenOrderItemRows();
    refreshBudgetItemRows();
    showToast("Materiales guardados.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function collectMaterialsFromTable() {
  return Array.from(dom.materialsBody.querySelectorAll("tr"))
    .map((row, index) => {
      const data = {
        id: row.dataset.id || null,
        name: row.querySelector('[name="name"]').value.trim(),
        bundleQuantity: row.querySelector('[name="bundleQuantity"]').value.trim(),
        bundlePrice: row.querySelector('[name="bundlePrice"]').value.trim(),
        unit: row.querySelector('[name="unit"]').value,
      };

      if (!data.name && !data.bundleQuantity && !data.bundlePrice) {
        return null;
      }

      if (!data.name || !data.bundleQuantity || !data.bundlePrice || !data.unit) {
        throw new Error(`Completá todos los campos del material en la fila ${index + 1}.`);
      }

      return data;
    })
    .filter(Boolean);
}

function openProductModal(product = null) {
  state.editingProductId = product ? product.id : null;
  dom.productForm.reset();
  dom.productMaterialsContainer.innerHTML = "";

  dom.productModalTitle.textContent = product ? "Editar Producto" : "Crear Producto";
  dom.productModalKicker.textContent = product ? "Edición" : "Nuevo producto";
  dom.productSubmitButton.textContent = product ? "Guardar Cambios" : "Guardar Producto";

  dom.productForm.elements.name.value = product?.name || "";
  dom.productForm.elements.category.value = product?.category || appConfig.productCategories[0];
  dom.productForm.elements.notes.value = product?.notes || "";

  if (product?.materials?.length) {
    product.materials.forEach((material) => addProductMaterialRow(material));
  } else {
    addProductMaterialRow();
  }

  updateProductModalTotal();
  openModal(dom.productModal);
}

function addProductMaterialRow(component = null) {
  dom.productMaterialsContainer.insertAdjacentHTML("beforeend", productMaterialTemplate(component));
  const row = dom.productMaterialsContainer.lastElementChild;
  if (row) {
    updateProductMaterialRow(row);
    row.querySelector('[name="materialName"]')?.focus();
  }
}

function refreshOpenProductMaterialRows() {
  if (dom.productModal.classList.contains("hidden")) {
    return;
  }

  const currentRows = Array.from(dom.productMaterialsContainer.querySelectorAll(".product-material-row")).map((row) => ({
    materialName: row.querySelector('[name="materialName"]').value,
    quantity: row.querySelector('[name="quantity"]').value,
  }));

  dom.productMaterialsContainer.innerHTML = "";
  if (currentRows.length) {
    currentRows.forEach((row) => addProductMaterialRow(row));
  } else {
    addProductMaterialRow();
  }
  updateProductModalTotal();
}

function updateProductMaterialRow(row) {
  const nameInput = row.querySelector('[name="materialName"]');
  const material = findMaterialByName(nameInput.value.trim());
  const quantity = Number.parseFloat(row.querySelector('[name="quantity"]').value);
  const unitNode = row.querySelector("[data-material-unit]");
  const unitPriceNode = row.querySelector("[data-material-unit-price]");
  const subtotalNode = row.querySelector("[data-material-subtotal]");

  if (!material) {
    row.dataset.materialId = "";
    unitNode.textContent = "-";
    unitPriceNode.textContent = formatMoney(0);
    subtotalNode.textContent = formatMoney(0);
    return;
  }

  row.dataset.materialId = String(material.id);
  unitNode.textContent = material.unit;
  unitPriceNode.textContent = formatMoney(material.unitPrice);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    subtotalNode.textContent = formatMoney(0);
    return;
  }

  subtotalNode.textContent = formatMoney(material.unitPrice * quantity);
}

function renderMaterialDropdown(row, shouldOpen) {
  const menu = row.querySelector("[data-material-menu]");
  const input = row.querySelector('[name="materialName"]');
  if (!menu || !input) {
    return;
  }

  closeAllMaterialDropdowns(row);

  if (!shouldOpen) {
    menu.classList.add("hidden");
    return;
  }

  const query = input.value.trim().toLocaleLowerCase();
  const matches = state.materials
    .filter((material) => !query || material.name.toLocaleLowerCase().includes(query))
    .slice(0, 12);

  menu.innerHTML = matches.length
    ? matches
        .map(
          (material) => `
            <button
              class="material-option"
              type="button"
              data-material-option="${material.id}"
            >
              <span>${escapeHtml(material.name)}</span>
              <small>${escapeHtml(material.unit)}</small>
            </button>
          `
        )
        .join("")
    : `<div class="material-option-empty">Sin coincidencias</div>`;

  menu.classList.remove("hidden");
}

function selectMaterialForRow(row, material) {
  const input = row.querySelector('[name="materialName"]');
  if (!input) {
    return;
  }

  input.value = material.name;
  updateProductMaterialRow(row);
  updateProductModalTotal();
  renderMaterialDropdown(row, false);
}

function closeAllMaterialDropdowns(exceptRow = null) {
  dom.productMaterialsContainer.querySelectorAll("[data-material-menu]").forEach((menu) => {
    if (exceptRow && exceptRow.contains(menu)) {
      return;
    }
    menu.classList.add("hidden");
  });
}

function updateProductModalTotal() {
  const total = Array.from(dom.productMaterialsContainer.querySelectorAll(".product-material-row")).reduce(
    (accumulator, row) => {
      const material = findMaterialByName(row.querySelector('[name="materialName"]').value.trim());
      const quantity = Number.parseFloat(row.querySelector('[name="quantity"]').value);
      if (!material || !Number.isFinite(quantity) || quantity <= 0) {
        return accumulator;
      }
      return accumulator + material.unitPrice * quantity;
    },
    0
  );

  dom.productTotalCost.textContent = formatMoney(total);
}

async function submitProductForm(event) {
  event.preventDefault();

  try {
    const isEditing = Boolean(state.editingProductId);
    const payload = {
      name: dom.productForm.elements.name.value.trim(),
      category: dom.productForm.elements.category.value,
      notes: dom.productForm.elements.notes.value.trim(),
      components: collectProductComponents(),
    };

    const endpoint = state.editingProductId ? `/api/products/${state.editingProductId}` : "/api/products";
    const method = state.editingProductId ? "PUT" : "POST";

    await fetchJson(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.products = await fetchJson("/api/products");
    renderProducts();
    renderProductOptions();
    updateStats();
    refreshOpenOrderItemRows();
    refreshBudgetItemRows();
    closeModal(dom.productModal);
    showToast(isEditing ? "Producto actualizado." : "Producto creado.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function collectProductComponents() {
  const rows = Array.from(dom.productMaterialsContainer.querySelectorAll(".product-material-row"));
  if (!rows.length) {
    throw new Error("Agregá al menos un material al producto.");
  }

  return rows.map((row, index) => {
    const materialName = row.querySelector('[name="materialName"]').value.trim();
    const quantity = row.querySelector('[name="quantity"]').value.trim();
    const matchedMaterial = findMaterialByName(materialName);

    if (!materialName || !quantity) {
      throw new Error(`Completá material y cantidad en la fila ${index + 1}.`);
    }
    if (!matchedMaterial) {
      throw new Error(`El material "${materialName}" no existe en la base local.`);
    }

    return {
      materialId: matchedMaterial.id,
      quantity,
    };
  });
}

function openOrderModal(order = null) {
  state.editingOrderId = order ? order.id : null;

  dom.orderModalTitle.textContent = order ? "Editar Pedido" : "Crear Pedido";
  dom.orderModalKicker.textContent = order ? "Edición" : "Nuevo pedido";
  dom.orderSubmitButton.textContent = order ? "Guardar Cambios" : "Guardar Pedido";

  dom.orderForm.reset();
  dom.orderItemsContainer.innerHTML = "";

  dom.orderForm.elements.date.value = order?.date || todayString();
  dom.orderForm.elements.client.value = order?.client || "";
  dom.orderForm.elements.contact.value = order?.contact || "";
  dom.orderForm.elements.paidAmount.value = order?.paidAmount ?? 0;
  dom.orderForm.elements.paymentMethod.value = order?.paymentMethod || appConfig.paymentMethods[0];
  dom.orderForm.elements.prepared.value = order?.prepared ? "1" : "0";
  dom.orderForm.elements.delivered.value = order?.delivered ? "1" : "0";
  dom.orderForm.elements.deliveryDate.value = order?.deliveryDate || "";
  dom.orderForm.elements.notes.value = order?.notes || "";
  setOrderMultiplier(order?.multiplier ?? 2.15);
  setOrderCustomTotal(order?.usesCustomTotal, order?.customTotal);

  if (order?.items?.length) {
    order.items.forEach((item) => addOrderItemRow(item));
  } else {
    addOrderItemRow();
  }

  refreshOpenOrderItemRows();
  openModal(dom.orderModal);
}

function addOrderItemRow(item = null) {
  dom.orderItemsContainer.insertAdjacentHTML("beforeend", orderItemTemplate(item));
  const row = dom.orderItemsContainer.lastElementChild;
  if (row) {
    updateOrderItemSummary(row);
    updateOrderModalTotals();
    row.querySelector('[name="productName"]')?.focus();
  }
}

function addBudgetItemRow(item = null) {
  dom.budgetItemsContainer.insertAdjacentHTML("beforeend", orderItemTemplate(item));
  const row = dom.budgetItemsContainer.lastElementChild;
  if (row) {
    updateOrderItemSummary(row);
    updateBudgetTotals();
    row.querySelector('[name="productName"]')?.focus();
  }
}

function refreshOpenOrderItemRows() {
  if (dom.orderModal.classList.contains("hidden")) {
    return;
  }
  refreshItemSummaries(dom.orderItemsContainer, updateOrderModalTotals);
}

function refreshBudgetItemRows() {
  refreshItemSummaries(dom.budgetItemsContainer, updateBudgetTotals);
}

function refreshItemSummaries(container, afterRefresh) {
  container.querySelectorAll(".order-item-row").forEach(updateOrderItemSummary);
  afterRefresh();
}

function resetBudgetPlanner() {
  dom.budgetItemsContainer.innerHTML = "";
  setBudgetMultiplier(2.15);
  addBudgetItemRow();
  updateBudgetTotals();
}

function updateBudgetTotals() {
  updatePricingSummary({
    itemsContainer: dom.budgetItemsContainer,
    multiplierSelect: dom.budgetMultiplierSelect,
    multiplierCustom: dom.budgetMultiplierCustom,
    totalCostNode: dom.budgetTotalCost,
    totalPriceNode: dom.budgetTotalPrice,
  });
}

function updatePricingSummary({
  itemsContainer,
  multiplierSelect,
  multiplierCustom,
  totalCostNode,
  totalPriceNode,
  totalModeSelect = null,
  customTotalInput = null,
}) {
  const costTotal = calculateItemsCostTotal(itemsContainer);
  const multiplier = getMultiplierValue(multiplierSelect, multiplierCustom);
  const automaticTotal = Number.isFinite(multiplier) && multiplier > 0 ? costTotal * multiplier : 0;
  const total =
    totalModeSelect?.value === "custom"
      ? getCustomTotalValue(customTotalInput)
      : automaticTotal;

  totalCostNode.textContent = formatMoney(costTotal);
  totalPriceNode.textContent = formatMoney(total);
}

function calculateItemsCostTotal(container) {
  return Array.from(container.querySelectorAll(".order-item-row")).reduce((accumulator, row) => {
    const product = findProductByName(row.querySelector('[name="productName"]').value.trim());
    const quantity = Number.parseFloat(row.querySelector('[name="quantity"]').value);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      return accumulator;
    }
    return accumulator + product.price * quantity;
  }, 0);
}

async function submitOrderForm(event) {
  event.preventDefault();

  try {
    const isEditing = Boolean(state.editingOrderId);
    const payload = {
      date: dom.orderForm.elements.date.value,
      client: dom.orderForm.elements.client.value.trim(),
      contact: dom.orderForm.elements.contact.value.trim(),
      multiplier: collectOrderMultiplier(),
      usesCustomTotal: dom.orderTotalModeSelect.value === "custom",
      customTotal: dom.orderCustomTotalInput.value,
      paidAmount: dom.orderForm.elements.paidAmount.value,
      paymentMethod: dom.orderForm.elements.paymentMethod.value,
      prepared: dom.orderForm.elements.prepared.value,
      delivered: dom.orderForm.elements.delivered.value,
      deliveryDate: dom.orderForm.elements.deliveryDate.value,
      notes: dom.orderForm.elements.notes.value.trim(),
      items: collectOrderItems(),
    };

    const endpoint = state.editingOrderId ? `/api/orders/${state.editingOrderId}` : "/api/orders";
    const method = state.editingOrderId ? "PUT" : "POST";

    await fetchJson(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.orders = await fetchJson("/api/orders");
    renderOrders();
    renderCalendar();
    updateStats();
    closeModal(dom.orderModal);
    showToast(isEditing ? "Pedido actualizado." : "Pedido creado.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function collectOrderItems() {
  const rows = Array.from(dom.orderItemsContainer.querySelectorAll(".order-item-row"));
  if (!rows.length) {
    throw new Error("Agregá al menos un producto al pedido.");
  }

  return rows.map((row, index) => {
    const productName = row.querySelector('[name="productName"]').value.trim();
    const quantity = row.querySelector('[name="quantity"]').value.trim();
    const matchedProduct = findProductByName(productName);

    if (!productName || !quantity) {
      throw new Error(`Completá producto y cantidad en la fila ${index + 1}.`);
    }
    if (!matchedProduct) {
      throw new Error(`El producto "${productName}" no existe en la base local.`);
    }

    row.dataset.productId = String(matchedProduct.id);
    return {
      productId: matchedProduct.id,
      productName: matchedProduct.name,
      quantity,
    };
  });
}

function updateOrderItemSummary(row) {
  const nameInput = row.querySelector('[name="productName"]');
  const quantityInput = row.querySelector('[name="quantity"]');
  const summary = row.querySelector("[data-item-subtotal]");
  const product = findProductByName(nameInput.value.trim());
  const quantity = Number.parseFloat(quantityInput.value);

  if (product) {
    row.dataset.productId = String(product.id);
  } else {
    row.dataset.productId = "";
  }

  if (!product || !Number.isFinite(quantity) || quantity <= 0) {
    summary.textContent = formatMoney(0);
    return;
  }

  summary.textContent = formatMoney(product.price * quantity);
}

function renderProductDropdown(row, shouldOpen) {
  const menu = row.querySelector("[data-product-menu]");
  const input = row.querySelector('[name="productName"]');
  if (!menu || !input) {
    return;
  }

  closeAllProductDropdowns(row);

  if (!shouldOpen) {
    menu.classList.add("hidden");
    return;
  }

  const query = input.value.trim().toLocaleLowerCase();
  const matches = state.products
    .filter((product) => !query || product.name.toLocaleLowerCase().includes(query))
    .slice(0, 12);

  menu.innerHTML = matches.length
    ? matches
        .map(
          (product) => `
            <button
              class="material-option"
              type="button"
              data-product-option="${product.id}"
            >
              <span>${escapeHtml(product.name)}</span>
              <small>${formatMoney(product.price)}</small>
            </button>
          `
        )
        .join("")
    : `<div class="material-option-empty">Sin coincidencias</div>`;

  menu.classList.remove("hidden");
}

function selectProductForRow(row, product, onSelect) {
  const input = row.querySelector('[name="productName"]');
  if (!input) {
    return;
  }

  input.value = product.name;
  updateOrderItemSummary(row);
  onSelect();
  renderProductDropdown(row, false);
}

function closeAllProductDropdowns(exceptRow = null) {
  [dom.orderItemsContainer, dom.budgetItemsContainer].forEach((container) => {
    container.querySelectorAll("[data-product-menu]").forEach((menu) => {
      if (exceptRow && exceptRow.contains(menu)) {
        return;
      }
      menu.classList.add("hidden");
    });
  });
}

function getOrderMultiplierValue() {
  return getMultiplierValue(dom.orderMultiplierSelect, dom.orderMultiplierCustom);
}

function getMultiplierValue(select, customInput) {
  if (select.value === "custom") {
    const customPercent = Number.parseFloat(customInput.value);
    if (!Number.isFinite(customPercent) || customPercent <= 0) {
      return 0;
    }
    return customPercent / 100;
  }

  return Number.parseFloat(select.value) || 0;
}

function collectOrderMultiplier() {
  const multiplier = getOrderMultiplierValue();
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("Ingresá un multiplicador válido.");
  }
  return multiplier;
}

function setOrderMultiplier(multiplier) {
  setMultiplierControls(dom.orderMultiplierSelect, dom.orderMultiplierCustom, multiplier);
  syncOrderMultiplierVisibility();
}

function setBudgetMultiplier(multiplier) {
  setMultiplierControls(dom.budgetMultiplierSelect, dom.budgetMultiplierCustom, multiplier);
  syncBudgetMultiplierVisibility();
}

function setMultiplierControls(select, customInput, multiplier) {
  const normalized = Number.parseFloat(multiplier);
  if (Math.abs(normalized - 1.5) < 0.0001) {
    select.value = "1.5";
    customInput.value = "";
  } else if (Math.abs(normalized - 2.15) < 0.0001) {
    select.value = "2.15";
    customInput.value = "";
  } else {
    select.value = "custom";
    customInput.value = String(roundTo(normalized * 100, 2));
  }
}

function syncOrderMultiplierVisibility() {
  syncMultiplierVisibility(dom.orderMultiplierSelect, dom.orderMultiplierCustom);
}

function syncBudgetMultiplierVisibility() {
  syncMultiplierVisibility(dom.budgetMultiplierSelect, dom.budgetMultiplierCustom);
}

function syncMultiplierVisibility(select, customInput) {
  const isCustom = select.value === "custom";
  customInput.classList.toggle("hidden", !isCustom);
}

function setOrderCustomTotal(usesCustomTotal, customTotal) {
  dom.orderTotalModeSelect.value = usesCustomTotal ? "custom" : "automatic";
  dom.orderCustomTotalInput.value = usesCustomTotal ? String(roundTo(customTotal || 0, 2)) : "";
  syncOrderCustomTotalVisibility();
}

function syncOrderCustomTotalVisibility() {
  const isCustom = dom.orderTotalModeSelect.value === "custom";
  dom.orderCustomTotalInput.classList.toggle("hidden", !isCustom);
}

function getCustomTotalValue(input) {
  const value = Number.parseFloat(input?.value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function updateOrderModalTotals() {
  updatePricingSummary({
    itemsContainer: dom.orderItemsContainer,
    multiplierSelect: dom.orderMultiplierSelect,
    multiplierCustom: dom.orderMultiplierCustom,
    totalCostNode: dom.orderTotalCost,
    totalPriceNode: dom.orderTotalPrice,
    totalModeSelect: dom.orderTotalModeSelect,
    customTotalInput: dom.orderCustomTotalInput,
  });
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function openDeleteModal(config) {
  state.pendingDelete = config;
  dom.deleteModalTitle.textContent = config.title;
  dom.deleteModalCopy.textContent = config.copy;
  openModal(dom.deleteModal);
}

async function confirmDelete() {
  if (!state.pendingDelete) {
    return;
  }

  const { type, id } = state.pendingDelete;
  const endpoint = type === "product" ? `/api/products/${id}` : `/api/orders/${id}`;

  try {
    await fetchJson(endpoint, { method: "DELETE" });

    if (type === "product") {
      state.products = await fetchJson("/api/products");
      renderProducts();
      renderProductOptions();
      refreshOpenOrderItemRows();
      refreshBudgetItemRows();
      showToast("Producto eliminado.", "success");
    } else {
      state.orders = await fetchJson("/api/orders");
      renderOrders();
      renderCalendar();
      showToast("Pedido eliminado.", "success");
    }

    updateStats();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.pendingDelete = null;
    closeModal(dom.deleteModal);
  }
}

function updateMaterialUnitPrice(row) {
  const quantity = Number.parseFloat(row.querySelector('[name="bundleQuantity"]').value);
  const price = Number.parseFloat(row.querySelector('[name="bundlePrice"]').value);
  const output = row.querySelector("[data-unit-price]");

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
    output.textContent = formatMoney(0);
    return;
  }

  output.textContent = formatMoney(price / quantity);
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
  if (modal === dom.productModal) {
    state.editingProductId = null;
    closeAllMaterialDropdowns();
  }
  if (modal === dom.orderModal) {
    state.editingOrderId = null;
    closeAllProductDropdowns();
  }
  if (modal === dom.deleteModal) {
    state.pendingDelete = null;
  }
}

function findProductByName(name) {
  const normalized = name.trim().toLocaleLowerCase();
  return state.products.find((product) => product.name.toLocaleLowerCase() === normalized) || null;
}

function findMaterialByName(name) {
  const normalized = name.trim().toLocaleLowerCase();
  return state.materials.find((material) => material.name.toLocaleLowerCase() === normalized) || null;
}

function materialRowTemplate(material) {
  return `
    <tr data-id="${material.id ?? ""}">
      <td><input class="table-input" type="text" name="name" value="${escapeAttribute(material.name || "")}" placeholder="Ej. Cartón rígido"></td>
      <td><input class="table-input" type="number" min="0.0001" step="0.0001" name="bundleQuantity" value="${escapeAttribute(material.bundleQuantity ?? "")}" placeholder="0"></td>
      <td><input class="table-input" type="number" min="0" step="0.01" name="bundlePrice" value="${escapeAttribute(material.bundlePrice ?? "")}" placeholder="0"></td>
      <td>
        <select class="table-select" name="unit">
          ${appConfig.units
            .map(
              (unit) => `
                <option value="${escapeAttribute(unit)}" ${material.unit === unit ? "selected" : ""}>
                  ${escapeHtml(unit)}
                </option>
              `
            )
            .join("")}
        </select>
      </td>
      <td><span class="readonly-pill" data-unit-price>${formatMoney(material.unitPrice || 0)}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-button delete" type="button" data-remove-material aria-label="Quitar fila">
            ${crossIcon()}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function productMaterialTemplate(component) {
  const materialName = component?.materialName || "";
  return `
    <div class="product-material-row" data-material-id="${component?.materialId ?? ""}">
      <label>
        <span>Material</span>
        <div class="material-combobox">
          <input
            class="table-input"
            type="text"
            name="materialName"
            autocomplete="off"
            value="${escapeAttribute(materialName)}"
            placeholder="Escribí o elegí un material"
          >
          <div class="material-dropdown hidden" data-material-menu></div>
        </div>
      </label>
      <label>
        <span>Cantidad</span>
        <input
          class="table-input"
          type="number"
          min="0.0001"
          step="0.0001"
          name="quantity"
          value="${escapeAttribute(component?.quantity ?? "")}"
          placeholder="0"
        >
      </label>
      <div class="component-meta">
        <span>Unidad</span>
        <div class="readonly-pill small" data-material-unit>-</div>
      </div>
      <div class="component-meta">
        <span>Precio por unidad</span>
        <div class="readonly-pill small" data-material-unit-price>${formatMoney(0)}</div>
      </div>
      <div class="component-meta">
        <span>Subtotal</span>
        <div class="readonly-pill small" data-material-subtotal>${formatMoney(component?.subtotal || 0)}</div>
      </div>
      <div class="line-item-actions">
        <button class="icon-button delete" type="button" data-remove-product-material aria-label="Quitar material">
          ${crossIcon()}
        </button>
      </div>
    </div>
  `;
}

function orderItemTemplate(item) {
  return `
    <div class="order-item-row" data-product-id="${item?.productId ?? ""}">
      <label>
        <span>Producto</span>
        <div class="product-combobox">
          <input
            class="table-input"
            type="text"
            name="productName"
            autocomplete="off"
            value="${escapeAttribute(item?.productName || "")}"
            placeholder="Elegí un producto cargado"
          >
          <div class="material-dropdown hidden" data-product-menu></div>
        </div>
      </label>
      <label>
        <span>Cantidad</span>
        <input
          class="table-input"
          type="number"
          min="0.0001"
          step="0.0001"
          name="quantity"
          value="${escapeAttribute(item?.quantity ?? 1)}"
        >
      </label>
      <div>
        <span>Subtotal</span>
        <div class="order-summary" data-item-subtotal>${formatMoney(item?.subtotal || 0)}</div>
      </div>
      <div class="line-item-actions">
        <button class="icon-button delete" type="button" data-remove-order-item aria-label="Quitar producto">
          ${crossIcon()}
        </button>
      </div>
    </div>
  `;
}

function createEmptyMaterial() {
  return {
    id: null,
    name: "",
    bundleQuantity: "",
    bundlePrice: "",
    unit: appConfig.units[0],
    unitPrice: 0,
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCompactMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateIso(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarMonth(value) {
  return value.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  }).replace(/^./, (char) => char.toUpperCase());
}

function formatQuantity(value) {
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
    maximumFractionDigits: 4,
  });
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getDaysUntil(value) {
  const targetDate = parseIsoDate(value);
  if (!targetDate) {
    return Number.POSITIVE_INFINITY;
  }

  const today = startOfDay(new Date());
  const diffMs = targetDate.getTime() - today.getTime();
  return Math.floor(diffMs / 86400000);
}

function sortOrdersByDelivery(orders) {
  return [...orders].sort((left, right) => {
    const leftHasDelivery = Boolean(left.deliveryDate);
    const rightHasDelivery = Boolean(right.deliveryDate);

    if (leftHasDelivery && rightHasDelivery && left.deliveryDate !== right.deliveryDate) {
      return left.deliveryDate.localeCompare(right.deliveryDate);
    }

    if (leftHasDelivery !== rightHasDelivery) {
      return leftHasDelivery ? -1 : 1;
    }

    if (!leftHasDelivery && !rightHasDelivery) {
      const leftStatusPriority = getOrderStatusSortPriority(left);
      const rightStatusPriority = getOrderStatusSortPriority(right);

      if (leftStatusPriority !== rightStatusPriority) {
        return leftStatusPriority - rightStatusPriority;
      }
    }

    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.id - right.id;
  });
}

function getOrderStatusSortPriority(order) {
  if (order.delivered) {
    return 2;
  }
  if (order.prepared) {
    return 1;
  }
  return 0;
}

function getOrderDeliveryUrgencyClass(order) {
  if (!order.deliveryDate || order.delivered) {
    return "";
  }

  const daysUntilDelivery = getDaysUntil(order.deliveryDate);
  if (daysUntilDelivery <= 2) {
    return "order-row-urgent";
  }
  if (daysUntilDelivery <= 7) {
    return "order-row-warning";
  }
  return "";
}

function startOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function statusClass(tag) {
  if (tag === "Pendiente") {
    return "pending";
  }
  if (tag === "Entregado") {
    return "delivered";
  }
  if (tag === "Preparado") {
    return "prepared";
  }
  return "";
}

function renderOrderContactCell(contact) {
  const rawContact = String(contact || "").trim();
  if (!rawContact) {
    return "-";
  }

  const phone = normalizeWhatsappPhone(rawContact);
  if (!phone) {
    return escapeHtml(rawContact);
  }

  return `
    <a
      href="https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}"
      target="_blank"
      rel="noopener noreferrer"
      class="contact-link"
    >
      ${escapeHtml(rawContact)}
    </a>
  `;
}

function normalizeWhatsappPhone(contact) {
  const digits = String(contact).replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
}

function updateInkCalculator() {
  const faces = Number.parseFloat(dom.inkA4Faces.value);
  const ml = Number.isFinite(faces) && faces >= 0 ? faces * 0.5 : 0;
  dom.inkMlOutput.value = `${formatQuantity(ml)} ml`;
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "No se pudo completar la operación.");
  }
  return payload;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value ?? "");
}

function pencilIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
    </svg>
  `;
}

function crossIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M18 6 6 18"></path>
      <path d="M6 6l12 12"></path>
    </svg>
  `;
}
