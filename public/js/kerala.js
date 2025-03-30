document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get("tripId");

    // Fetch trip data from MySQL
    const response = await fetch(`/api/trip?tripId=${tripId}`);
    const { trip, itinerary } = await response.json();

    // Populate trip details
    document.getElementById("trip-title").textContent = `${trip.trip_name || "My Kerala Trip"}: Explore Kerala`;
    document.getElementById("trip-dates").textContent = `Planned for ${trip.start_date} to ${trip.end_date}`;

    // Populate itinerary
    const itineraryDiv = document.getElementById("itinerary");
    const itineraryData = itinerary.length ? itinerary : [
        { day_number: 1, location: "Munnar", activities: ["Tea Gardens", "Eravikulam National Park"] },
        { day_number: 2, location: "Alleppey", activities: ["Houseboat Cruise", "Vembanad Lake"] }
    ];

    itineraryData.forEach(day => {
        const dayDiv = document.createElement("div");
        dayDiv.className = "day";
        let listHTML = `<h2>Day ${day.day_number}: ${day.location}</h2><ul class="activity-list">`;
        const activities = Array.isArray(day.activities) ? day.activities : JSON.parse(day.activities);
        activities.forEach(activity => {
            listHTML += `<li draggable="true" class="activity-item">${activity}</li>`;
        });
        listHTML += "</ul>";
        dayDiv.innerHTML = listHTML;
        itineraryDiv.appendChild(dayDiv);
    });

    // Drag-and-drop functionality
    let draggedItem = null;
    document.querySelectorAll(".activity-item").forEach(item => {
        item.addEventListener("dragstart", (e) => {
            draggedItem = e.target;
            e.target.classList.add("dragging");
        });
        item.addEventListener("dragend", (e) => {
            e.target.classList.remove("dragging");
            draggedItem = null;
        });
    });

    document.querySelectorAll(".activity-list").forEach(list => {
        list.addEventListener("dragover", (e) => e.preventDefault());
        list.addEventListener("drop", (e) => {
            e.preventDefault();
            if (draggedItem) {
                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement == null) list.appendChild(draggedItem);
                else list.insertBefore(draggedItem, afterElement);
            }
        });
    });

    function getDragAfterElement(list, y) {
        const draggableElements = [...list.querySelectorAll(".activity-item:not(.dragging)")];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Save itinerary
    document.getElementById("save-btn").addEventListener("click", async () => {
        const updatedItinerary = [];
        document.querySelectorAll(".day").forEach(day => {
            const dayNum = parseInt(day.querySelector("h2").textContent.match(/Day (\d+)/)[1]);
            const location = day.querySelector("h2").textContent.split(": ")[1];
            const activities = [...day.querySelectorAll("li")].map(li => li.textContent);
            updatedItinerary.push({ day: dayNum, location, activities });
        });
        await fetch("/api/itineraries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, itinerary: updatedItinerary })
        });
        alert("Itinerary saved!");
    });
});