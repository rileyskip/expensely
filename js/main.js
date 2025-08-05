// Data
const spendingData = [
  {
    merchant: "Amazon",
    date: "2025-02-01",
    amount: "$50.00",
    description: "Books",
    need: false,
    status: "Paid",
  },
  {
    merchant: "Walmart",
    date: "2025-02-05",
    amount: "$30.00",
    description: "Groceries",
    need: true,
    status: "Scheduled",
  },
  {
    merchant: "Netflix",
    date: "2025-02-10",
    amount: "$15.00",
    description: "Subscription",
    need: true,
    status: "Pending",
  },
  {
    merchant: "Electric Company",
    date: "2025-02-15",
    amount: "$100.00",
    description: "Utilities",
    need: true,
    status: "Upcoming",
  },
];

const statusClasses = {
  Scheduled: "bg-blue-500",
  Pending: "bg-yellow-500",
  Upcoming: "bg-purple-500",
  Paid: "bg-green-500",
};

// DOM Elements
const tableBody = document.getElementById("spending-table-body");
const spendingTable = document.getElementById("spending-table");
const addRowButton = document.getElementById("add-row");
const addRowForm = document.getElementById("add-row-form");
const submitNewRow = document.getElementById("submit-new-row");

// Table Functions
function populateTable() {
  tableBody.innerHTML = "";
  spendingData.forEach((item, index) => {
    const row = document.createElement("tr");
    row.className =
      "block xl:table-row mb-8 xl:mb-0 border-b xl:border-b-0 bg-white rounded-lg shadow-sm xl:shadow-none";

    row.innerHTML = `
            <td class="block xl:table-cell py-3 px-4 border-b">
                <div class="grid grid-cols-2 xl:contents gap-4">
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Merchant Name:</span>
                        <span class="merchant block xl:inline mt-1 xl:mt-0">${
                          item.merchant
                        }</span>
                        <input class="hidden merchant-input border p-2 w-full" type="text" value="${
                          item.merchant
                        }">
                    </div>
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Date:</span>
                        <span class="date block xl:inline mt-1 xl:mt-0">${
                          item.date
                        }</span>
                        <input class="hidden date-input border p-2 w-full" type="date" value="${
                          item.date
                        }">
                    </div>
                </div>
            </td>
            <td class="block xl:table-cell py-3 px-4 border-b">
                <div class="grid grid-cols-2 xl:contents gap-4">
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Amount:</span>
                        <span class="amount block xl:inline mt-1 xl:mt-0">${
                          item.amount
                        }</span>
                        <input class="hidden amount-input border p-2 w-full" type="text" value="${
                          item.amount
                        }">
                    </div>
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Description:</span>
                        <span class="description block xl:inline mt-1 xl:mt-0">${
                          item.description
                        }</span>
                        <input class="hidden description-input border p-2 w-full" type="text" value="${
                          item.description
                        }">
                    </div>
                </div>
            </td>
            <td class="block xl:table-cell py-3 px-4 border-b">
                <div class="grid grid-cols-2 xl:contents gap-4">
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Need:</span>
                        <span class="need block xl:inline mt-1 xl:mt-0"><i class="fas ${
                          item.need
                            ? "fa-check text-green-500"
                            : "fa-times text-red-500"
                        }"></i></span>
                        <input class="hidden need-input" type="checkbox" ${
                          item.need ? "checked" : ""
                        }>
                    </div>
                    <div class="xl:contents">
                        <span class="font-bold xl:hidden text-gray-600">Status:</span>
                        <span class="status block xl:inline mt-1 xl:mt-0"><button class="${
                          statusClasses[item.status]
                        } text-white py-1 px-3 rounded">${
      item.status
    }</button></span>
                        <select class="hidden status-input border p-2 w-full">
                            <option value="Scheduled" ${
                              item.status === "Scheduled" ? "selected" : ""
                            }>Scheduled</option>
                            <option value="Pending" ${
                              item.status === "Pending" ? "selected" : ""
                            }>Pending</option>
                            <option value="Upcoming" ${
                              item.status === "Upcoming" ? "selected" : ""
                            }>Upcoming</option>
                            <option value="Paid" ${
                              item.status === "Paid" ? "selected" : ""
                            }>Paid</option>
                        </select>
                    </div>
                </div>
            </td>
            <td class="block xl:table-cell py-3 px-4 border-b">
                <span class="font-bold xl:hidden text-gray-600 block mb-2">Actions:</span>
                <div class="flex flex-col xl:flex-row space-y-2 xl:space-y-0 xl:space-x-2">
                    <button class="bg-red-500 text-white py-2 px-3 rounded w-full xl:w-auto" onclick="deleteRow(${index})">Delete</button>
                    <button class="bg-yellow-500 text-white py-2 px-3 rounded edit-button w-full xl:w-auto" onclick="editRow(${index})">Edit</button>
                    <button class="hidden bg-green-500 text-white py-2 px-3 rounded save-button w-full xl:w-auto" onclick="saveRow(${index})">Save</button>
                </div>
            </td>
        `;

    tableBody.appendChild(row);
  });
}

function deleteRow(index) {
  spendingData.splice(index, 1);
  populateTable();
}

function editRow(index) {
  addRowForm.classList.add("hidden");

  document
    .querySelectorAll(".edit-button")
    .forEach((button) => button.classList.remove("hidden"));
  document
    .querySelectorAll(".save-button")
    .forEach((button) => button.classList.add("hidden"));

  const tableRows = tableBody.querySelectorAll("tr");
  tableRows.forEach((row) => {
    row
      .querySelectorAll("span")
      .forEach((span) => span.classList.remove("hidden"));
    row
      .querySelectorAll("input, select")
      .forEach((input) => input.classList.add("hidden"));
  });

  const row = tableBody.children[index];
  row.querySelectorAll("span").forEach((span) => span.classList.add("hidden"));
  row
    .querySelectorAll("input, select")
    .forEach((input) => input.classList.remove("hidden"));
  row.querySelector(".edit-button").classList.add("hidden");
  row.querySelector(".save-button").classList.remove("hidden");
}

function saveRow(index) {
  const row = tableBody.children[index];
  const merchant = row.querySelector(".merchant-input").value;
  const date = row.querySelector(".date-input").value;
  const amount = row.querySelector(".amount-input").value;
  const description = row.querySelector(".description-input").value;
  const need = row.querySelector(".need-input").checked;
  const status = row.querySelector(".status-input").value;

  spendingData[index] = { merchant, date, amount, description, need, status };
  populateTable();

  addRowForm.classList.remove("hidden");
}

// Event Listeners
addRowButton.addEventListener("click", () => {
  addRowForm.classList.remove("hidden");
  document.getElementById("new-merchant").value = "";
  document.getElementById("new-date").value = "";
  document.getElementById("new-amount").value = "";
  document.getElementById("new-description").value = "";
  document.getElementById("new-need").checked = false;
  document.getElementById("new-status").value = "Scheduled";
});

submitNewRow.addEventListener("click", () => {
  const newRow = {
    merchant: document.getElementById("new-merchant").value,
    date: document.getElementById("new-date").value,
    amount: `$${parseFloat(document.getElementById("new-amount").value).toFixed(
      2
    )}`,
    description: document.getElementById("new-description").value,
    need: document.getElementById("new-need").checked,
    status: document.getElementById("new-status").value,
  };

  spendingData.push(newRow);
  populateTable();
  addRowForm.classList.add("hidden");
  document.getElementById("add-row-form").reset();
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  populateTable();
});
