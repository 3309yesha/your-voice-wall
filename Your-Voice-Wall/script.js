const reviewForm = document.getElementById("reviewForm");
const reviewText = document.getElementById("reviewText");
const reviewPhoto = document.getElementById("reviewPhoto");
const photoPreview = document.getElementById("photoPreview");
const characterCount = document.getElementById("characterCount");
const successMessage = document.getElementById("successMessage");
const reviewWall = document.getElementById("reviewWall");

let previewObjectUrl = null;

// Display approved reviews
function displayReview(review) {
    const card = document.createElement("div");

    const allowedColours = ["pink", "yellow", "blue", "purple"];
    const colour = allowedColours.includes(review.colour)
        ? review.colour
        : "yellow";

    card.className = "review-card " + colour;

    const message = document.createElement("p");
    message.textContent = review.review_text;

    const reaction = document.createElement("p");
    reaction.textContent = review.reaction || "";

    const rating = document.createElement("p");
    rating.className = "review-rating";
    rating.textContent = "⭐".repeat(
        Math.max(0, Math.min(5, Number(review.rating) || 0))
    );

    card.append(message, reaction, rating);

    // Display uploaded photo
    if (review.photo_url) {
        const image = document.createElement("img");

        image.src = review.photo_url;
        image.alt = "Visitor carnival photo";
        image.className = "review-photo";
        image.loading = "lazy";

        image.style.width = "100%";
        image.style.maxHeight = "180px";
        image.style.objectFit = "cover";
        image.style.borderRadius = "10px";
        image.style.marginTop = "10px";

        card.appendChild(image);
    }

    reviewWall.appendChild(card);
}

// Load approved reviews from Supabase
async function loadReviews() {
    try {
        const { data, error } = await supabaseClient
            .from("reviews")
            .select("id, review_text, colour, reaction, rating, photo_url, created_at")
            .eq("status", "approved")
            .order("created_at", { ascending: false });

        if (error) throw error;

        reviewWall.replaceChildren();

        if (!data || data.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent =
                "No approved reviews yet. Be the first to share your voice! 💖";

            reviewWall.appendChild(emptyMessage);
        } else {
            data.forEach(displayReview);
        }

        document.getElementById("reviewCount").textContent =
            (data ? data.length : 0) + "+";

        console.log("Approved reviews loaded:", data.length);

    } catch (error) {
        console.error("Loading reviews failed:", error);
    }
}

// Character counter
reviewText.addEventListener("input", () => {
    characterCount.textContent =
        reviewText.value.length + " / 250 characters";
});

// Photo preview
reviewPhoto.addEventListener("change", () => {
    const file = reviewPhoto.files[0];

    photoPreview.replaceChildren();

    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Please select a JPG, PNG or WEBP image.");
        reviewPhoto.value = "";
        return;
    }

    if (file.size > 1024 * 1024) {
        alert("Please select an image smaller than 1 MB.");
        reviewPhoto.value = "";
        return;
    }

    previewObjectUrl = URL.createObjectURL(file);

    const image = document.createElement("img");
    image.src = previewObjectUrl;
    image.alt = "Photo preview";

    image.style.width = "150px";
    image.style.maxHeight = "150px";
    image.style.objectFit = "cover";
    image.style.borderRadius = "10px";

    photoPreview.appendChild(image);
});

// Submit review with optional photo
reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = reviewText.value.trim();

    if (!text || text.length > 250) {
        alert("Please enter a review between 1 and 250 characters.");
        return;
    }

    const selectedColour = document.querySelector(
        'input[name="noteColour"]:checked'
    );

    const selectedReaction = document.querySelector(
        'input[name="reaction"]:checked'
    );

    const selectedRating = document.querySelector(
        'input[name="rating"]:checked'
    );

    if (!selectedColour || !selectedReaction || !selectedRating) {
        alert("Please select a colour, reaction and rating.");
        return;
    }

    const submitButton = reviewForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    let uploadedFilePath = null;

    try {
        let photoUrl = null;
        const photoFile = reviewPhoto.files[0];

        // Upload photo if selected
        if (photoFile) {
            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(photoFile.type)) {
                throw new Error("Please select a JPG, PNG or WEBP image.");
            }

            if (photoFile.size > 1024 * 1024) {
                throw new Error("Photo must be smaller than 1 MB.");
            }

            const extensions = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            };

            const extension = extensions[photoFile.type];

            const filePath =
                crypto.randomUUID() + "." + extension;

            const { error: uploadError } = await supabaseClient
                .storage
                .from("review-photos")
                .upload(filePath, photoFile, {
                    contentType: photoFile.type,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            uploadedFilePath = filePath;

            const { data: urlData } = supabaseClient
                .storage
                .from("review-photos")
                .getPublicUrl(filePath);

            photoUrl = urlData.publicUrl;
        }

        // Insert review into database
        const newReview = {
            review_text: text,
            colour: selectedColour.value,
            reaction: selectedReaction.value,
            rating: Number(selectedRating.value),
            photo_url: photoUrl,
            status: "pending"
        };

        const { error: insertError } = await supabaseClient
            .from("reviews")
            .insert([newReview]);

        if (insertError) throw insertError;

        successMessage.textContent =
            "Your review was submitted successfully! It will appear on the wall after admin approval. 💖";

        reviewForm.reset();

        photoPreview.replaceChildren();

        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }

        characterCount.textContent = "0 / 250 characters";

        console.log("Review submitted successfully!");

    } catch (error) {
        console.error("Submission failed:", error);

        // Clean up an uploaded photo if database insertion failed
        if (uploadedFilePath) {
            const { error: cleanupError } = await supabaseClient
                .storage
                .from("review-photos")
                .remove([uploadedFilePath]);

            if (cleanupError) {
                console.error("Photo cleanup failed:", cleanupError);
            }
        }

        alert("Could not submit your review: " + error.message);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit My Review 💖";
    }
});

// Start website
loadReviews();

// Public wall realtime updates
const publicReviewChannel = supabaseClient
    .channel("public-reviews-live")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "reviews"
        },
        () => {
            console.log("Reviews updated. Refreshing public wall...");
            loadReviews();
        }
    )
    .subscribe((status) => {
        console.log("Public wall realtime status:", status);
    });