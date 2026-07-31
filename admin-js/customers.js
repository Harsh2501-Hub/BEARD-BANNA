// ===============================
// DUMMY CUSTOMERS
// ===============================

let customers = [

    {

        id: 1,

        name: "Harsh Rajput",

        email: "harsh@email.com",

        phone: "9876543210",

        orders: 5,

        spent: 5495,

        joined: "12 Jul 2026",

        status: "Active",

        address: "Vadodara, Gujarat"

    },

    {

        id: 2,

        name: "Rahul Sharma",

        email: "rahul@email.com",

        phone: "9123456780",

        orders: 2,

        spent: 2198,

        joined: "15 Jul 2026",

        status: "Blocked",

        address: "Ahmedabad, Gujarat"

    },

    {

        id: 3,

        name: "Aman Singh",

        email: "aman@email.com",

        phone: "9988776655",

        orders: 8,

        spent: 8792,

        joined: "18 Jul 2026",

        status: "Active",

        address: "Jaipur, Rajasthan"

    },

    {

        id: 4,

        name: "Priya Patel",

        email: "priya@email.com",

        phone: "9090909090",

        orders: 4,

        spent: 4396,

        joined: "20 Jul 2026",

        status: "Active",

        address: "Surat, Gujarat"

    }

];

// ===============================
// LOCAL STORAGE
// ===============================

if (

    !localStorage.getItem(

        "customers"

    )

) {

    localStorage.setItem(

        "customers",

        JSON.stringify(customers)

    );

}

customers = JSON.parse(

    localStorage.getItem(

        "customers"

    )

);

// ===============================
// RENDER CUSTOMERS
// ===============================

function renderCustomers(filteredCustomers = customers) {

    const customersBody =

        document.getElementById(

            "customers-body"

        );

    if (!customersBody) return;

    let html = "";

    filteredCustomers.forEach(customer => {

        html += `

        <tr>

            <td>

    <div class="customer-name">

        <div class="customer-avatar">

            ${customer.name.charAt(0)}

        </div>

        <span>

            ${customer.name}

        </span>

    </div>

</td>

            <td>

                ${customer.email}

            </td>

            <td>

                ${customer.phone}

            </td>

            <td>

                ${customer.orders}

            </td>

            <td>

                <span class="status ${customer.status.toLowerCase()}">

                    ${customer.status}

                </span>

            </td>

            <td>

    <button

        class="view-btn"

        onclick="viewCustomer(${customer.id})">

        👁 View

    </button>

    <button

        class="block-btn ${customer.status === 'Active' ? 'danger' : 'success'}"

        onclick="toggleCustomerStatus(${customer.id})">

        ${customer.status === "Active" ? "🚫 Block" : "✅ Unblock"}

    </button>

    <button

    class="delete-btn"

    onclick="deleteCustomer(${customer.id})">

    🗑 Delete

</button>

</td>

        </tr>

        `;

    });

    if (filteredCustomers.length === 0) {

        html = `

        <tr>

            <td colspan="6"

                class="empty-customers">

                ❌ No customers match your search.

            </td>

        </tr>

        `;

    }

    customersBody.innerHTML = html;

}

// ===============================
// SEARCH EVENT
// ===============================

const searchInput =

    document.getElementById(

        "customer-search"

    );

if (searchInput) {

    searchInput.addEventListener(

        "input",

        searchCustomers

    );

}

// ===============================
// CUSTOMER STATISTICS
// ===============================

function updateCustomerStats() {

    document.getElementById(

        "customer-total"

    ).textContent = customers.length;

    const activeCustomers =

        customers.filter(

            customer => customer.status === "Active"

        );

    document.getElementById(

        "customer-active"

    ).textContent = activeCustomers.length;

    const blockedCustomers =

        customers.filter(

            customer => customer.status === "Blocked"

        );

    document.getElementById(

        "customer-blocked"

    ).textContent = blockedCustomers.length;

    let revenue = 0;

    customers.forEach(customer => {

        revenue += customer.spent;

    });

    document.getElementById(

        "customer-revenue"

    ).textContent =

        "₹" + revenue.toLocaleString();

}

