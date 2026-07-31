// ===============================
// DUMMY ORDERS
// ===============================

let orders = [

    {
        id: "#1001",

        customer: "Harsh Rajput",

        total: 1998,

        status: "Pending",

        date: "26 Jul 2026",

        phone: "9876543210",

        payment: "UPI",

        address: "Vadodara, Gujarat",

        items: [

            {
                name: "Royal Warrior Tee",

                size: "L",

                quantity: 2,

                price: 999
            }

        ]
    },

    {
        id: "#1002",

        customer: "Rahul Sharma",

        total: 1099,

        status: "Delivered",

        date: "25 Jul 2026",

        phone: "9123456780",

        payment: "Credit Card",

        address: "Ahmedabad, Gujarat",

        items: [

            {
                name: "Heritage Crest Tee",

                size: "XL",

                quantity: 1,

                price: 1099
            }

        ]
    },

    {
        id: "#1003",

        customer: "Aman Singh",

        total: 2997,

        status: "Packed",

        date: "24 Jul 2026",

        phone: "9988776655",

        payment: "Cash on Delivery",

        address: "Jaipur, Rajasthan",

        items: [

            {
                name: "Banna Signature Tee",

                size: "M",

                quantity: 3,

                price: 999
            }

        ]
    },

    {
        id: "#1004",

        customer: "Priya Patel",

        total: 2198,

        status: "Shipped",

        date: "23 Jul 2026",

        phone: "9090909090",

        payment: "UPI",

        address: "Surat, Gujarat",

        items: [

            {
                name: "Royal Warrior Tee",

                size: "S",

                quantity: 2,

                price: 1099
            }

        ]
    }

];

// ===============================
// LOCAL STORAGE
// ===============================

if (

    !localStorage.getItem("orders")

) {

    localStorage.setItem(

        "orders",

        JSON.stringify(orders)

    );

}

orders = JSON.parse(

    localStorage.getItem("orders")

);

// ===============================
// RENDER ORDERS
// ===============================

function renderOrders(filteredOrders = orders) {

    const ordersBody = document.getElementById("orders-body");

    if (!ordersBody) return;

    let html = "";

    filteredOrders.forEach(order => {

        html += `

        <tr>

            <td>${order.id}</td>

            <td>${order.customer}</td>

            <td>₹${order.total}</td>

            <td>

<select

class="status-select ${order.status.toLowerCase()}"

onchange="updateOrderStatus('${order.id}', this.value)"

>

<option value="Pending"

${order.status === "Pending" ? "selected" : ""}>

Pending

</option>

<option value="Confirmed"

${order.status === "Confirmed" ? "selected" : ""}>

Confirmed

</option>

<option value="Packed"

${order.status === "Packed" ? "selected" : ""}>

Packed

</option>

<option value="Shipped"

${order.status === "Shipped" ? "selected" : ""}>

Shipped

</option>

<option value="Delivered"

${order.status === "Delivered" ? "selected" : ""}>

Delivered

</option>

<option value="Cancelled"

${order.status === "Cancelled" ? "selected" : ""}>

Cancelled

</option>

</select>

</td>

            <td>${order.date}</td>

            <td>

    <div class="action-buttons">

        <button
            class="view-btn"
            onclick="viewOrder('${order.id}')">

            👁 View

        </button>

        <button
            class="cancel-btn"
            onclick="cancelOrder('${order.id}')"

            ${order.status === "Cancelled" ? "disabled" : ""}>

            ❌ Cancel

        </button>

    </div>

</td>

        </tr>

        `;

    });

    if (filteredOrders.length === 0) {

        html = `

        <tr>

            <td colspan="6" class="empty-orders">

                📦 No Orders Found

            </td>

        </tr>

        `;

    }

    ordersBody.innerHTML = html;
    updateOrderStatistics();

}

const searchInput =

    document.getElementById(

        "order-search"

    );

if (searchInput) {

    searchInput.addEventListener(

        "input",

        filterOrders

    );

}

// ===============================
// SEARCH + FILTER
// ===============================

