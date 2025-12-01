// ==============================
//   EDITOR.JS — Полный файл
// ==============================

let editorMap;
let editorPlots = [];
let editorSelectedPlot = null;
let editorPlanOverlay = null;

// ---------------------------------------
// СТИЛИ ПО СТАТУСУ
// ---------------------------------------
function editorStatusClass(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("муниц")) return "status-municipal";
  if (s.includes("прод")) return "status-sold";
  if (s.includes("резерв")) return "status-reserved";
  return "status-free";
}

function editorStatusDotClass(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("муниц")) return "dot-municipal";
  if (s.includes("прод")) return "dot-sold";
  if (s.includes("резерв")) return "dot-reserved";
  return "dot-free";
}

function editorColorsByStatus(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("муниц")) {
    return {
      fill: "rgba(59,130,246,0.35)",
      stroke: "#1D4ED8"
    };
  }
  if (s.includes("прод")) {
    return {
      fill: "rgba(239,68,68,0.35)",
      stroke: "#B91C1C"
    };
  }
  if (s.includes("резерв")) {
    return {
      fill: "rgba(234,179,8,0.35)",
      stroke: "#B45309"
    };
  }
  return {
    fill: "rgba(34,197,94,0.35)",
    stroke: "#15803D"
  };
}

// ---------------------------------------
// ЧТЕНИЕ / ЗАПИСЬ ФОРМЫ
// ---------------------------------------
function editorFillForm(plot) {
  document.getElementById("fieldId").value = plot.id || "";
  document.getElementById("fieldName").value = plot.name || "";
  document.getElementById("fieldStatus").value = plot.status || "Свободен";
  document.getElementById("fieldArea").value = plot.area || "";
  document.getElementById("fieldAreaValue").value = plot.areaValue ?? "";
  document.getElementById("fieldPrice").value = plot.price || "";
  document.getElementById("fieldPriceValue").value = plot.priceValue ?? "";
  document.getElementById("fieldVri").value = plot.vri || "";
  document.getElementById("fieldPurpose").value = plot.purpose || "";
  document.getElementById("fieldProjectDescription").value = plot.projectDescription || "";
  document.getElementById("fieldComment").value = plot.comment || "";
  document.getElementById("fieldZone").value = plot.zone || "";
}

function editorReadFormIntoPlot(plot) {
  plot.id = document.getElementById("fieldId").value.trim() || plot.id;
  plot.name = document.getElementById("fieldName").value.trim();
  plot.status = document.getElementById("fieldStatus").value.trim();
  plot.area = document.getElementById("fieldArea").value.trim();
  const areaVal = document.getElementById("fieldAreaValue").value.trim();
  plot.areaValue = areaVal ? Number(areaVal) : null;

  plot.price = document.getElementById("fieldPrice").value.trim();
  const priceVal = document.getElementById("fieldPriceValue").value.trim();
  plot.priceValue = priceVal ? Number(priceVal) : null;

  plot.vri = document.getElementById("fieldVri").value.trim();
  plot.purpose = document.getElementById("fieldPurpose").value.trim();
  plot.projectDescription = document.getElementById("fieldProjectDescription").value.trim();
  plot.comment = document.getElementById("fieldComment").value.trim();
  plot.zone = document.getElementById("fieldZone").value.trim();
}

// ---------------------------------------
// ОТРИСОВКА УЧАСТКОВ НА КАРТЕ
// ---------------------------------------
function editorRenderPlots() {
  if (!editorMap) return;

  editorPlots.forEach(plot => {
    if (plot.polygon) {
      editorMap.geoObjects.remove(plot.polygon);
      plot.polygon = null;
    }

    if (!plot.coords || !Array.isArray(plot.coords) || plot.coords.length < 3) return;

    const c = editorColorsByStatus(plot.status);

    const polygon = new ymaps.Polygon(
      [plot.coords.map(([lon, lat]) => [lat, lon])],
      {
        hintContent: plot.name || `Участок ${plot.id}`,
        plotId: plot.id
      },
      {
        fillColor: c.fill,
        strokeColor: c.stroke,
        strokeWidth: 2,
        draggable: true,
        fillOpacity: 0.6
      }
    );

    polygon.editor = polygon.editor || null;

    polygon.events.add("click", () => {
      editorSelectPlot(plot, true);
    });

    editorMap.geoObjects.add(polygon);
    plot.polygon = polygon;
  });
}

// ---------------------------------------
// ВЫБОР УЧАСТКА
// ---------------------------------------
function editorSelectPlot(plot, centerTo) {
  editorSelectedPlot = plot;
  editorFillForm(plot);
  editorHighlightSelectedCard();

  if (centerTo && plot.coords && plot.coords.length) {
    const bounds = ymaps.util.bounds.fromPoints(
      plot.coords.map(([lon, lat]) => [lat, lon])
    );
    editorMap.setBounds(bounds, { checkZoomRange: true, duration: 300 });
  }

  if (plot.polygon) {
    try {
      if (!plot.polygon.editor) {
        plot.polygon.editor = plot.polygon.editor || null;
      }
      plot.polygon.editor && plot.polygon.editor.startEditing();
    } catch (e) {
      console.warn("Не удалось запустить редактирование полигона:", e);
    }
  }
}

