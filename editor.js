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
  if (s.includes("муниц")) return { fill: "#60A5FA55", stroke: "#2563EB" };
  if (s.includes("прод")) return { fill: "#EF444455", stroke: "#B91C1C" };
  if (s.includes("резерв")) return { fill: "#FACC1555", stroke: "#CA8A04" };
  return { fill: "#22C55E55", stroke: "#16A34A" };
}

function editorSelectedColorsByStatus(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("муниц")) return { fill: "#3B82F670", stroke: "#1D4ED8" };
  if (s.includes("прод")) return { fill: "#EF444470", stroke: "#B91C1C" };
  if (s.includes("резерв")) return { fill: "#FACC1570", stroke: "#CA8A04" };
  return { fill: "#4ADE8070", stroke: "#22C55E" };
}

// ---------------------------------------
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ---------------------------------------
function initEditor() {
  editorMap = new ymaps.Map("map", {
    center: [43.1743, 44.9943],
    zoom: 16,
    type: "yandex#hybrid"
  });

  editorMap.controls.remove("trafficControl");
  editorMap.controls.remove("fullscreenControl");

  // ---------------------------------------
  //   ПОДЛОЖКА PNG (Rectangle)
  // ---------------------------------------
  const latMin = 43.17200148099052;
  const latMax = 43.17607685437098;
  const lonMin = 44.98947002377316;
  const lonMax = 44.99881483998105;

  editorPlanOverlay = new ymaps.Rectangle(
    [
      [latMin, lonMin],
      [latMax, lonMax]
    ],
    {},
    {
      fillImageHref: "plan.png",
      fillMethod: "stretch",
      opacity: 0.75,
      strokeWidth: 0,
      zIndex: 0
    }
  );

  editorMap.geoObjects.add(editorPlanOverlay);

  // ---------------------------------------
  //   ЗАГРУЗКА plotsData.json
  // ---------------------------------------
  fetch("plotsData.json")
    .then(r => r.json())
    .then(data => {
      editorPlots = data;
      editorRenderPlots();
      editorRenderCards();
      editorSetupUI();
    })
    .catch(err => {
      console.warn("plotsData.json отсутствует, редактор работает с пустыми данными.");
      editorSetupUI();
    });
}