// ===============================
// VIEW CUSTOMER
// ===============================

function viewCustomer(id) {

    const customer =

        customers.find(

            c => c.id === id

        );

    if (!customer) return;

    document.getElementById(

        "customer-details"

    ).innerHTML = `

        <div class="customer-info">

            <div>

                <strong>Name:</strong>

                ${customer.name}

            </div>

            <div>

                <strong>Email:</strong>

                ${customer.email}

            </div>

            <div>

                <strong>Phone:</strong>

                ${customer.phone}

            </div>

            <div>

                <strong>Orders:</strong>

                ${customer.orders}

            </div>

            <div>

                <strong>Total Spent:</strong>

                ₹${customer.spent.toLocaleString()}

            </div>

            <div>

                <strong>Status:</strong>

                ${customer.status}

            </div>

            <div>

                <strong>Joined:</strong>

                ${customer.joined}

            </div>

            <div>

                <strong>Address:</strong>

                ${customer.address}

            </div>

        </div>

    `;

    document.getElementById(

        "customer-modal"

    ).style.display = "flex";

}

// ===============================
// BLOCK / UNBLOCK CUSTOMER
// ===============================

function toggleCustomerStatus(id) {

    const customer = customers.find(

        c => c.id === id

    );

    if (!customer) return;

    customer.status =

        customer.status === "Active"

            ? "Blocked"

            : "Active";

    localStorage.setItem(

        "customers",

        JSON.stringify(customers)

    );

    renderCustomers();

    updateCustomerStats();

    showToast(

        customer.status === "Active"

            ? "✅ Customer Unblocked"

            : "🚫 Customer Blocked"

    );

}

// ===============================
// DELETE CUSTOMER
// ===============================

function deleteCustomer(id) {

    const confirmDelete = confirm(

        "Are you sure you want to delete this customer?"

    );

    if (!confirmDelete) {

        return;

    }

    customers = customers.filter(

        customer => customer.id !== id

    );

    localStorage.setItem(

        "customers",

        JSON.stringify(customers)

    );

    renderCustomers();

    updateCustomerStats();

    showToast(

        "🗑 Customer Deleted"

    );

}

// ===============================
// SEARCH CUSTOMERS
// ===============================

function searchCustomers() {

    const search = document

        .getElementById("customer-search")

        .value

        .toLowerCase()

        .trim();

    const filteredCustomers = customers.filter(customer =>

        customer.name.toLowerCase().includes(search)

        ||

        customer.email.toLowerCase().includes(search)

        ||

        customer.phone.includes(search)

    );

    renderCustomers(filteredCustomers);

}

// ===============================
// CUSTOMER ANALYTICS
// ===============================

function updateCustomerAnalytics() {

    if (customers.length === 0) {

        return;

    }

    const topCustomer =

        customers.reduce(

            (a, b) =>

                a.spent > b.spent ? a : b

        );

    document.getElementById(

        "top-customer"

    ).textContent =

        topCustomer.name;

    const totalSpent =

        customers.reduce(

            (sum, customer) =>

                sum + customer.spent,

            0

        );

    document.getElementById(

        "average-spending"

    ).textContent =

        "₹" + Math.round(

            totalSpent / customers.length

        ).toLocaleString();

    const totalOrders =

        customers.reduce(

            (sum, customer) =>

                sum + customer.orders,

            0

        );

    document.getElementById(

        "average-orders"

    ).textContent =

        (

            totalOrders / customers.length

        ).toFixed(1);

    document.getElementById(

        "newest-customer"

    ).textContent =

        customers[customers.length - 1].name;

}

// ===============================
// CLOSE MODAL
// ===============================

const closeModal =

    document.querySelector(

        ".close-modal"

    );

if (closeModal) {

    closeModal.onclick = () => {

        document.getElementById(

            "customer-modal"

        ).style.display = "none";

    };

}

window.onclick = function (event) {

    const modal =

        document.getElementById(

            "customer-modal"

        );

    if (event.target === modal) {

        modal.style.display = "none";

    }

};

renderCustomers();

updateCustomerStats();

updateCustomerAnalytics();