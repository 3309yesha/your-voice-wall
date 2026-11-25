// ======================================
// YOUR VOICE WALL - ADMIN DASHBOARD
// ======================================

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");

const reviewList = document.getElementById("reviewList");
const logoutButton = document.getElementById("logoutButton");

let currentFilter = "all";
let isAdmin = false;

// Show messages
function showLoginMessage(message) {
    loginMessage.textContent = message;
}

function showDashboardMessage(message) {
    dashboardMessage.textContent = message;
}

// Verify administrator identity
async function verifyAdmin() {
    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError || !user) {
        isAdmin = false;
        return false;
    }

    const { data, error } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Admin verification error:", error);
        throw error;
    }

    isAdmin = !!data;
    return isAdmin;
}

// Open dashboard after verification
async function openDashboard() {
    try {
        const verified = await verifyAdmin();

        if (!verified) {
            await supabaseClient.auth.signOut();

            loginSection.hidden = false;
            dashboardSection.hidden = true;

            showLoginMessage(
                "Access denied. This account is not an administrator."
            );

            return;
        }

        loginSection.hidden = true;
        dashboardSection.hidden = false;

        await loadReviews();
        startReviewRealtime();

    } catch (error) {
        loginSection.hidden = false;
        dashboardSection.hidden = true;

        showLoginMessage(
            "Could not verify administrator: " + error.message
        );
    }
}

// Admin login
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    const loginButton = loginForm.querySelector("button");

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        await openDashboard();

    } catch (error) {
        showLoginMessage("Login failed: " + error.message);

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login to Dashboard";
    }
});

// Load all reviews
async function loadReviews() {
    if (!isAdmin) return;

    showDashboardMessage("Loading reviews...");

    const { data, error } = await supabaseClient
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showDashboardMessage(
            "Could not load reviews: " + error.message
        );
        return;
    }

    const reviews = data || [];

    // Update dashboard statistics
    document.getElementById("totalCount").textContent =
        reviews.length;

    document.getElementById("pendingCount").textContent =
        reviews.filter(r => r.status === "pending").length;

    document.getElementById("approvedCount").textContent =
        reviews.filter(r => r.status === "approved").length;

    document.getElementById("rejectedCount").textContent =
        reviews.filter(r => r.status === "rejected").length;

    // Apply selected filter
    const filteredReviews = currentFilter === "all"
        ? reviews
        : reviews.filter(r => r.status === currentFilter);

    displayReviews(filteredReviews);

    showDashboardMessage(
        filteredReviews.length + " review(s) found."
    );
}

// Display review cards safely
function displayReviews(reviews) {
    reviewList.replaceChildren();

    if (reviews.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No reviews found.";
        reviewList.appendChild(empty);
        return;
    }

    reviews.forEach(review => {
        const card = document.createElement("article");
        card.className = "review-item";

        const message = document.createElement("p");
        message.textContent = review.review_text;

        const details = document.createElement("p");
        details.textContent =
            "Colour: " + review.colour +
            " | Reaction: " + review.reaction +
            " | Rating: " + review.rating + "/5";

        const status = document.createElement("p");
        status.textContent = "Status: " + review.status;

        card.append(message, details, status);

        if (review.photo_url) {
            const photo = document.createElement("a");
            photo.href = review.photo_url;
            photo.textContent = "View uploaded photo";
            photo.target = "_blank";
            photo.rel = "noopener noreferrer";
            card.appendChild(photo);
        }

        const actions = document.createElement("div");
        actions.className = "review-actions";

        if (review.status !== "approved") {
            const approveButton = document.createElement("button");
            approveButton.className = "approve-button";
            approveButton.textContent = "Approve";

            approveButton.addEventListener("click", () => {
                updateReviewStatus(review.id, "approved");
            });

            actions.appendChild(approveButton);
        }

        if (review.status !== "rejected") {
            const rejectButton = document.createElement("button");
            rejectButton.className = "reject-button";
            rejectButton.textContent = "Reject";

            rejectButton.addEventListener("click", () => {
                updateReviewStatus(review.id, "rejected");
            });

            actions.appendChild(rejectButton);
        }

        // Permanent Delete button
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "🗑 Delete";

        deleteButton.addEventListener("click", () => {
            deleteReview(review.id);
        });

        actions.appendChild(deleteButton);

        card.appendChild(actions);
        reviewList.appendChild(card);
    });
}

async function deleteReview(id) {
    if (!isAdmin) return;

    const confirmDelete = confirm(
        "Are you sure you want to permanently delete this review? This cannot be undone."
    );

    if (!confirmDelete) return;

    showDashboardMessage("Deleting review...");

    const { data, error } = await supabaseClient
        .from("reviews")
        .delete()
        .eq("id", id)
        .select("id");

    if (error) {
        console.error("Delete error:", error);
        showDashboardMessage("Delete failed: " + error.message);
        return;
    }

    if (!data || data.length === 0) {
        showDashboardMessage("Review was not deleted. Check permissions.");
        return;
    }

    showDashboardMessage("Review permanently deleted successfully!");

    await loadReviews();
}

// Update review status
async function updateReviewStatus(id, newStatus) {
    if (!isAdmin) return;

    showDashboardMessage("Updating review...");

    const { data, error } = await supabaseClient
        .from("reviews")
        .update({ status: newStatus })
        .eq("id", id)
        .select("id, status");

    if (error) {
        console.error("Review update error:", error);
        showDashboardMessage("Update failed: " + error.message);
        return;
    }

    if (!data || data.length === 0) {
        showDashboardMessage(
            "No review was updated. Check database permissions."
        );
        return;
    }

    showDashboardMessage(
        `Review successfully marked as ${newStatus}!`
    );

    await loadReviews();
}


// Filter reviews
document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        loadReviews();
    });
});

// Admin logout
logoutButton.addEventListener("click", async () => {
    isAdmin = false;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showDashboardMessage("Logout failed: " + error.message);
        return;
    }

    dashboardSection.hidden = true;
    loginSection.hidden = false;

    loginForm.reset();
    showLoginMessage("You have logged out successfully.");
});

// Restore existing login session
async function initializeAdmin() {
    try {
        const { data: { session }, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        if (session) {
            await openDashboard();
        }

    } catch (error) {
        showLoginMessage("Initialization error: " + error.message);
    }
}

// Start admin application
initializeAdmin();

// REALTIME: Automatically refresh reviews when the database changes
let reviewRealtimeChannel = null;

function startReviewRealtime() {
    if (reviewRealtimeChannel) return;

    reviewRealtimeChannel = supabaseClient
        .channel("admin-reviews-live")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "reviews"
            },
            () => {
                console.log("Review changed. Updating dashboard...");
                loadReviews();
            }
        )
        .subscribe();
}

function stopReviewRealtime() {
    if (reviewRealtimeChannel) {
        supabaseClient.removeChannel(reviewRealtimeChannel);
        reviewRealtimeChannel = null;
    }
}
