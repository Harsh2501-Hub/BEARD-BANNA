const paymentOptions =
    document.querySelectorAll('input[name="payment"]');

const upiSection =
    document.getElementById("upi-section");

const cardSection =
    document.getElementById("card-section");

paymentOptions.forEach(option => {

    option.addEventListener("change", () => {

        upiSection.style.display = "none";

        cardSection.style.display = "none";

        if (option.value === "upi") {

            upiSection.style.display = "block";

        }

        if (
            option.value === "credit" ||
            option.value === "debit"
        ) {

            cardSection.style.display = "block";

        }

    });

});