// ---------------------------------------
// РИСОВАНИЕ ПОЛИГОНОВ
// ---------------------------------------
function editorRenderPlots() {
  editorPlots.forEach(p => {
    if (p.polygon) editorMap.geoObjects.remove(p.polygon);
  });

  editorPlots.forEach(plot => {
    const style = editorColorsByStatus(plot.status);

    const polygon = new ymaps.Polygon(
      [ (plot.coords || []).map(([lon, lat]) => [lat, lon]) ],
      { hintContent: plot.name },
      {
        fillColor: style.fill,
        strokeColor: style.stroke,
        strokeWidth: 2,
        cursor: "pointer",
        zIndex: 10
      }
    );

    plot.polygon = polygon;
    editorMap.geoObjects.add(polygon);

    polygon.events.add("click", () => {
      editorSelectPlot(plot, true);
    });
  });
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
          ${plot.area || "-"}, ${plot.price || "-"}
        </div>
      `;

      card.onclick = () => editorSelectPlot(plot, true);

      container.appendChild(card);
    });
}

function editorHighlightCard(id) {
  document.querySelectorAll(".plot-card").forEach(c => {
    c.classList.toggle("selected", c.dataset.plotId == id);
  });
}

// ---------------------------------------
// ВЫБОР УЧАСТКА
// ---------------------------------------
function editorSelectPlot(plot, center = false) {
  if (editorSelectedPlot && editorSelectedPlot !== plot) {
    const c = editorColorsByStatus(editorSelectedPlot.status);
    editorSelectedPlot.polygon.options.set({
      fillColor: c.fill,
      strokeColor: c.stroke
    });
    editorSelectedPlot.polygon.editor && editorSelectedPlot.polygon.editor.stopEditing();
  }

  editorSelectedPlot = plot;
  editorHighlightCard(plot.id);

  const highlight = editorSelectedColorsByStatus(plot.status);
  plot.polygon.options.set({
    fillColor: highlight.fill,
    strokeColor: highlight.stroke
  });

  plot.polygon.editor.startEditing();
  editorFillForm(plot);

  if (center) {
    const bounds = plot.polygon.geometry.getBounds();
    if (bounds) editorMap.setBounds(bounds, { duration: 200 });
  }
}

// ---------------------------------------
// ФОРМА
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
}

function editorReadFormIntoPlot(plot) {
  plot.id = document.getElementById("fieldId").value.trim();
  plot.name = document.getElementById("fieldName").value.trim();
  plot.status = document.getElementById("fieldStatus").value;
  plot.area = document.getElementById("fieldArea").value.trim();
  plot.areaValue = parseFloat(document.getElementById("fieldAreaValue").value) || null;
  plot.price = document.getElementById("fieldPrice").value.trim();
  plot.priceValue = parseInt(document.getElementById("fieldPriceValue").value) || null;
  plot.vri = document.getElementById("fieldVri").value.trim();
  plot.purpose = document.getElementById("fieldPurpose").value.trim();
  plot.projectDescription = document.getElementById("fieldProjectDescription").value.trim();
  plot.comment = document.getElementById("fieldComment").value.trim();
}

// ---------------------------------------
// СОЗДАНИЕ НОВОГО УЧАСТКА
// ---------------------------------------
function editorCreateNewPlot() {
  if (editorSelectedPlot && editorSelectedPlot.polygon.editor)
    editorSelectedPlot.polygon.editor.stopEditing();

  const nextId =
    Math.max(0, ...editorPlots.map(p => parseInt(p.id || 0))) + 1;

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
  zone: "",           // <<< новое поле
  coords: []
};

  const c = editorColorsByStatus(plot.status);

  const polygon = new ymaps.Polygon(
    [],
    { hintContent: plot.name },
    {
      fillColor: c.fill,
      strokeColor: c.stroke,
      strokeWidth: 2,
      zIndex: 10,
      cursor: "pointer"
    }
  );

  plot.polygon = polygon;
  editorPlots.push(plot);

  editorMap.geoObjects.add(polygon);
  polygon.editor.startDrawing();

  editorSelectedPlot = plot;
  editorFillForm(plot);
  editorRenderCards();
  editorHighlightCard(plot.id);
}

// ---------------------------------------
// СОХРАНЕНИЕ
// ---------------------------------------
function editorSaveCurrentPlot() {
  if (!editorSelectedPlot) {
    alert("Сначала выберите участок.");
    return;
  }

  const coords = editorSelectedPlot.polygon.geometry.getCoordinates();
  if (!coords || !coords[0] || coords[0].length < 3) {
    alert("Участок должен содержать минимум 3 точки.");
    return;
  }

  editorSelectedPlot.coords = coords[0].map(([lat, lon]) => [lon, lat]);
  editorReadFormIntoPlot(editorSelectedPlot);

  const c = editorColorsByStatus(editorSelectedPlot.status);
  editorSelectedPlot.polygon.options.set({
    fillColor: c.fill,
    strokeColor: c.stroke
  });

  editorRenderCards();
  alert("Участок сохранён. Не забудьте экспортировать JSON.");
}

// ---------------------------------------
// УДАЛЕНИЕ
// ---------------------------------------
function editorDeleteCurrentPlot() {
  if (!editorSelectedPlot) {
    alert("Выберите участок.");
    return;
  }

  if (!confirm("Удалить участок " + editorSelectedPlot.name + "?")) return;

  editorMap.geoObjects.remove(editorSelectedPlot.polygon);
  editorPlots = editorPlots.filter(p => p !== editorSelectedPlot);
  editorSelectedPlot = null;

  editorRenderCards();
  alert("Удалено.");
}

// ---------------------------------------
// ИМПОРТ / ЭКСПОРТ
// ---------------------------------------
function editorSetupUI() {
  document.getElementById("btnNewPlot").onclick = editorCreateNewPlot;
  document.getElementById("btnSavePlot").onclick = editorSaveCurrentPlot;
  document.getElementById("btnDeletePlot").onclick = editorDeleteCurrentPlot;

      // экспорт JSON: только "чистые" данные (без polygon)
  document.getElementById("btnExport").onclick = () => {
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
  };

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
