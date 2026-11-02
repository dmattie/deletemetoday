(function () {
  "use strict";

  const STORAGE_KEY = "sproutPlants";
  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // The dashboard still works for this visit if storage is unavailable.
      }
    }
  };

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function dateFromString(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function daysBetween(earlier, later) {
    const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
    const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
    return Math.round((laterUtc - earlierUtc) / 86400000);
  }

  function starterPlants() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return STARTER_PLANTS.map(function (plant) {
      const lastWatered = new Date(today);
      lastWatered.setDate(lastWatered.getDate() - plant.daysAgo);
      return {
        id: plant.id,
        name: plant.name,
        location: plant.location,
        interval: plant.interval,
        lastWatered: localDateString(lastWatered)
      };
    });
  }

  const storedPlants = storage.get(STORAGE_KEY, null);
  let plants = Array.isArray(storedPlants) ? storedPlants : starterPlants();
  const plantList = document.getElementById("plant-list");
  const plantForm = document.getElementById("plant-form");
  const emptyState = document.getElementById("empty-state");
  const showFormButton = document.getElementById("show-form-button");
  const lastWateredInput = document.getElementById("last-watered-input");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  document.title = "Sprout | Plant care, in good time";
  document.getElementById("today-label").textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  lastWateredInput.value = localDateString(today);
  lastWateredInput.max = localDateString(today);

  function getWateringInfo(plant) {
    const daysSinceWatering = daysBetween(dateFromString(plant.lastWatered), today);
    const daysUntilDue = Number(plant.interval) - daysSinceWatering;
    let status;
    let statusText;

    if (daysUntilDue < 0) {
      status = "overdue";
      statusText = "Overdue by " + Math.abs(daysUntilDue) + (Math.abs(daysUntilDue) === 1 ? " day" : " days");
    } else if (daysUntilDue === 0) {
      status = "today";
      statusText = "Water today";
    } else if (daysUntilDue <= 3) {
      status = "soon";
      statusText = "Due in " + daysUntilDue + (daysUntilDue === 1 ? " day" : " days");
    } else {
      status = "later";
      statusText = "Due in " + daysUntilDue + " days";
    }

    return { status: status, statusText: statusText, daysUntilDue: daysUntilDue };
  }

  function makePlantRow(plant, info) {
    const row = document.createElement("article");
    row.className = "plant-row status-" + info.status;

    const priority = document.createElement("span");
    priority.className = "priority-mark";
    priority.setAttribute("aria-hidden", "true");

    const details = document.createElement("div");
    details.className = "plant-details";
    const name = document.createElement("h3");
    name.textContent = plant.name;
    const meta = document.createElement("p");
    meta.textContent = (plant.location || "No location") + " · Every " + plant.interval + " days";
    details.append(name, meta);

    const progress = document.createElement("div");
    progress.className = "plant-progress";
    progress.setAttribute("aria-hidden", "true");
    const progressTrack = document.createElement("span");
    progressTrack.className = "progress-track";
    const progressFill = document.createElement("span");
    progressFill.className = "progress-fill";
    const completion = Math.max(0, Math.min(1, (Number(plant.interval) - info.daysUntilDue) / Number(plant.interval)));
    progressFill.style.width = Math.round(completion * 100) + "%";
    progressTrack.append(progressFill);
    const lastWatered = document.createElement("small");
    lastWatered.textContent = "Last watered " + dateFromString(plant.lastWatered).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
    progress.append(progressTrack, lastWatered);

    const timing = document.createElement("div");
    timing.className = "plant-timing";
    const status = document.createElement("span");
    status.className = "status-label";
    status.textContent = info.statusText;
    const waterButton = document.createElement("button");
    waterButton.type = "button";
    waterButton.className = "water-button";
    waterButton.textContent = "Watered";
    waterButton.setAttribute("aria-label", "Mark " + plant.name + " as watered today");
    waterButton.addEventListener("click", function () {
      plant.lastWatered = localDateString(today);
      saveAndRender();
    });
    timing.append(status, waterButton);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", "Remove " + plant.name);
    removeButton.addEventListener("click", function () {
      plants = plants.filter(function (item) { return item.id !== plant.id; });
      saveAndRender();
    });

    row.append(priority, details, progress, timing, removeButton);
    return row;
  }

  function render() {
    const sortedPlants = plants.map(function (plant) {
      return { plant: plant, info: getWateringInfo(plant) };
    }).sort(function (first, second) {
      return first.info.daysUntilDue - second.info.daysUntilDue;
    });
    const needsWater = sortedPlants.filter(function (item) {
      return item.info.daysUntilDue <= 0;
    }).length;

    plantList.replaceChildren.apply(plantList, sortedPlants.map(function (item) {
      return makePlantRow(item.plant, item.info);
    }));
    document.getElementById("plant-count").textContent = plants.length;
    document.getElementById("needs-water-count").textContent = needsWater;
    document.getElementById("summary-note").textContent = needsWater === 0
      ? "All caught up. Enjoy the green."
      : needsWater === 1 ? "One plant could use a drink." : "A few plants could use a drink.";
    emptyState.hidden = plants.length > 0;
    plantList.hidden = plants.length === 0;
    showFormButton.disabled = !plantForm.hidden;
  }

  function saveAndRender() {
    storage.set(STORAGE_KEY, plants);
    render();
  }

  function openForm() {
    plantForm.hidden = false;
    showFormButton.disabled = true;
    plantForm.elements.name.focus();
  }

  function closeForm() {
    plantForm.hidden = true;
    showFormButton.disabled = false;
    plantForm.reset();
    lastWateredInput.value = localDateString(today);
    showFormButton.focus();
  }

  showFormButton.addEventListener("click", openForm);
  document.getElementById("empty-add-button").addEventListener("click", openForm);
  document.getElementById("cancel-form-button").addEventListener("click", closeForm);
  document.getElementById("dismiss-form-button").addEventListener("click", closeForm);

  plantForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(plantForm);
    const plant = {
      id: "plant-" + Date.now(),
      name: String(formData.get("name")).trim(),
      location: String(formData.get("location")).trim(),
      interval: Number(formData.get("interval")),
      lastWatered: String(formData.get("lastWatered"))
    };

    if (!plant.name || !plant.lastWatered || plant.interval < 1 || plant.interval > 365) {
      return;
    }

    plants.push(plant);
    saveAndRender();
    closeForm();
    document.getElementById("my-plants").scrollIntoView({ behavior: "smooth" });
  });

  document.querySelectorAll("nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      document.querySelectorAll("nav a").forEach(function (item) {
        item.removeAttribute("aria-current");
      });
      link.setAttribute("aria-current", "location");
    });
  });

  render();
})();