function filterOrders() {

    const search = document
        .getElementById("order-search")
        .value
        .toLowerCase()
        .trim();

    const status = document
        .getElementById("status-filter")
        .value;

    const filtered = orders.filter(order => {

        const matchesSearch =

            order.id.toLowerCase().includes(search)

            ||

            order.customer.toLowerCase().includes(search);

        const matchesStatus =

            status === "all"

            ||

            if (order.status === "Cancelled") {

            showToast(

                "⚠ Cancelled orders cannot be modified."

            );

            filterOrders();

            return;

        }

        order.status = status;

        return matchesSearch && matchesStatus;

    });

    renderOrders(filtered);

}

const statusFilter =

    document.getElementById(

        "status-filter"

    );

if (statusFilter) {

    statusFilter.addEventListener(

        "change",

        filterOrders

    );

}

renderOrders();

// ===============================
// ORDER STATISTICS
// ===============================

function updateOrderStatistics() {

    const totalOrders = orders.length;

    const pendingOrders = orders.filter(

        order => order.status === "Pending"

    ).length;

    const shippedOrders = orders.filter(

        order => order.status === "Shipped"

    ).length;

    const revenue = orders.reduce(

        (sum, order) => sum + order.total,

        0

    );

    document.getElementById(

        "stat-total-orders"

    ).textContent = totalOrders;

    document.getElementById(

        "stat-pending-orders"

    ).textContent = pendingOrders;

    document.getElementById(

        "stat-shipped-orders"

    ).textContent = shippedOrders;

    document.getElementById(

        "stat-total-revenue"

    ).textContent =

        "₹" + revenue.toLocaleString();

}

// ===============================
// UPDATE ORDER STATUS
// ===============================

function updateOrderStatus(id, status) {

    const order = orders.find(

        order => order.id === id

    );

    if (!order) return;

    order.status = status;

    localStorage.setItem(

        "orders",

        JSON.stringify(orders)

    );

    filterOrders();

    showToast(

        "✅ Order Updated"

    );

}

// ===============================
// CANCEL ORDER
// ===============================

function cancelOrder(id) {

    const confirmCancel = confirm(

        "Are you sure you want to cancel this order?"

    );

    if (!confirmCancel) {

        return;

    }

    const order = orders.find(

        order => order.id === id

    );

    if (!order) {

        return;

    }

    order.status = "Cancelled";

    localStorage.setItem(

        "orders",

        JSON.stringify(orders)

    );

    filterOrders();

    showToast(

        "❌ Order Cancelled"

    );

}

// ===============================
// VIEW ORDER
// ===============================

function viewOrder(id) {

    const order = orders.find(

        order => order.id === id

    );

    if (!order) return;

    let itemsHTML = "";

    order.items.forEach(item => {

        itemsHTML += `

        <li>

            <strong>${item.name}</strong>

            <br>

            Size : ${item.size}

            <br>

            Qty : ${item.quantity}

            <br>

            Price : ₹${item.price}

        </li>

        <hr>

        `;

    });

    document.getElementById("order-details").innerHTML = `

        <h2>

            Order ${order.id}

        </h2>

        <br>

        <p>

            <strong>Customer:</strong>

            ${order.customer}

        </p>

        <p>

            <strong>Phone:</strong>

            ${order.phone}

        </p>

        <p>

            <strong>Payment:</strong>

            ${order.payment}

        </p>

        <p>

            <strong>Address:</strong>

            ${order.address}

        </p>

        <br>

        <h3>

            Ordered Items

        </h3>

        <ul>

            ${itemsHTML}

        </ul>

        <h2>

            Total : ₹${order.total}

        </h2>

    `;

    document.getElementById("order-modal").style.display = "flex";

}

// ===============================
// CLOSE MODAL
// ===============================

const closeModal = document.getElementById("close-modal");

if (closeModal) {

    closeModal.onclick = () => {

        document.getElementById(

            "order-modal"

        ).style.display = "none";

    };

}

window.onclick = (event) => {

    const modal = document.getElementById("order-modal");

    if (event.target === modal) {

        modal.style.display = "none";

    }

};