function editorHighlightSelectedCard() {
  const cards = document.querySelectorAll(".plot-card");
  cards.forEach(c => c.classList.remove("selected"));

  if (editorSelectedPlot) {
    const el = document.querySelector(
      `.plot-card[data-plot-id="${editorSelectedPlot.id}"]`
    );
    if (el) el.classList.add("selected");
  }
}

// ---------------------------------------
// СОХРАНЕНИЕ ТЕКУЩЕГО УЧАСТКА
// ---------------------------------------
function editorSaveCurrentPlot() {
  if (!editorSelectedPlot) {
    alert("Сначала выберите участок.");
    return;
  }

  if (editorSelectedPlot.polygon && editorSelectedPlot.polygon.geometry) {
    const coords = editorSelectedPlot.polygon.geometry.getCoordinates();
    if (!coords || !coords[0] || coords[0].length < 3) {
      alert("Участок должен содержать минимум 3 точки.");
      return;
    }

    editorSelectedPlot.coords = coords[0].map(([lat, lon]) => [lon, lat]);
  }

  editorReadFormIntoPlot(editorSelectedPlot);

  const c = editorColorsByStatus(editorSelectedPlot.status);
  editorSelectedPlot.polygon.options.set({
    fillColor: c.fill,
    strokeColor: c.stroke
  });

  editorRenderCards();
  alert("Изменения по участку сохранены (в памяти редактора). Не забудь выгрузить JSON.");
}

// ---------------------------------------
// УДАЛЕНИЕ УЧАСТКА
// ---------------------------------------
function editorDeleteCurrentPlot() {
  if (!editorSelectedPlot) {
    alert("Сначала выберите участок для удаления.");
    return;
  }
  if (!confirm(`Удалить участок "${editorSelectedPlot.name || editorSelectedPlot.id}"?`)) {
    return;
  }

  if (editorSelectedPlot.polygon) {
    editorMap.geoObjects.remove(editorSelectedPlot.polygon);
  }

  editorPlots = editorPlots.filter(p => p !== editorSelectedPlot);
  editorSelectedPlot = null;
  editorFillForm({
    id: "",
    name: "",
    status: "Свободен",
    area: "",
    areaValue: "",
    price: "",
    priceValue: "",
    vri: "",
    purpose: "",
    projectDescription: "",
    comment: "",
    zone: ""
  });

  editorRenderCards();
  alert("Удалено.");
}

// ---------------------------------------
// СПИСОК УЧАСТКОВ (карточки)
// ---------------------------------------
function editorRenderCards() {
  const container = document.getElementById("cardsContainer");
  container.innerHTML = "";

  editorPlots
    .slice()
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    .forEach(plot => {
      const card = document.createElement("div");
      card.className = "plot-card";
      card.dataset.plotId = plot.id;

      if (editorSelectedPlot && editorSelectedPlot.id === plot.id)
        card.classList.add("selected");

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <div><strong>${plot.name}</strong></div>
          <div class="status-pill ${editorStatusClass(plot.status)}">${plot.status}</div>
        </div>
        <div>
          <span class="status-dot ${editorStatusDotClass(plot.status)}"></span>
          Площадь: ${plot.area || "-"} м²
        </div>
        <div>Цена: ${plot.price || "-"}</div>
        <div style="font-size:11px; color:#6b7280; margin-top:2px;">
          ВРИ: ${plot.vri || "-"}
        </div>
      `;

      card.onclick = () => {
        const p = editorPlots.find(x => x.id === plot.id);
        if (p) {
          if (editorSelectedPlot && editorSelectedPlot.polygon && editorSelectedPlot.polygon.editor) {
            try {
              editorSelectedPlot.polygon.editor.stopEditing();
            } catch (e) {}
          }
          editorSelectPlot(p, true);
        }
      };

      container.appendChild(card);
    });
}

// ---------------------------------------
// СОЗДАНИЕ НОВОГО УЧАСТКА
// ---------------------------------------
function editorCreateNewPlot() {
  if (editorSelectedPlot && editorSelectedPlot.polygon && editorSelectedPlot.polygon.editor) {
    try {
      editorSelectedPlot.polygon.editor.stopEditing();
    } catch (e) {}
  }

  const nextId = Math.max(0, ...editorPlots.map(p => parseInt(p.id || 0))) + 1;

  const plot = {
    id: String(nextId),
    name: "Участок №" + nextId,
    status: "Свободен",
    area: "",
    areaValue: null,
    price: "",
    priceValue: null,
    vri: "",
    purpose: "",
    projectDescription: "",
    comment: "",
    zone: "",
    coords: []
  };

  const c = editorColorsByStatus(plot.status);

  const center = editorMap.getCenter();
  const delta = 0.0005;
  const polyCoords = [
    [center[0] + delta, center[1] - delta],
    [center[0] + delta, center[1] + delta],
    [center[0] - delta, center[1] + delta],
    [center[0] - delta, center[1] - delta]
  ];

  const polygon = new ymaps.Polygon(
    [polyCoords],
    {
      hintContent: plot.name,
      plotId: plot.id
    },
    {
      fillColor: c.fill,
      strokeColor: c.stroke,
      strokeWidth: 2,
      draggable: true,
      fillOpacity: 0.6
    }
  );

  polygon.events.add("click", () => editorSelectPlot(plot, true));

  editorMap.geoObjects.add(polygon);
  plot.polygon = polygon;
  plot.coords = polyCoords.map(([lat, lon]) => [lon, lat]);

  editorPlots.push(plot);
  editorSelectPlot(plot, true);
  editorRenderCards();
}

// ---------------------------------------
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ---------------------------------------
function initEditor() {
  editorMap = new ymaps.Map("map", {
    center: [43.17403, 44.9941],
    zoom: 17,
    controls: ["zoomControl", "typeSelector", "fullscreenControl"]
  });

  editorPlanOverlay = new ymaps.GroundOverlay(
    "plan.png",
    {
      // Пример привязки. При необходимости поправим под твой план.
      // Левая нижняя и правая верхняя точки.
      bounds: [
        [43.1728, 44.9928],
        [43.1752, 44.9954]
      ]
    },
    {
      opacity: 0.6,
      visible: true,
      zIndex: 1000
    }
  );
  editorMap.geoObjects.add(editorPlanOverlay);

  fetch("plotsData.json")
    .then(r => r.json())
    .then(arr => {
      editorPlots = arr.map(p => ({
        ...p,
        polygon: null
      }));
      editorRenderPlots();
      editorRenderCards();
    })
    .catch(err => {
      console.warn("Не удалось загрузить plotsData.json:", err);
    });

  editorSetupUI();
}

// ---------------------------------------
// ЕДИНАЯ ФУНКЦИЯ ЭКСПОРТА JSON
// ---------------------------------------
function editorExportJson() {
  try {
    // 1. Обновляем coords из геометрии полигонов (на случай, если что-то не сохранено через "Сохранить")
    editorPlots.forEach(plot => {
      if (plot.polygon && plot.polygon.geometry) {
        const coords = plot.polygon.geometry.getCoordinates();
        if (coords && coords[0] && coords[0].length >= 3) {
          // сохраняем в формате [lon, lat], как на клиентской карте
          plot.coords = coords[0].map(([lat, lon]) => [lon, lat]);
        }
      }
    });

    // 2. Собираем "плоские" объекты без polygon
    const plainPlots = editorPlots.map(plot => ({
      id: plot.id,
      name: plot.name,
      status: plot.status,
      area: plot.area,
      areaValue: plot.areaValue ?? null,
      price: plot.price,
      priceValue: plot.priceValue ?? null,
      vri: plot.vri,
      purpose: plot.purpose,
      projectDescription: plot.projectDescription,
      comment: plot.comment,
      zone: plot.zone || "",
      coords: plot.coords || []
    }));

    // 3. Делаем файл и скачиваем
    const json = JSON.stringify(plainPlots, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "plotsData.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Ошибка экспорта JSON:", e);
    alert("Ошибка экспорта JSON. Открой консоль (F12) и пришли мне текст ошибки.");
  }
}

// ---------------------------------------
// НАСТРОЙКА UI (кнопки)
// ---------------------------------------
function editorSetupUI() {
  document.getElementById("btnNewPlot").onclick = editorCreateNewPlot;

  // Автоматический экспорт JSON после сохранения
  document.getElementById("btnSavePlot").onclick = () => {
    editorSaveCurrentPlot();
    editorExportJson();
  };

  // Автоматический экспорт JSON после удаления
  document.getElementById("btnDeletePlot").onclick = () => {
    editorDeleteCurrentPlot();
    editorExportJson();
  };

  // Ручной экспорт JSON по кнопке
  document.getElementById("btnExport").onclick = editorExportJson;

  // импорт
  document.getElementById("inputImport").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const arr = JSON.parse(text);
    editorPlots.forEach(p => p.polygon && editorMap.geoObjects.remove(p.polygon));
    editorSelectedPlot = null;
    editorPlots = arr;
    editorRenderPlots();
    editorRenderCards();
    alert("Импорт выполнен.");
  };

  // переключение плана
  document.getElementById("btnTogglePlan").onclick = () => {
    const v = editorPlanOverlay.options.get("visible");
    editorPlanOverlay.options.set("visible", !v);
  };
}

ymaps.ready(initEditor);
